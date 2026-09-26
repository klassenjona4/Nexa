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
  let type: 'magiclink' | 'signup' = 'magiclink';
  let result = await admin.auth.admin.generateLink({ type: 'magiclink', email: body.email });
  if (result.error) {
    // No account yet: create one. The random password is never used or shown.
    type = 'signup';
    result = await admin.auth.admin.generateLink({
      type: 'signup',
      email: body.email,
      password: randomBytes(32).toString('base64url'),
    });
  }
  const hashed = result.data?.properties?.hashed_token;
  if (result.error || !hashed) throw new HttpError(502, 'sign_in_unavailable');

  const params = new URLSearchParams({ token_hash: hashed, type });
  if (body.next) params.set('next', body.next);
  await sendEmail(signInEmail(body.email, `${appUrl()}/auth/confirm?${params.toString()}`));
  return c.json({ ok: true });
});
