import { Hono } from 'hono';
import { normalisePromoCode, PROMO_CODE_RE } from '../../shared/promo.js';
import { redeemPromoRequest, type RedeemPromoResponse } from '../../shared/schemas/promo.js';
import { type AppEnv, requireUser } from '../context.js';
import { HttpError } from '../http.js';
import { log } from '../logger.js';
import { clientIp, LIMITS, recordFailure, refuseWhenFailuresUsedUp } from '../ratelimit.js';
import { adminClient } from '../supabase.js';
import { parse, readJson } from '../validate.js';
import { saveEmailUpdates } from './account.js';

// Mounted under /api/promo. Redeeming a code needs an account; the code gives Premium for its
// number of days. Every rule (window, cap, deactivation, once per campaign, the use count) is
// applied in one database call, public.redeem_promo_code.
export const promoRoutes = new Hono<AppEnv>();
promoRoutes.use('*', requireUser);

promoRoutes.post('/redeem', async (c) => {
  const body = parse(redeemPromoRequest, await readJson(c));
  const user = c.var.user;
  const checks = [
    { limit: LIMITS.promoFailUser, key: user.id },
    { limit: LIMITS.promoFailIp, key: clientIp(c) },
  ];
  // Only failed attempts are counted. Successful ones never use up the shared venue IP limit.
  await refuseWhenFailuresUsedUp(checks);

  // The email choice is independent of the code and is saved whether or not the code works.
  if (body.email_updates !== undefined) await saveEmailUpdates(user.id, body.email_updates, 'redeem');

  // One message for every reason a code does not work, so the answer does not reveal whether a code exists.
  const invalid = async (): Promise<never> => {
    await recordFailure(checks);
    log({ event: 'promo_failed' });
    throw new HttpError(400, 'promo_invalid');
  };

  const code = normalisePromoCode(body.code);
  if (!PROMO_CODE_RE.test(code)) return invalid();

  const { data, error } = await adminClient().rpc('redeem_promo_code', { p_user: user.id, p_code: code });
  if (error) {
    if (error.code === 'P0001' && error.message === 'promo_invalid') return invalid();
    if (error.code === 'P0001' && error.message === 'promo_already_redeemed') throw new HttpError(409, 'promo_already_redeemed');
    throw new HttpError(500, 'server_error');
  }
  const row = data?.[0];
  if (!row) throw new HttpError(500, 'server_error');
  log({ event: 'promo_redeemed' });
  const res: RedeemPromoResponse = { premium_until: row.premium_until, premium_days: row.premium_days };
  return c.json(res);
});
