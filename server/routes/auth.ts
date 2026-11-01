import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { magicLinkRequest } from '../../shared/schemas/auth.js';
import type { AppEnv } from '../context.js';
import { signInEmail } from '../emails/templates.js';
import { appUrl } from '../env.js';
import { HttpError } from '../http.js';
import { clientIp, LIMITS, rateLimit } from '../ratelimit.js';
import { sendEmail } from '../services/email.js';
import { adminClient } from '../supabase.js';
import { parse, readJson } from '../validate.js';

export const authRoutes = new Hono<AppEnv>();

// Long enough for the account to be created in this request, short enough to be useless to anyone else.
const ALLOWANCE_MS = 2 * 60_000;

// Sends a sign in link. The link is generated with the admin API and sent through Resend, so the
// server controls rate limits per IP address and per email address. The response is the same
// whether or not an account exists.
authRoutes.post('/magic-link', async (c) => {
  const body = parse(magicLinkRequest, await readJson(c));
  await rateLimit([
    { limit: LIMITS.magicLinkIp, key: clientIp(c) },
    { limit: LIMITS.magicLinkEmail, key: body.email },
  ]);

  const admin = adminClient();
  // The before-user-created Auth hook only lets an email account be created while an allowance
  // for the address exists, so sign ups that skip this route (and its rate limits) are refused.
  const { error: allowErr } = await admin
    .from('signup_allowances')
    .upsert({ email: body.email, expires_at: new Date(Date.now() + ALLOWANCE_MS).toISOString() });
  if (allowErr) throw new HttpError(502, 'sign_in_unavailable');

  // For an address without an account, Supabase creates the user and returns a signup token.
  let result = await admin.auth.admin.generateLink({ type: 'magiclink', email: body.email });
  if (result.error) {
    // Older Auth versions refuse magic links for new addresses: create the account instead.
    // The random password is never used or shown.
    result = await admin.auth.admin.generateLink({
      type: 'signup',
      email: body.email,
      password: randomBytes(32).toString('base64url'),
    });
  }
  await admin.from('signup_allowances').delete().eq('email', body.email);
  const hashed = result.data?.properties?.hashed_token;
  const verification = result.data?.properties?.verification_type;
  const type = verification === 'signup' ? 'signup' : 'magiclink';
  if (result.error || !hashed) throw new HttpError(502, 'sign_in_unavailable');

  const params = new URLSearchParams({ token_hash: hashed, type });
  if (body.next) params.set('next', body.next);
  await sendEmail(signInEmail(body.email, `${appUrl()}/auth/confirm?${params.toString()}`));
  return c.json({ ok: true });
});
