import { Hono } from 'hono';
import { buildCalendar, type CalendarEvent } from '../../shared/ics.js';
import { idParam } from '../../shared/schemas/groups.js';
import { projectAccess } from '../access.js';
import { type AppEnv, requireUser } from '../context.js';
import { appUrl } from '../env.js';
import { HttpError, notFound } from '../http.js';
import { LIMITS, rateLimit } from '../ratelimit.js';
import { adminClient, dbError } from '../supabase.js';
import { deriveToken, fromBytea, hashToken, newNonce, toBytea, TOKEN_RE } from '../tokens.js';
import { parse } from '../validate.js';

const feedUrl = (token: string) => `${appUrl()}/cal/${token}.ics`;

async function createFeed(userId: string, projectId: string): Promise<string> {
  const nonce = newNonce();
  const token = deriveToken('calendar', nonce);
  const { error } = await adminClient().from('calendar_feeds').insert({ user_id: userId, project_id: projectId, nonce: toBytea(nonce), token_hash: toBytea(hashToken(token)) });
  if (error) throw dbError(error);
  return token;
}

async function counts(projectId: string, userId: string) {
  const admin = adminClient();
  const [{ data: project }, { count }] = await Promise.all([
    admin.from('projects').select('brief, final_deadline').eq('id', projectId).single(),
    admin.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('assignee_id', userId).not('due_at', 'is', null),
  ]);
  const deadlines = ((project?.brief as { deadlines?: { due_at: string | null }[] } | null)?.deadlines ?? []).filter((d) => d.due_at).length;
  return { deadlines: deadlines || (project?.final_deadline ? 1 : 0), tasks: count ?? 0 };
}

// Mounted under /api/projects/:projectId/calendar
export const projectCalendarRoutes = new Hono<AppEnv>();
projectCalendarRoutes.use('*', requireUser);

// Returns the member's personal feed link for this project, creating it on first use.
projectCalendarRoutes.post('/', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  const { data: existing } = await adminClient().from('calendar_feeds').select('nonce').eq('user_id', c.var.user.id).eq('project_id', project.id).is('revoked_at', null).maybeSingle();
  const token = existing ? deriveToken('calendar', fromBytea(existing.nonce)) : await createFeed(c.var.user.id, project.id);
  return c.json({ url: feedUrl(token), ...(await counts(project.id, c.var.user.id)) });
});

projectCalendarRoutes.post('/regenerate', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  await adminClient().from('calendar_feeds').update({ revoked_at: new Date().toISOString() }).eq('user_id', c.var.user.id).eq('project_id', project.id).is('revoked_at', null);
  const token = await createFeed(c.var.user.id, project.id);
  return c.json({ url: feedUrl(token), ...(await counts(project.id, c.var.user.id)) });
});

// Mounted under /api/calendar
export const calendarRoutes = new Hono<AppEnv>();
calendarRoutes.post('/:feedId/revoke', requireUser, async (c) => {
  const feedId = parse(idParam, c.req.param('feedId'));
  const { data, error } = await adminClient().from('calendar_feeds').update({ revoked_at: new Date().toISOString() }).eq('id', feedId).eq('user_id', c.var.user.id).is('revoked_at', null).select('id');
  if (error) throw dbError(error);
  if (!data?.length) throw notFound();
  return c.json({ ok: true });
});

// Public feed: /cal/<token>.ics. Contains only task titles and dates, no names or descriptions.
export const icsRoutes = new Hono<AppEnv>();
icsRoutes.get('/:file', async (c) => {
  const token = c.req.param('file').replace(/\.ics$/, '');
  if (!TOKEN_RE.test(token)) throw notFound();
  await rateLimit([{ limit: LIMITS.calendarToken, key: token }]);
  const admin = adminClient();
  const { data: feed } = await admin.from('calendar_feeds').select('id, user_id, project_id, revoked_at, last_read_at').eq('token_hash', toBytea(hashToken(token))).maybeSingle();
  if (!feed || feed.revoked_at) throw new HttpError(404, 'not_found');
  // A member who left the group loses the feed.
  const { data: project } = await admin.from('projects').select('id, group_id, brief, final_deadline').eq('id', feed.project_id).maybeSingle();
  if (!project) throw notFound();
  const { data: member } = await admin.from('group_members').select('user_id').eq('group_id', project.group_id).eq('user_id', feed.user_id).maybeSingle();
  if (!member) throw notFound();

  const { data: tasks } = await admin.from('tasks').select('id, title, due_at').eq('project_id', project.id).eq('assignee_id', feed.user_id).not('due_at', 'is', null);
  const events: CalendarEvent[] = [];
  const deadlines = ((project.brief as { deadlines?: { item: string; due_at: string | null }[] } | null)?.deadlines ?? []).filter((d) => d.due_at);
  deadlines.forEach((d, i) => events.push({ uid: `${project.id}-deadline-${i}@nexa`, title: `Deadline: ${d.item}`, start: new Date(d.due_at!) }));
  if (deadlines.length === 0 && project.final_deadline) events.push({ uid: `${project.id}-final@nexa`, title: 'Final deadline', start: new Date(project.final_deadline) });
  for (const t of tasks ?? []) events.push({ uid: `${t.id}@nexa`, title: t.title, start: new Date(t.due_at!) });

  if (!feed.last_read_at || Date.now() - new Date(feed.last_read_at).getTime() > 3600_000) {
    await admin.from('calendar_feeds').update({ last_read_at: new Date().toISOString() }).eq('id', feed.id);
  }
  return c.body(buildCalendar('Nexa deadlines', events), 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Cache-Control': 'private, max-age=900',
    'X-Robots-Tag': 'noindex',
  });
});
