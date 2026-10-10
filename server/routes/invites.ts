import { Hono } from 'hono';
import { formatDate } from '../../shared/dates.js';
import { createInvite, idParam, inviteCode } from '../../shared/schemas/groups.js';
import { projectAccess, requireOwnerRole } from '../access.js';
import { type AppEnv, requireUser } from '../context.js';
import { inviteEmail } from '../emails/templates.js';
import { appUrl } from '../env.js';
import { HttpError, notFound } from '../http.js';
import { clientIp, LIMITS, rateLimit } from '../ratelimit.js';
import { sendEmail } from '../services/email.js';
import { adminClient, dbError } from '../supabase.js';
import { deriveToken, fromBytea, hashToken, newNonce, toBytea } from '../tokens.js';
import { parse, readJson } from '../validate.js';

const joinUrl = (code: string) => `${appUrl()}/join/${code}`;

// Owner routes, mounted under /api/projects/:projectId/invites
export const projectInviteRoutes = new Hono<AppEnv>();
projectInviteRoutes.use('*', requireUser);

type InviteRow = { id: string; kind: 'link' | 'email'; email: string | null; nonce: string; max_uses: number; use_count: number; expires_at: string; revoked_at: string | null; created_at: string };

function isActive(i: InviteRow) {
  return !i.revoked_at && new Date(i.expires_at) > new Date() && i.use_count < i.max_uses;
}

projectInviteRoutes.get('/', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  requireOwnerRole(project.role);
  const { data, error } = await adminClient()
    .from('invites')
    .select('id, kind, email, nonce, max_uses, use_count, expires_at, revoked_at, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  const rows = (data ?? []) as InviteRow[];
  const link = rows.find((i) => i.kind === 'link' && isActive(i));
  return c.json({
    link: link
      ? { id: link.id, url: joinUrl(deriveToken('invite', fromBytea(link.nonce))), use_count: link.use_count, max_uses: link.max_uses, expires_at: link.expires_at }
      : null,
    pending: rows
      .filter((i) => i.kind === 'email' && isActive(i))
      .map((i) => ({ id: i.id, email: i.email, created_at: i.created_at, expires_at: i.expires_at })),
  });
});

projectInviteRoutes.post('/', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const body = parse(createInvite, await readJson(c));
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  requireOwnerRole(project.role);
  await rateLimit([{ limit: LIMITS.inviteCreateGroup, key: project.group_id }]);

  const admin = adminClient();
  const { count } = await admin.from('group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', project.group_id);
  const free = 8 - (count ?? 0);
  if (free <= 0) throw new HttpError(409, 'group_full');

  if (body.kind === 'link') {
    // One active link per project: a new link replaces the previous one.
    await admin.from('invites').update({ revoked_at: new Date().toISOString() }).eq('project_id', project.id).eq('kind', 'link').is('revoked_at', null);
  }

  const nonce = newNonce();
  const code = deriveToken('invite', nonce);
  const { data, error } = await admin
    .from('invites')
    .insert({
      group_id: project.group_id,
      project_id: project.id,
      kind: body.kind,
      email: body.kind === 'email' ? body.email : null,
      nonce: toBytea(nonce),
      code_hash: toBytea(hashToken(code)),
      max_uses: body.kind === 'email' ? 1 : Math.max(1, free),
      created_by: c.var.user.id,
    })
    .select('id, expires_at, max_uses, use_count')
    .single();
  if (error || !data) throw dbError(error);

  if (body.kind === 'email') {
    const { data: me } = await c.var.db.from('profiles').select('full_name').eq('id', c.var.user.id).single();
    try {
      await sendEmail(
        inviteEmail({
          to: body.email,
          inviterName: me?.full_name ?? '',
          groupName: project.group_name,
          projectTitle: project.title,
          link: joinUrl(code),
          expires: formatDate(data.expires_at),
        }),
      );
    } catch (err) {
      await admin.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', data.id);
      throw err;
    }
    return c.json({ id: data.id }, 201);
  }
  return c.json({ id: data.id, url: joinUrl(code), expires_at: data.expires_at, max_uses: data.max_uses, use_count: data.use_count }, 201);
});

