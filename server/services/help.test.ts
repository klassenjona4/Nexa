import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { helpChatRequest } from '../../shared/schemas/help.js';
import type { AppEnv } from '../context.js';
import { HttpError } from '../http.js';
import { cleanAnswer, helpContent, helpSystemPrompt } from './help.js';

const rateLimit = vi.fn(async (_checks: Array<{ limit: { name: string }; key: string }>) => {});
const rpc = vi.fn(async (_name: string) => ({ data: true as boolean, error: null }));
const verifyAccessToken = vi.fn(async (_token: string) => ({ id: 'user-1', email: 'x@example.ie' }));

vi.mock('../ratelimit.js', () => ({
  rateLimit: (checks: Array<{ limit: { name: string }; key: string }>) => rateLimit(checks),
  clientIp: () => '203.0.113.9',
  LIMITS: { helpChatIp: { name: 'help-chat:ip' }, helpChatUser: { name: 'help-chat:user' } },
}));
vi.mock('../supabase.js', () => ({
  adminClient: () => ({ rpc: (name: string) => rpc(name) }),
  verifyAccessToken: (token: string) => verifyAccessToken(token),
}));
vi.mock('../logger.js', () => ({ log: vi.fn() }));

describe('help chat content', () => {
  it('uses content/help.md without its front matter', () => {
    const text = helpContent();
    expect(text).toContain('## Plans and billing');
    expect(text).not.toMatch(/^---/);
  });

  it('builds a system prompt from the help text only', () => {
    const prompt = helpSystemPrompt();
    expect(prompt).toContain('<help>');
    expect(prompt).toContain('cannot see the person');
    // The prompt is identical on every request, so it can be cached.
    expect(helpSystemPrompt()).toBe(prompt);
  });

  it('removes dashes and emoji from answers', () => {
    expect(cleanAnswer('Open Account settings \u2014 then Manage billing.')).toBe('Open Account settings, then Manage billing.');
    expect(cleanAnswer('Pages 3\u20135')).toBe('Pages 3 to 5');
    expect(cleanAnswer('Done \u{1F600}')).toBe('Done');
  });
});

describe('help chat request', () => {
  it('accepts alternating turns that end with a question', () => {
    expect(helpChatRequest.safeParse({ messages: [{ role: 'user', content: 'How do I invite members?' }] }).success).toBe(true);
    expect(
      helpChatRequest.safeParse({
        messages: [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
          { role: 'user', content: 'c' },
        ],
      }).success,
    ).toBe(true);
  });

  it('refuses long, empty, out of order or extra input', () => {
    expect(helpChatRequest.safeParse({ messages: [{ role: 'user', content: 'x'.repeat(1001) }] }).success).toBe(false);
    expect(helpChatRequest.safeParse({ messages: [{ role: 'user', content: '   ' }] }).success).toBe(false);
    expect(helpChatRequest.safeParse({ messages: [{ role: 'assistant', content: 'hi' }] }).success).toBe(false);
    expect(helpChatRequest.safeParse({ messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] }).success).toBe(false);
    expect(helpChatRequest.safeParse({ messages: [{ role: 'user', content: 'a' }], projectId: 'x' }).success).toBe(false);
    expect(helpChatRequest.safeParse({ messages: Array.from({ length: 13 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'a' })) }).success).toBe(false);
  });
});

describe('POST /api/help/chat', () => {
  beforeEach(() => {
    process.env.NEXA_TEST_MODE = '1';
    process.env.AI_MOCK = '1';
    rateLimit.mockClear();
    rpc.mockClear();
    rpc.mockResolvedValue({ data: true, error: null });
    verifyAccessToken.mockClear();
  });

  async function app() {
    const { helpRoutes } = await import('../routes/help.js');
    const a = new Hono<AppEnv>();
    a.onError((err, c) => (err instanceof HttpError ? c.json({ error: err.code }, err.status as 400) : c.json({ error: 'server_error' }, 500)));
    a.route('/api/help', helpRoutes);
    return a;
  }
  const ask = (a: Hono<AppEnv>, headers: Record<string, string> = {}) =>
    a.request('/api/help/chat', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ messages: [{ role: 'user', content: 'How do I start?' }] }) });

  it('answers a visitor, limited per IP address and counted against its own daily ceiling', async () => {
    const res = await ask(await app());
    expect(res.status).toBe(200);
    expect((await res.json()).answer).toContain('New group and project');
    expect(rateLimit.mock.calls[0]?.[0].map((c) => c.limit.name)).toEqual(['help-chat:ip']);
    expect(rpc).toHaveBeenCalledWith('reserve_help_chat');
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('adds the per user daily limit for a signed-in user', async () => {
    const res = await ask(await app(), { authorization: 'Bearer a.b.c' });
    expect(res.status).toBe(200);
    expect(rateLimit.mock.calls[0]?.[0].map((c) => `${c.limit.name}:${c.key}`)).toEqual(['help-chat:ip:203.0.113.9', 'help-chat:user:user-1']);
  });

  it('stops when the daily ceiling is reached', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await ask(await app());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'help_chat_busy' });
  });

  it('stops when a rate limit is reached, before counting', async () => {
    rateLimit.mockRejectedValueOnce(new HttpError(429, 'rate_limited'));
    const res = await ask(await app());
    expect(res.status).toBe(429);
    expect(rpc).not.toHaveBeenCalled();
  });
});
