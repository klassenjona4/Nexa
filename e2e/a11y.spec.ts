import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { createGroup, inviteAndJoin, signIn, uniqueEmail } from './helpers.js';

// Automated WCAG 2.1 A and AA checks. Manual checks (screen reader flow, zoom to 200 %)
// are listed in README.md.
async function audit(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
  expect(summary, `${name} has accessibility violations`).toEqual([]);
}

test('public pages meet WCAG 2.1 AA automated checks', async ({ page }) => {
  for (const path of ['/', '/sign-in', '/privacy', '/terms', '/join', '/join/AAAAAAAAAAAAAAAAAAAAAA']) {
    await page.goto(path);
    await audit(page, path);
  }
});

test('signed in screens meet WCAG 2.1 AA automated checks', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signIn(page, uniqueEmail('a11y'), 'Aoife Byrne');
  await audit(page, 'dashboard (empty)');
  const projectId = await createGroup(page, 'Accessibility group', 'Assignment 6');
  await audit(page, 'brief upload');
  const member = await inviteAndJoin(page, browser, projectId, 'Cian Murphy');
  await member.close();
  await page.goto(`/p/${projectId}/board`);
  await page.getByRole('button', { name: 'New task' }).click();
  await audit(page, 'new task dialog');
  const d = page.getByRole('dialog');
  await d.getByLabel('Title').fill('Research case law');
  await d.getByLabel('Due date').fill('10/10/2030');
  await d.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByRole('heading', { name: 'Research case law' })).toBeVisible();
  await audit(page, 'task detail');
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Done' }).click();
  for (const [name, path] of [
    ['dashboard', '/projects'],
    ['board', `/p/${projectId}/board`],
    ['invite', `/p/${projectId}/invite`],
    ['log', `/p/${projectId}/log`],
    ['statement', `/p/${projectId}/statement`],
    ['settings', `/p/${projectId}/settings`],
    ['calendar', `/p/${projectId}/calendar`],
    ['account', '/account'],
  ] as const) {
    await page.goto(path);
    await audit(page, name);
  }
});
