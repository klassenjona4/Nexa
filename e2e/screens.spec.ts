import { expect, test } from '@playwright/test';
import { createGroup, inviteAndJoin, signIn, uniqueEmail } from './helpers.js';

// Visual check at 375, 768 and 1280 px. Run with SCREENSHOTS=1; skipped otherwise.
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture screens.');
test.use({ viewport: { width: 1280, height: 820 } });

const WIDTHS = [375, 768, 1280];

test('capture screens', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await signIn(page, uniqueEmail('shots'), 'Aoife Byrne');
  const projectId = await createGroup(page, 'Media Law group 4', 'Assignment 2 · Case study report');
  await inviteAndJoin(page, browser, projectId, 'Cian Murphy');
  const titles = ['Research online defamation case law', 'Introduction and scope (500 words)', 'Case study analysis (1,200 words)'];
  for (const t of titles) {
    await page.goto(`/p/${projectId}/board`);
    await page.getByRole('button', { name: 'New task' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Title').fill(t);
    await d.getByLabel('Hours').fill('3');
    await d.getByLabel('Due date').fill('10/10/2030');
    await d.getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByRole('heading', { name: t })).toBeVisible();
  }
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'In progress' }).click();
  const taskUrl = page.url();

  const shots: [string, string][] = [
    ['dashboard', '/projects'],
    ['board', `/p/${projectId}/board`],
    ['task', new URL(taskUrl).pathname],
    ['invite', `/p/${projectId}/invite`],
    ['settings', `/p/${projectId}/settings`],
    ['brief', `/p/${projectId}/brief`],
    ['log', `/p/${projectId}/log`],
    ['statement', `/p/${projectId}/statement`],
    ['calendar', `/p/${projectId}/calendar`],
    ['account', '/account'],
    ['landing', '/'],
    ['privacy', '/privacy'],
  ];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w === 375 ? 780 : w === 768 ? 1024 : 820 });
    for (const [name, path] of shots) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `test-results/shots/${name}-${w}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${name} at ${w} px scrolls horizontally`).toBe(false);
    }
  }
});
