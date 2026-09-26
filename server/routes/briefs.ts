import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { formatDate, parseIrishDateTime } from '../../shared/dates.js';
import type { Json } from '../../shared/database.types.js';
import { acceptRequest, analyseRequest, analysisResult, reviewRequest, uploadUrlRequest } from '../../shared/schemas/brief.js';
import { idParam } from '../../shared/schemas/groups.js';
import { projectAccess } from '../access.js';
import { type AppEnv, requireUser } from '../context.js';
import { HttpError, notFound } from '../http.js';
import { log } from '../logger.js';
import { clientIp, LIMITS, rateLimit } from '../ratelimit.js';
import { analyseBriefWithAi, normaliseAnalysis } from '../services/ai.js';
import { BRIEF_BUCKET, isPdf, PDF_MAX_BYTES } from '../services/storage.js';
import { adminClient, dbError } from '../supabase.js';
import { parse, readJson } from '../validate.js';

// Mounted under /api/projects/:projectId/briefs
export const briefRoutes = new Hono<AppEnv>();
briefRoutes.use('*', requireUser);

async function usageLeft(projectId: string, plan: string): Promise<number> {
  const admin = adminClient();
  const [{ data: limit }, { data: usage }] = await Promise.all([
    admin.from('plan_limits').select('max_per_project').eq('plan', plan).eq('kind', 'brief_breakdown').maybeSingle(),
    admin.from('project_usage').select('used').eq('project_id', projectId).eq('kind', 'brief_breakdown').maybeSingle(),
  ]);
  return (limit?.max_per_project ?? 0) - (usage?.used ?? 0);
}

briefRoutes.post('/upload-url', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  parse(uploadUrlRequest, await readJson(c));
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  await rateLimit([{ limit: LIMITS.aiUser, key: `upload:${c.var.user.id}` }]);
  if ((await usageLeft(project.id, project.plan)) <= 0) throw new HttpError(409, 'usage_limit_reached');
  // The path is chosen by the server. The bucket only accepts PDFs of 10 MB or less.
  const path = `${project.id}/${randomUUID()}.pdf`;
  const { data, error } = await adminClient().storage.from(BRIEF_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(502, 'upload_unavailable');
  return c.json({ path: data.path, token: data.token });
});

briefRoutes.post('/analyse', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const body = parse(analyseRequest, await readJson(c));
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  await rateLimit([
    { limit: LIMITS.aiUser, key: c.var.user.id },
    { limit: LIMITS.aiIp, key: clientIp(c) },
  ]);
  if ('storage_path' in body && !body.storage_path.startsWith(`${project.id}/`)) throw notFound();

  const admin = adminClient();
  // Usage is counted on the server and reserved atomically before the AI call.
  const { data: reserved, error: rErr } = await admin.rpc('reserve_usage', { p_project: project.id, p_kind: 'brief_breakdown' });
  if (rErr) throw dbError(rErr);
  if (reserved == null) throw new HttpError(409, 'usage_limit_reached');

  let analysisId: string | null = null;
  try {
    let pdf: Buffer | undefined;
    let fileSize: number | null = null;
    if ('storage_path' in body) {
      const { data: blob, error } = await admin.storage.from(BRIEF_BUCKET).download(body.storage_path);
      if (error || !blob) throw new HttpError(404, 'upload_missing');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      fileSize = bytes.length;
      if (bytes.length > PDF_MAX_BYTES) throw new HttpError(413, 'file_too_large');
      if (!isPdf(bytes)) throw new HttpError(415, 'not_a_pdf');
      pdf = Buffer.from(bytes);
    }

    const { count: members } = await admin.from('group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', project.group_id);
    const { data: row, error: insErr } = await admin
      .from('brief_analyses')
      .insert({
        project_id: project.id,
        source: pdf ? 'pdf' : 'text',
        storage_path: 'storage_path' in body ? body.storage_path : null,
        file_name: 'file_name' in body ? body.file_name : null,
        file_size: fileSize,
        status: 'processing',
        created_by: c.var.user.id,
      })
      .select('id')
      .single();
    if (insErr || !row) throw dbError(insErr);
    analysisId = row.id;

    const output = await analyseBriefWithAi(pdf ? { pdf } : { text: 'text' in body ? body.text : '' }, Math.max(1, members ?? 1), formatDate(new Date()));
    const result = normaliseAnalysis(output, Math.max(1, members ?? 1));
    await admin.from('brief_analyses').update({ status: 'ready', result: result as unknown as Json, completed_at: new Date().toISOString() }).eq('id', analysisId);
    return c.json({ id: analysisId, result }, 201);
  } catch (err) {
    // A failed breakdown does not count against the project's limit.
    await admin.rpc('release_usage', { p_project: project.id, p_kind: 'brief_breakdown' });
    const code = err instanceof HttpError ? err.code : 'ai_unavailable';
    if (analysisId) {
      await admin.from('brief_analyses').update({ status: 'failed', error_code: code, completed_at: new Date().toISOString() }).eq('id', analysisId);
    }
    if ('storage_path' in body && (code === 'not_a_pdf' || code === 'file_too_large')) {
      await admin.storage.from(BRIEF_BUCKET).remove([body.storage_path]);
    }
    log({ event: 'brief_failed', code });
    throw err instanceof HttpError ? err : new HttpError(502, 'ai_unavailable');
  }
});

