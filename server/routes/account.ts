import { Hono } from 'hono';
import { deleteAccount } from '../../shared/schemas/account.js';
import { emailUpdatesRequest } from '../../shared/schemas/promo.js';
import { type AppEnv, requireUser } from '../context.js';
import { HttpError } from '../http.js';
import { log } from '../logger.js';
import { LIMITS, rateLimit } from '../ratelimit.js';
import { purgeProjectFiles } from '../services/storage.js';
import { adminClient, dbError } from '../supabase.js';
import { parse, readJson } from '../validate.js';

export const accountRoutes = new Hono<AppEnv>();
accountRoutes.use('*', requireUser);

// Stores the choice about occasional emails about Nexa with the time it was made. Consent is
// never a condition for anything else, and it can be withdrawn here as easily as it was given.
export async function saveEmailUpdates(userId: string, emailUpdates: boolean, source: 'redeem' | 'account'): Promise<void> {
  const { error } = await adminClient()
    .from('marketing_consents')
    .upsert({ user_id: userId, email_updates: emailUpdates, decided_at: new Date().toISOString(), source }, { onConflict: 'user_id' });
  if (error) throw new HttpError(500, 'server_error');
}

accountRoutes.put('/email-updates', async (c) => {
  const body = parse(emailUpdatesRequest, await readJson(c));
  await rateLimit([{ limit: LIMITS.consentUser, key: c.var.user.id }]);
  await saveEmailUpdates(c.var.user.id, body.email_updates, 'account');
  return c.json({ ok: true });
});

// All personal data of the signed-in user as JSON (GDPR Articles 15 and 20).
accountRoutes.get('/export', async (c) => {
  await rateLimit([{ limit: LIMITS.exportUser, key: c.var.user.id }]);
  const { data, error } = await c.var.db.rpc('export_my_data');
  if (error || !data) throw dbError(error);
  const day = new Date().toISOString().slice(0, 10);
  return c.body(JSON.stringify(data, null, 2), 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="nexa-data-${day}.json"`,
  });
});

// Immediate deletion (GDPR Article 17). Ownership passes to the longest standing member,
// groups where the user is the only member are deleted with their files, and log entries stay
// in group records without the user's identity ("Former member").
accountRoutes.post('/delete', async (c) => {
  parse(deleteAccount, await readJson(c));
  const userId = c.var.user.id;
  const admin = adminClient();

  const { data: memberships } = await admin.from('group_members').select('group_id').eq('user_id', userId);
  const soleGroups: string[] = [];
  for (const m of memberships ?? []) {
    const { count } = await admin.from('group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', m.group_id);
    if ((count ?? 0) <= 1) soleGroups.push(m.group_id);
  }
  const { data: soleProjects } = soleGroups.length ? await admin.from('projects').select('id').in('group_id', soleGroups) : { data: [] };

  const { error: prepErr } = await admin.rpc('prepare_account_deletion', { p_user: userId });
  if (prepErr) throw dbError(prepErr);
  await purgeProjectFiles((soleProjects ?? []).map((p) => p.id));

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new HttpError(500, 'server_error');
  log({ event: 'account_deleted' });
  return c.json({ ok: true });
});