// Mounted under /api/invites
export const inviteRoutes = new Hono<AppEnv>();

inviteRoutes.post('/:inviteId/revoke', requireUser, async (c) => {
  const inviteId = parse(idParam, c.req.param('inviteId'));
  // RLS lets only owners of the invite's group see and update it.
  const { data, error } = await c.var.db.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', inviteId).select('id');
  if (error) throw dbError(error);
  if (!data?.length) throw notFound();
  return c.json({ ok: true });
});

async function findInvite(code: string) {
  const { data, error } = await adminClient()
    .from('invites')
    .select('id, group_id, project_id, created_by, expires_at, revoked_at, use_count, max_uses')
    .eq('code_hash', toBytea(hashToken(code)))
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data || data.revoked_at || new Date(data.expires_at) <= new Date() || data.use_count >= data.max_uses) {
    throw new HttpError(410, 'invite_invalid');
  }
  return data;
}

// Public: the join page shows the project summary before sign up. Only summary fields are
// returned: first names and initials, no email addresses, no brief text.
inviteRoutes.get('/:code/preview', async (c) => {
  await rateLimit([{ limit: LIMITS.invitePreviewIp, key: clientIp(c) }]);
  const code = parse(inviteCode, c.req.param('code'));
  const invite = await findInvite(code);
  const admin = adminClient();
  const [{ data: project }, { data: members }, { data: tasks }, { data: inviter }] = await Promise.all([
    admin.from('projects').select('title, module_code, final_deadline, brief, groups(name)').eq('id', invite.project_id).single(),
    admin.from('group_members').select('role, joined_at, profiles(full_name)').eq('group_id', invite.group_id).order('joined_at'),
    admin.from('tasks').select('estimated_hours').eq('project_id', invite.project_id),
    invite.created_by ? admin.from('profiles').select('full_name').eq('id', invite.created_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!project) throw new HttpError(410, 'invite_invalid');
  const brief = (project.brief ?? null) as { deliverables?: unknown[]; deadlines?: unknown[]; criteria?: unknown[] } | null;
  return c.json({
    group_name: project.groups?.name ?? '',
    inviter_name: inviter?.full_name ?? '',
    title: project.title,
    module_code: project.module_code,
    final_deadline: project.final_deadline,
    expires_at: invite.expires_at,
    task_count: tasks?.length ?? 0,
    total_hours: (tasks ?? []).reduce((a, t) => a + Number(t.estimated_hours), 0),
    members: (members ?? []).map((m) => {
      const full = (m.profiles?.full_name ?? '').trim();
      const parts = full.split(/\s+/).filter(Boolean);
      return {
        first_name: parts[0] ?? 'Member',
        initials: ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?',
        role: m.role,
      };
    }),
    brief: brief ? { deliverables: brief.deliverables ?? [], deadlines: brief.deadlines ?? [], criteria: brief.criteria ?? [] } : null,
  });
});

inviteRoutes.post('/:code/accept', requireUser, async (c) => {
  await rateLimit([
    { limit: LIMITS.inviteAcceptUser, key: c.var.user.id },
    { limit: LIMITS.inviteAcceptIp, key: clientIp(c) },
  ]);
  const code = parse(inviteCode, c.req.param('code'));
  // The user id comes from the verified access token, never from the request body.
  const { data, error } = await adminClient().rpc('accept_invite', { p_code_hash: toBytea(hashToken(code)), p_user: c.var.user.id });
  if (error) {
    const mapped = dbError(error);
    if (mapped.code === 'invite_invalid' || mapped.code === 'invite_used_up') throw new HttpError(410, mapped.code);
    throw mapped;
  }
  const row = data?.[0];
  if (!row) throw new HttpError(410, 'invite_invalid');
  return c.json({ project_id: row.project_id, group_id: row.group_id, already_member: row.already_member });
});
