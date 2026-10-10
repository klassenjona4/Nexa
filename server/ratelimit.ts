import type { Context } from 'hono';
import { flags } from './env.js';
import { HttpError } from './http.js';
import { adminClient } from './supabase.js';
import { bucketKey } from './tokens.js';

export type Limit = { name: string; max: number; windowSeconds: number };

export function clientIp(c: Context): string {
  const fwd = c.req.header('x-forwarded-for');
  const first = fwd?.split(',')[0]?.trim();
  return c.req.header('x-real-ip') ?? first ?? 'unknown';
}

// Local end to end tests create many accounts from one IP address. RATE_LIMIT_MULTIPLIER raises
// the limits there. It is ignored in production.
function multiplier(): number {
  if (flags.production) return 1;
  const m = Number(process.env.RATE_LIMIT_MULTIPLIER ?? '1');
  return Number.isFinite(m) && m >= 1 ? Math.min(m, 1000) : 1;
}

// Consumes one request from each bucket. Throws 429 when any limit is exceeded.
export async function rateLimit(checks: Array<{ limit: Limit; key: string }>): Promise<void> {
  for (const { limit, key } of checks) {
    const { data, error } = await adminClient().rpc('rate_limit_hit', {
      p_bucket: bucketKey([limit.name, key]),
      p_max: limit.max * multiplier(),
      p_window_seconds: limit.windowSeconds,
    });
    if (error) throw new HttpError(500, 'server_error');
    if (data === false) {
      throw new HttpError(429, 'rate_limited', undefined, { 'Retry-After': String(limit.windowSeconds) });
    }
  }
}

export const LIMITS = {
  magicLinkIp: { name: 'magic-link:ip', max: 5, windowSeconds: 3600 },
  magicLinkEmail: { name: 'magic-link:email', max: 3, windowSeconds: 3600 },
  aiUser: { name: 'ai:user', max: 10, windowSeconds: 3600 },
  aiIp: { name: 'ai:ip', max: 30, windowSeconds: 3600 },
  invitePreviewIp: { name: 'invite-preview:ip', max: 30, windowSeconds: 3600 },
  inviteAcceptUser: { name: 'invite-accept:user', max: 10, windowSeconds: 3600 },
  inviteAcceptIp: { name: 'invite-accept:ip', max: 20, windowSeconds: 3600 },
  inviteCreateGroup: { name: 'invite-create:group', max: 20, windowSeconds: 86400 },
  calendarToken: { name: 'calendar:token', max: 120, windowSeconds: 3600 },
  exportUser: { name: 'export:user', max: 5, windowSeconds: 86400 },
  writeUser: { name: 'write:user', max: 600, windowSeconds: 3600 },
} satisfies Record<string, Limit>;
