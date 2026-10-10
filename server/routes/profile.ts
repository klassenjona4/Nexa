import { Hono } from 'hono';
import { profileUpdate } from '../../shared/schemas/profile.js';
import { type AppEnv, requireUser } from '../context.js';
import { dbError } from '../supabase.js';
import { parse, readJson } from '../validate.js';

export const profileRoutes = new Hono<AppEnv>();
profileRoutes.use('*', requireUser);

profileRoutes.patch('/', async (c) => {
  const body = parse(profileUpdate, await readJson(c));
  const { error } = await c.var.db.from('profiles').update({ full_name: body.full_name }).eq('id', c.var.user.id);
  if (error) throw dbError(error);
  return c.json({ ok: true });
});
