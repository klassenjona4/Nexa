import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createGroup, signIn, uniqueEmail } from './helpers.js';

const secret = /^CRON_SECRET=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1] ?? '';

test('the reminder job emails the owner of a task due within 48 hours, once', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'Runs once.');
  const email = uniqueEmail('remind');
  await signIn(page, email, 'Niamh Walsh');
  const projectId = await createGroup(page, 'Reminder group', 'Assignment 3');
  const due = new Date(Date.now() + 30 * 3600_000);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const dublin = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(due);
  await page.goto(`/p/${projectId}/board`);
  await page.getByRole('button', { name: 'New task' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Title').fill('Draft the literature review');
  await d.getByLabel('Due date').fill(dublin);
  await d.getByLabel('Time').fill(`${p2(12)}:00`);
  await d.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByRole('heading', { name: 'Draft the literature review' })).toBeVisible();

  const denied = await page.request.post('http://localhost:8787/api/cron/reminders', { headers: { Authorization: 'Bearer wrong' } });
  expect(denied.status()).toBe(401);

  const run = () => page.request.post('http://localhost:8787/api/cron/reminders', { headers: { Authorization: `Bearer ${secret}` } });
  expect((await run()).status()).toBe(200);
  const outbox = (await (await page.request.get('http://localhost:8787/api/test/outbox')).json()) as { to: string; subject: string }[];
  expect(outbox.filter((m) => m.to === email && m.subject === 'Due soon: Draft the literature review')).toHaveLength(1);

  expect((await run()).status()).toBe(200);
  const again = (await (await page.request.get('http://localhost:8787/api/test/outbox')).json()) as { to: string; subject: string }[];
  expect(again.filter((m) => m.to === email && m.subject.startsWith('Due soon'))).toHaveLength(1);
});

test('the retention job warns before deleting an inactive project, and keeping it cancels deletion', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'Runs once.');
  const email = uniqueEmail('retain');
  await signIn(page, email, 'Tomás Kelly');
  const projectId = await createGroup(page, 'Retention group', 'Old assignment');
  // Age the project in the local database: last activity 25 days ago, deadline long past.
  const { execSync } = await import('node:child_process');
  execSync(
    `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "update public.projects set last_activity_at = now() - interval '25 days', final_deadline = now() - interval '60 days' where id = '${projectId}'"`,
  );
  const res = await page.request.post('http://localhost:8787/api/cron/retention', { headers: { Authorization: `Bearer ${secret}` } });
  expect(res.status()).toBe(200);
  const outbox = (await (await page.request.get('http://localhost:8787/api/test/outbox')).json()) as { to: string; subject: string }[];
  expect(outbox.some((m) => m.to === email && m.subject.startsWith('Retention group will be deleted on'))).toBe(true);

  await page.goto(`/p/${projectId}/board`);
  await expect(page.getByText(/This project will be deleted on \d{2}\/\d{2}\/\d{4} unless a member keeps it/)).toBeVisible();
  await page.getByRole('button', { name: 'Keep project' }).click();
  await expect(page.getByText('The project is kept. Deletion is cancelled.')).toBeVisible();
  await expect(page.getByText(/unless a member keeps it/)).toHaveCount(0);
});
