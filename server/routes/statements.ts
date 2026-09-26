import { Hono } from 'hono';
import { formatDate, formatDateTime } from '../../shared/dates.js';
import type { Json } from '../../shared/database.types.js';
import { describeEntry } from '../../shared/logText.js';
import { idParam } from '../../shared/schemas/groups.js';
import { updateStatement } from '../../shared/schemas/statement.js';
import { projectAccess } from '../access.js';
import { type AppEnv, requireUser } from '../context.js';
import { HttpError, notFound } from '../http.js';
import { clientIp, LIMITS, rateLimit } from '../ratelimit.js';
import { draftStatementWithAi } from '../services/ai.js';
import { adminClient, dbError } from '../supabase.js';
import { parse, readJson } from '../validate.js';

// Mounted under /api/projects/:projectId/statements
export const projectStatementRoutes = new Hono<AppEnv>();
projectStatementRoutes.use('*', requireUser);

projectStatementRoutes.post('/generate', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  await rateLimit([
    { limit: LIMITS.aiUser, key: c.var.user.id },
    { limit: LIMITS.aiIp, key: clientIp(c) },
  ]);

  // Everything is read as the user, so RLS limits the digest to this one project.
  const db = c.var.db;
  const [{ data: members, error: mErr }, { data: tasks, error: tErr }, { data: log, error: lErr }] = await Promise.all([
    db.rpc('group_member_list', { p_group: project.group_id }),
    db.from('tasks').select('id, title, status, assignee_id, estimated_hours, due_at').eq('project_id', project.id).order('position'),
    db.from('activity_log').select('event, actor_id, task_title, payload, created_at').eq('project_id', project.id).order('created_at').limit(2000),
  ]);
  if (mErr || tErr || lErr) throw dbError(mErr ?? tErr ?? lErr);
  if (!(tasks ?? []).some((t) => t.status === 'done')) throw new HttpError(409, 'nothing_to_draft');

  const nameOf = (id: string | null) => (id ? (members ?? []).find((m) => m.user_id === id)?.full_name || 'Former member' : 'Former member');
  const entries = log ?? [];
  // Digest: names only, no email addresses, no file URLs.
  const digest = [
    `Group: ${project.group_name}. Assignment: ${project.module_code ? `${project.module_code} ` : ''}${project.title}.`,
    `Members: ${(members ?? []).map((m) => `${m.full_name}${m.role === 'owner' ? ' (owner)' : ''}`).join('; ')}.`,
    'Tasks:',
    ...(tasks ?? []).map((t) => `- "${t.title}" | owner: ${t.assignee_id ? nameOf(t.assignee_id) : 'unassigned'} | status: ${t.status} | estimated hours: ${Number(t.estimated_hours)}${t.due_at ? ` | due ${formatDate(t.due_at)}` : ''}`),
    'Log:',
    ...entries.map((e) => {
      const d = describeEntry(e, nameOf);
      return `- ${formatDateTime(e.created_at)} ${nameOf(e.actor_id)} ${d.text}${d.note ? ` Note: ${d.note}` : ''}`;
    }),
  ].join('\n');
  const headings = (members ?? []).map((m) => (m.role === 'owner' ? `${m.full_name}, group owner` : m.full_name));

  const admin = adminClient();
  const { data: reserved, error: rErr } = await admin.rpc('reserve_usage', { p_project: project.id, p_kind: 'statement_generation' });
  if (rErr) throw dbError(rErr);
  if (reserved == null) throw new HttpError(409, 'usage_limit_reached');
  try {
    const sections = await draftStatementWithAi(digest, headings);
    const { data, error } = await admin
      .from('statements')
      .insert({
        project_id: project.id,
        sections: sections as unknown as Json,
        period_from: entries[0]?.created_at ?? null,
        period_to: new Date().toISOString(),
        generated_by: c.var.user.id,
      })
      .select('id')
      .single();
    if (error || !data) throw dbError(error);
    return c.json({ id: data.id }, 201);
  } catch (err) {
    await admin.rpc('release_usage', { p_project: project.id, p_kind: 'statement_generation' });
    throw err instanceof HttpError ? err : new HttpError(502, 'ai_unavailable');
  }
});

// Mounted under /api/statements
export const statementRoutes = new Hono<AppEnv>();
statementRoutes.use('*', requireUser);

statementRoutes.patch('/:statementId', async (c) => {
  const statementId = parse(idParam, c.req.param('statementId'));
  const body = parse(updateStatement, await readJson(c));
  const { data, error } = await c.var.db.from('statements').update({ sections: body.sections as unknown as Json }).eq('id', statementId).select('id');
  if (error) throw dbError(error);
  if (!data?.length) throw notFound();
  return c.json({ ok: true });
});