async function loadAnalysis(c: { var: AppEnv['Variables'] }, projectId: string, analysisId: string) {
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  const { data, error } = await adminClient().from('brief_analyses').select('id, status, result, accepted_at, storage_path').eq('id', analysisId).eq('project_id', project.id).maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound();
  return { project, analysis: data };
}

// Saves the member's corrections to the extracted brief before tasks are proposed.
briefRoutes.put('/:analysisId/review', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const analysisId = parse(idParam, c.req.param('analysisId'));
  const body = parse(reviewRequest, await readJson(c));
  const { analysis } = await loadAnalysis(c, projectId, analysisId);
  if (analysis.status !== 'ready' || analysis.accepted_at) throw new HttpError(409, 'analysis_not_ready');
  const current = analysisResult.parse(analysis.result);
  const deadlines = body.deadlines.map((d) => {
    if (!d.date) return { item: d.item, due_at: null };
    const at = parseIrishDateTime(d.date, d.time || '17:00');
    if (!at) throw new HttpError(400, 'invalid_input', 'deadlines');
    return { item: d.item, due_at: at.toISOString() };
  });
  const next = { ...current, reviewed: true, brief: { ...current.brief, deliverables: body.deliverables, deadlines, criteria: body.criteria } };
  const { error } = await adminClient().from('brief_analyses').update({ result: next as unknown as Json }).eq('id', analysis.id);
  if (error) throw dbError(error);
  return c.json({ ok: true });
});

// Creates the reviewed tasks. The brief saved on the project is the reviewed version, never raw model output.
briefRoutes.post('/:analysisId/accept', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const analysisId = parse(idParam, c.req.param('analysisId'));
  const body = parse(acceptRequest, await readJson(c));
  const { project, analysis } = await loadAnalysis(c, projectId, analysisId);
  const current = analysisResult.parse(analysis.result);
  const { data, error } = await adminClient().rpc('accept_brief', {
    p_project: project.id,
    p_analysis: analysis.id,
    p_brief: current.brief as unknown as Json,
    p_tasks: body.tasks as unknown as Json,
    p_actor: c.var.user.id,
  });
  if (error) throw dbError(error);
  return c.json({ created: data }, 201);
});

// Short lived link to the original PDF, for members only.
briefRoutes.get('/:analysisId/file', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const analysisId = parse(idParam, c.req.param('analysisId'));
  const { analysis } = await loadAnalysis(c, projectId, analysisId);
  if (!analysis.storage_path) throw notFound();
  const { data, error } = await adminClient().storage.from(BRIEF_BUCKET).createSignedUrl(analysis.storage_path, 60);
  if (error || !data) throw notFound();
  return c.json({ url: data.signedUrl });
});
