import { Hono } from 'hono';
import { helpChatRequest } from '../../shared/schemas/help.js';
import type { AppEnv } from '../context.js';
import { HttpError } from '../http.js';
import { clientIp, LIMITS, rateLimit } from '../ratelimit.js';
import { answerHelpQuestion } from '../services/help.js';
import { adminClient, verifyAccessToken } from '../supabase.js';
import { parse, readJson } from '../validate.js';

// Mounted at /api/help. Open to visitors and signed-in users. The chat receives no account data:
// the only context is content/help.md and the messages the person typed.
export const helpRoutes = new Hono<AppEnv>();

helpRoutes.post('/chat', async (c) => {
  const body = parse(helpChatRequest, await readJson(c));
  const checks = [{ limit: LIMITS.helpChatIp, key: clientIp(c) }];
  // A signed-in user also has a daily limit. The token is only used to identify the user for it.
  const match = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '');
  if (match?.[1]) {
    const user = await verifyAccessToken(match[1]);
    checks.push({ limit: LIMITS.helpChatUser, key: user.id });
  }
  await rateLimit(checks);
  const { data: allowed, error } = await adminClient().rpc('reserve_help_chat');
  if (error) throw new HttpError(500, 'server_error');
  if (!allowed) throw new HttpError(429, 'help_chat_busy');
  const answer = await answerHelpQuestion(body);
  return c.json({ answer });
});
