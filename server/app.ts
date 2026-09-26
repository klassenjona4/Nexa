import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from './context.js';
import { flags } from './env.js';
import { HttpError } from './http.js';
import { log, routeTemplate } from './logger.js';
import { authRoutes } from './routes/auth.js';
import { profileRoutes } from './routes/profile.js';
import { groupRoutes } from './routes/groups.js';
import { inviteRoutes, projectInviteRoutes } from './routes/invites.js';
import { projectTaskRoutes, taskRoutes } from './routes/tasks.js';
import { briefRoutes } from './routes/briefs.js';
import { projectStatementRoutes, statementRoutes } from './routes/statements.js';
import { cronRoutes } from './routes/cron.js';
import { projectRoutes } from './routes/projects.js';
import { calendarRoutes, icsRoutes, projectCalendarRoutes } from './routes/calendar.js';
import { readOutbox } from './services/email.js';

export const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  const started = Date.now();
  const requestId = randomUUID();
  c.set('requestId', requestId);
  await next();
  c.header('X-Request-Id', requestId);
  if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-store');
  log({
    event: 'request',
    method: c.req.method,
    route: routeTemplate(c.req.path),
    status: c.res.status,
    ms: Date.now() - started,
    requestId,
  });
});

// JSON bodies are small. Pasted brief text (up to 60,000 characters) has a larger limit.
const tooLarge = () => {
  throw new HttpError(413, 'payload_too_large');
};
const smallBody = bodyLimit({ maxSize: 64 * 1024, onError: tooLarge });
const briefBody = bodyLimit({ maxSize: 256 * 1024, onError: tooLarge });
app.use('/api/*', (c, next) => (c.req.path.endsWith('/briefs/analyse') ? briefBody(c, next) : smallBody(c, next)));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    for (const [k, v] of Object.entries(err.headers)) c.header(k, v);
    const body: { error: string; fields?: string } = { error: err.code };
    if (err.code === 'invalid_input' && err.message !== err.code) body.fields = err.message;
    if (err.code === 'not_configured') log({ event: 'not_configured', code: /[A-Z][A-Z_]{2,}/.exec(err.message)?.[0] });
    return c.json(body, err.status as 400);
  }
  log({ event: 'unhandled_error', route: routeTemplate(c.req.path), requestId: c.get('requestId'), code: err.name });
  return c.json({ error: 'server_error' }, 500);
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/auth', authRoutes);
app.route('/api/profile', profileRoutes);
app.route('/api/groups', groupRoutes);
app.route('/api/projects/:projectId/invites', projectInviteRoutes);
app.route('/api/invites', inviteRoutes);
app.route('/api/projects/:projectId/tasks', projectTaskRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/projects/:projectId/briefs', briefRoutes);
app.route('/api/projects/:projectId/statements', projectStatementRoutes);
app.route('/api/statements', statementRoutes);
app.route('/api/projects/:projectId/calendar', projectCalendarRoutes);
app.route('/api/calendar', calendarRoutes);
app.route('/cal', icsRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/cron', cronRoutes);

// Test support: only when EMAIL_MOCK=1 outside production.
if (flags.emailMock && !flags.production) {
  app.get('/api/test/outbox', (c) => c.json(readOutbox()));
}
