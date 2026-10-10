import { Hono } from 'hono';
import { parseIrishDateTime } from '../../shared/dates.js';
import { changeRole, createGroup, deleteGroup, idParam, renameGroup } from '../../shared/schemas/groups.js';
import { groupRole, requireOwnerRole } from '../access.js';
import { type AppEnv, requireUser } from '../context.js';
import { HttpError, notFound } from '../http.js';
import { purgeProjectFiles } from '../services/storage.js';
import { adminClient, dbError } from '../supabase.js';
import { parse, readJson } from '../validate.js';

export const groupRoutes = new Hono<AppEnv>();
groupRoutes.use('*', requireUser);

groupRoutes.post('/', async (c) => {
  const body = parse(createGroup, await readJson(c));
  let deadline: string | null = null;
  if (body.deadline_date) {
    const d = parseIrishDateTime(body.deadline_date, body.deadline_time || '17:00');
    if (!d) throw new HttpError(400, 'invalid_input', 'deadline_date');
    deadline = d.toISOString();
  }
  const { data, error } = await c.var.db.rpc('create_group_with_project', {
    p_group_name: body.group_name,
    p_module_code: body.module_code,
    p_title: body.title,
    p_final_deadline: deadline,
  });
  if (error) throw dbError(error);
  const row = data?.[0];
  if (!row) throw new HttpError(500, 'server_error');
  return c.json({ group_id: row.group_id, project_id: row.project_id }, 201);
});

groupRoutes.patch('/:groupId', async (c) => {
  const groupId = parse(idParam, c.req.param('groupId'));
  const body = parse(renameGroup, await readJson(c));
  requireOwnerRole(await groupRole(c.var.db, groupId, c.var.user.id));
  const { error } = await c.var.db.from('groups').update({ name: body.name }).eq('id', groupId);
  if (error) throw dbError(error);
  return c.json({ ok: true });
});

groupRoutes.patch('/:groupId/members/:userId', async (c) => {
  const groupId = parse(idParam, c.req.param('groupId'));
  const userId = parse(idParam, c.req.param('userId'));
  const body = parse(changeRole, await readJson(c));
  requireOwnerRole(await groupRole(c.var.db, groupId, c.var.user.id));
  const { data, error } = await c.var.db.from('group_members').update({ role: body.role }).eq('group_id', groupId).eq('user_id', userId).select('user_id');
  if (error) throw dbError(error);
  if (!data?.length) throw notFound();
  return c.json({ ok: true });
});

groupRoutes.delete('/:groupId/members/:userId', async (c) => {
  const groupId = parse(idParam, c.req.param('groupId'));
  const userId = parse(idParam, c.req.param('userId'));
  if (userId === c.var.user.id) throw new HttpError(400, 'use_leave');
  requireOwnerRole(await groupRole(c.var.db, groupId, c.var.user.id));
  const { data, error } = await c.var.db.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId).select('user_id');
  if (error) throw dbError(error);
  if (!data?.length) throw notFound();
  return c.json({ ok: true });
});

groupRoutes.post('/:groupId/leave', async (c) => {
  const groupId = parse(idParam, c.req.param('groupId'));
  const { data: projects } = await c.var.db.from('projects').select('id').eq('group_id', groupId);
  const { error } = await c.var.db.rpc('leave_group', { p_group: groupId });
  if (error) throw dbError(error);
  // The last member leaving deletes the group, so its files go too.
  const { data: still } = await adminClient().from('groups').select('id').eq('id', groupId).maybeSingle();
  if (!still) await purgeProjectFiles((projects ?? []).map((p) => p.id));
  return c.json({ ok: true });
});

groupRoutes.delete('/:groupId', async (c) => {
  const groupId = parse(idParam, c.req.param('groupId'));
  const body = parse(deleteGroup, await readJson(c));
  requireOwnerRole(await groupRole(c.var.db, groupId, c.var.user.id));
  const { data: group, error: gErr } = await c.var.db.from('groups').select('name').eq('id', groupId).maybeSingle();
  if (gErr) throw dbError(gErr);
  if (!group) throw notFound();
  if (group.name.trim() !== body.confirm_name.trim()) throw new HttpError(400, 'confirm_mismatch');
  const { data: projects } = await c.var.db.from('projects').select('id').eq('group_id', groupId);
  const { error } = await c.var.db.from('groups').delete().eq('id', groupId);
  if (error) throw dbError(error);
  await purgeProjectFiles((projects ?? []).map((p) => p.id));
  return c.json({ ok: true });
});
