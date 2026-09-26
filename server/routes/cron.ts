import { Hono } from 'hono';
import { formatDate, formatDateTime } from '../../shared/dates.js';
import type { AppEnv } from '../context.js';
import { reminderEmail, retentionWarningEmail } from '../emails/templates.js';
import { appUrl, requireEnv } from '../env.js';
import { HttpError, unauthorised } from '../http.js';
import { log } from '../logger.js';
import { sendEmail } from '../services/email.js';
import { BRIEF_BUCKET, purgeProjectFiles } from '../services/storage.js';
import { adminClient } from '../supabase.js';
import { safeEqual } from '../tokens.js';

const DAY = 86_400_000;
export const RETENTION_DAYS = 30;
export const WARNING_DAYS_BEFORE = 7;

// Called by Supabase pg_cron through pg_net with the shared CRON_SECRET.
export const cronRoutes = new Hono<AppEnv>();
cronRoutes.use('*', async (c, next) => {
  const secret = requireEnv('CRON_SECRET');
  const header = c.req.header('authorization') ?? '';
  if (!safeEqual(header, `Bearer ${secret}`)) throw unauthorised();
  await next();
});

async function emailOf(userId: string): Promise<string | null> {
  const { data } = await adminClient().auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

// Hourly: one email per member for their open tasks due within 48 hours, once per task.
cronRoutes.post('/reminders', async (c) => {
  const admin = adminClient();
  const now = new Date();
  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, title, due_at, assignee_id, projects(id, groups(name))')
    .is('reminder_sent_at', null)
    .neq('status', 'done')
    .not('assignee_id', 'is', null)
    .gt('due_at', now.toISOString())
    .lte('due_at', new Date(now.getTime() + 2 * DAY).toISOString())
    .limit(500);
  if (error) throw new HttpError(500, 'server_error');

  const byUser = new Map<string, NonNullable<typeof tasks>>();
  for (const t of tasks ?? []) {
    const list = byUser.get(t.assignee_id!) ?? [];
    list.push(t);
    byUser.set(t.assignee_id!, list);
  }
  let sent = 0;
  for (const [userId, list] of byUser) {
    const to = await emailOf(userId);
    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    if (to) {
      try {
        await sendEmail(
          reminderEmail({
            to,
            name: profile?.full_name.split(/\s+/)[0] ?? '',
            tasks: list.map((t) => ({ title: t.title, due: formatDateTime(t.due_at), group: t.projects?.groups?.name ?? '' })),
            link: `${appUrl()}/projects`,
          }),
        );
        sent++;
      } catch {
        continue;
      }
    }
    await admin.from('tasks').update({ reminder_sent_at: now.toISOString() }).in('id', list.map((t) => t.id));
  }
  log({ event: 'cron_reminders', count: sent });
  return c.json({ sent });
});

// Daily: warn 7 days before deletion, delete projects 30 days after the last activity or the
// final deadline (whichever is later), and clean up leftovers.
cronRoutes.post('/retention', async (c) => {
  const admin = adminClient();
  const now = Date.now();
  const { data: projects, error } = await admin.from('projects').select('id, title, group_id, last_activity_at, final_deadline, deletion_warned_at, groups(name)').limit(5000);
  if (error) throw new HttpError(500, 'server_error');

  let warned = 0;
  let deleted = 0;
  for (const p of projects ?? []) {
    const anchor = Math.max(new Date(p.last_activity_at).getTime(), p.final_deadline ? new Date(p.final_deadline).getTime() : 0);
    const deleteAt = anchor + RETENTION_DAYS * DAY;
    if (now >= deleteAt && p.deletion_warned_at && now - new Date(p.deletion_warned_at).getTime() >= (WARNING_DAYS_BEFORE - 1) * DAY) {
      await admin.from('projects').delete().eq('id', p.id);
      await purgeProjectFiles([p.id]);
      const { count } = await admin.from('projects').select('id', { count: 'exact', head: true }).eq('group_id', p.group_id);
      if (!count) await admin.from('groups').delete().eq('id', p.group_id);
      deleted++;
    } else if (!p.deletion_warned_at && now >= deleteAt - WARNING_DAYS_BEFORE * DAY) {
      const { data: members } = await admin.from('group_members').select('user_id').eq('group_id', p.group_id);
      const on = formatDate(new Date(Math.max(deleteAt, now + WARNING_DAYS_BEFORE * DAY)));
      for (const m of members ?? []) {
        const to = await emailOf(m.user_id);
        if (!to) continue;
        try {
          await sendEmail(retentionWarningEmail({ to, group: p.groups?.name ?? '', project: p.title, deleteOn: on, link: `${appUrl()}/p/${p.id}/board` }));
        } catch {
          // A failed email does not stop the warning from being recorded.
        }
      }
      await admin.from('projects').update({ deletion_warned_at: new Date(now).toISOString() }).eq('id', p.id);
      warned++;
    }
  }

  // Unaccepted AI drafts older than 30 days, with their files.
  const cutoff = new Date(now - RETENTION_DAYS * DAY).toISOString();
  const { data: stale } = await admin.from('brief_analyses').select('id, storage_path').is('accepted_at', null).lt('created_at', cutoff).limit(1000);
  const stalePaths = (stale ?? []).map((a) => a.storage_path).filter((x): x is string => !!x);
  if (stalePaths.length) await admin.storage.from(BRIEF_BUCKET).remove(stalePaths);
  if (stale?.length) await admin.from('brief_analyses').delete().in('id', stale.map((a) => a.id));

  // Files of projects that no longer exist.
  const { data: folders } = await admin.storage.from(BRIEF_BUCKET).list('', { limit: 1000 });
  const existing = new Set((projects ?? []).map((p) => p.id));
  const orphans = (folders ?? []).map((f) => f.name).filter((n) => /^[0-9a-f-]{36}$/.test(n) && !existing.has(n));
  if (orphans.length) await purgeProjectFiles(orphans);

  // Rate limit windows older than a day.
  await admin.from('rate_limits').delete().lt('window_start', new Date(now - DAY).toISOString());

  log({ event: 'cron_retention', count: warned + deleted });
  return c.json({ warned, deleted, orphans: orphans.length, stale: stale?.length ?? 0 });
});
