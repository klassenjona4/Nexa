import { Hono } from 'hono';
import { idParam } from '../../shared/schemas/groups.js';
import { type AppEnv, requireUser } from '../context.js';
import { dbError } from '../supabase.js';
import { parse } from '../validate.js';

export const projectRoutes = new Hono<AppEnv>();
projectRoutes.use('*', requireUser);

// Any member can keep a project that is due for deletion. This counts as activity.
projectRoutes.post('/:projectId/keep', async (c) => {
  const projectId = parse(idParam, c.req.param('projectId'));
  const { error } = await c.var.db.rpc('keep_project', { p_project: projectId });
  if (error) throw dbError(error);
  return c.json({ ok: true });
});
