import { Hono } from 'hono';
import type { Database } from '../../shared/database.types.js';
import { parseIrishDateTime } from '../../shared/dates.js';
import { idParam } from '../../shared/schemas/groups.js';
import { addLink, createTask, reviewTask, updateTask } from '../../shared/schemas/tasks.js';
import { projectAccess } from '../access.js';
import { type AppEnv, requireUser } from '../context.js';
import { HttpError, notFound } from '../http.js';
import { LIMITS, rateLimit } from '../ratelimit.js';
import { dbError } from '../supabase.js';
import { parse, readJson } from '../validate.js';

type TablesUpdate = Database['public']['Tables']['tasks']['Update'];

function dueAt(date: string | undefined, time: string | undefined): string | null | undefined {
  if (date === undefined) return undefined;
  if (date === '') return null;
  const d = parseIrishDateTime(date, time || '17:00');
  if (!d) throw new HttpError(400, 'invalid_input', 'due_date');
  return d.toISOString();
}

// Mounted under /api/projects/:projectId/tasks
export const projectTaskRoutes = new Hono<AppEnv>();
projectTaskRoutes.use('*', requireUser);

projectTaskRoutes.post('/', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const body = parse(createTask, await readJson(c));
  await rateLimit([{ limit: LIMITS.writeUser, key: c.var.user.id }]);
  const project = await projectAccess(c.var.db, projectId, c.var.user.id);
  const { data: last } = await c.var.db.from('tasks').select('position').eq('project_id', project.id).order('position', { ascending: false }).limit(1);
  const { data, error } = await c.var.db
    .from('tasks')
    .insert({
      project_id: project.id,
      title: body.title,
      description: body.description,
      deliverable: body.deliverable,
      assignee_id: body.assignee_id,
      due_at: dueAt(body.due_date, body.due_time) ?? null,
      estimated_hours: body.estimated_hours,
      position: (last?.[0]?.position ?? -1) + 1,
    })
    .select('id')
    .single();
  if (error || !data) throw dbError(error);
  return c.json({ id: data.id }, 201);
});

// Mounted under /api/tasks
export const taskRoutes = new Hono<AppEnv>();
taskRoutes.use('*', requireUser);

taskRoutes.patch('/:taskId', async (c) => {
  const taskId = parse(idParam, c.req.param('taskId'));
  const body = parse(updateTask, await readJson(c));
  await rateLimit([{ limit: LIMITS.writeUser, key: c.var.user.id }]);
  const { due_date, due_time, ...fields } = body;
  const patch: TablesUpdate = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  const due = dueAt(due_date, due_time);
  if (due !== undefined) patch.due_at = due;
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'invalid_input');
  const { data, error } = await c.var.db.from('tasks').update(patch).eq('id', taskId).select('id');
  if (error) throw dbError(error);
  if (!data?.length) throw notFound();
  return c.json({ ok: true });
});

taskRoutes.delete('/:taskId', async (c) => {
  const taskId = parse(idParam, c.req.param('taskId'));
  const { data, error } = await c.var.db.from('tasks').delete().eq('id', taskId).select('id');
  if (error) throw dbError(error);
  if (!data?.length) throw new HttpError(403, 'forbidden');
  return c.json({ ok: true });
});

taskRoutes.post('/:taskId/links', async (c) => {
  const taskId = parse(idParam, c.req.param('taskId'));
  const body = parse(addLink, await readJson(c));
  await rateLimit([{ limit: LIMITS.writeUser, key: c.var.user.id }]);
  const { error } = await c.var.db.from('task_links').insert({ task_id: taskId, url: body.url, label: body.label ?? '' });
  if (error) throw error.code === '42501' ? notFound() : dbError(error);
  return c.json({ ok: true }, 201);
});

taskRoutes.post('/:taskId/reviews', async (c) => {
  const taskId = parse(idParam, c.req.param('taskId'));
  const body = parse(reviewTask, await readJson(c));
  await rateLimit([{ limit: LIMITS.writeUser, key: c.var.user.id }]);
  const { error } = await c.var.db.rpc('review_task', { p_task: taskId, p_kind: body.kind, p_note: body.note ?? undefined });
  if (error) throw dbError(error);
  return c.json({ ok: true }, 201);
});
