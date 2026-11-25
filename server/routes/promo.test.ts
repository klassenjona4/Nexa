import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../context.js';
import { HttpError } from '../http.js';

// In memory stand-ins for the database functions the route calls. The real functions are
// proved in supabase/tests/database/07_event_promo.test.sql.
const counters = new Map<string, number>();
const consents: Array<{ user_id: string; email_updates: boolean; source: string }> = [];
let redeemResult: { data: unknown; error: { code: string; message: string } | null } = { data: null, error: null };
const redeemCalls: Array<{ p_user: string; p_code: string }> = [];

const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
  if (name === 'rate_limit_count') return { data: counters.get(args.p_bucket as string) ?? 0, error: null };
  if (name === 'rate_limit_hit') {
    const n = (counters.get(args.p_bucket as string) ?? 0) + 1;
    counters.set(args.p_bucket as string, n);
    return { data: n <= (args.p_max as number), error: null };
  }
  if (name === 'redeem_promo_code') {
    redeemCalls.push(args as { p_user: string; p_code: string });
    return redeemResult;
  }
  throw new Error(`unexpected rpc ${name}`);
});

let currentUser = 'user-1';
vi.mock('../supabase.js', () => ({
  adminClient: () => ({
    rpc: (name: string, args: Record<string, unknown>) => rpc(name, args),
    from: () => ({
      upsert: async (row: { user_id: string; email_updates: boolean; source: string }) => {
        consents.push(row);
        return { error: null };
      },
    }),
  }),
  verifyAccessToken: async () => ({ id: currentUser, email: `${currentUser}@example.ie` }),
  userClient: () => ({}),
  dbError: () => new HttpError(500, 'server_error'),
}));
vi.mock('../logger.js', () => ({ log: vi.fn() }));

const VALID = { data: [{ premium_until: '2026-12-27T20:00:00.000Z', premium_days: 30 }], error: null };
const INVALID = { data: null, error: { code: 'P0001', message: 'promo_invalid' } };

async function app() {
  const { promoRoutes } = await import('./promo.js');
  const a = new Hono<AppEnv>();
  a.onError((err, c) => {
    if (err instanceof HttpError) {
      for (const [k, v] of Object.entries(err.headers)) c.header(k, v);
      return c.json({ error: err.code }, err.status as 400);
    }
    return c.json({ error: 'server_error' }, 500);
  });
  a.route('/api/promo', promoRoutes);
  return a;
}

function redeem(a: Hono<AppEnv>, body: unknown, opts: { user?: string; ip?: string; auth?: boolean } = {}) {
  currentUser = opts.user ?? 'user-1';
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': opts.ip ?? '198.51.100.7' };
  if (opts.auth !== false) headers.authorization = 'Bearer a.b.c';
  return a.request('/api/promo/redeem', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('POST /api/promo/redeem', () => {
  beforeEach(() => {
    process.env.TOKEN_SECRET = 'x'.repeat(48);
    counters.clear();
    consents.length = 0;
    redeemCalls.length = 0;
    rpc.mockClear();
    redeemResult = VALID;
  });

  it('needs an account', async () => {
    const res = await redeem(await app(), { code: 'BCDFGHJK23' }, { auth: false });
    expect(res.status).toBe(401);
    expect(redeemCalls).toHaveLength(0);
  });

  it('redeems a valid code for the signed-in user and returns the Premium end date', async () => {
    const res = await redeem(await app(), { code: '  bcdf-ghjk 23 ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ premium_until: '2026-12-27T20:00:00.000Z', premium_days: 30 });
    expect(redeemCalls).toEqual([{ p_user: 'user-1', p_code: 'BCDFGHJK23' }]);
  });

  it('gives the same answer for an unknown, expired, used up or deactivated code', async () => {
    redeemResult = INVALID;
    const a = await app();
    const res = await redeem(a, { code: 'BCDFGHJK23' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'promo_invalid' });
    // A code that cannot exist gets the same answer without reaching the database function.
    const malformed = await redeem(a, { code: 'HELLO' });
    expect(await malformed.json()).toEqual({ error: 'promo_invalid' });
    expect(redeemCalls).toHaveLength(1);
  });

  it('tells a user who already redeemed, without counting it as a failure', async () => {
    redeemResult = { data: null, error: { code: 'P0001', message: 'promo_already_redeemed' } };
    const a = await app();
    for (let i = 0; i < 7; i++) {
      const res = await redeem(a, { code: 'BCDFGHJK23' });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'promo_already_redeemed' });
    }
  });

  it('blocks a user after 5 failed attempts in 15 minutes', async () => {
    redeemResult = INVALID;
    const a = await app();
    for (let i = 0; i < 5; i++) {
      // Different IP addresses, so only the per user limit applies.
      expect((await redeem(a, { code: 'BCDFGHJK23' }, { ip: `203.0.113.${i}` })).status).toBe(400);
    }
    redeemResult = VALID;
    const blocked = await redeem(a, { code: 'BCDFGHJK23' }, { ip: '203.0.113.99' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('900');
    expect(redeemCalls).toHaveLength(5);
  });

  it('blocks an IP address after 5 failed attempts from different users', async () => {
    redeemResult = INVALID;
    const a = await app();
    for (let i = 0; i < 5; i++) expect((await redeem(a, { code: 'BCDFGHJK23' }, { user: `guesser-${i}` })).status).toBe(400);
    redeemResult = VALID;
    expect((await redeem(a, { code: 'BCDFGHJK23' }, { user: 'someone-new' })).status).toBe(429);
  });

  it('never counts successful redemptions, so a whole room on one WiFi can redeem', async () => {
    const a = await app();
    for (let i = 0; i < 60; i++) {
      const res = await redeem(a, { code: 'BCDFGHJK23' }, { user: `attendee-${i}`, ip: '192.0.2.1' });
      expect(res.status).toBe(200);
    }
    // A few typos in the room still leave room for everyone else.
    redeemResult = INVALID;
    for (let i = 0; i < 4; i++) expect((await redeem(a, { code: 'BCDFGHJK2X' }, { user: `typo-${i}`, ip: '192.0.2.1' })).status).toBe(400);
    redeemResult = VALID;
    expect((await redeem(a, { code: 'BCDFGHJK23' }, { user: 'late-arrival', ip: '192.0.2.1' })).status).toBe(200);
  });

  it('saves the email choice only when it is sent, and never requires it', async () => {
    const a = await app();
    expect((await redeem(a, { code: 'BCDFGHJK23' })).status).toBe(200);
    expect(consents).toHaveLength(0);
    expect((await redeem(a, { code: 'BCDFGHJK23', email_updates: false }, { user: 'user-2' })).status).toBe(200);
    expect((await redeem(a, { code: 'BCDFGHJK23', email_updates: true }, { user: 'user-3' })).status).toBe(200);
    expect(consents.map((c) => [c.user_id, c.email_updates, c.source])).toEqual([
      ['user-2', false, 'redeem'],
      ['user-3', true, 'redeem'],
    ]);
  });

  it('refuses unexpected fields', async () => {
    const res = await redeem(await app(), { code: 'BCDFGHJK23', premium_days: 365 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input' });
    expect(redeemCalls).toHaveLength(0);
  });
});
