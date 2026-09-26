import { expect, test } from '@playwright/test';
import { createGroup, inviteAndJoin, signIn, uniqueEmail } from './helpers.js';

test('a member completes a task, the owner sees it live and confirms it', async ({ page, browser }) => {
  await signIn(page, uniqueEmail('owner'), 'Aoife Byrne');
  const projectId = await createGroup(page, 'Task test group', 'Assignment 2');
  const member = await inviteAndJoin(page, browser, projectId, 'Cian Murphy');

  // Owner creates a task for the member.
  await page.goto(`/p/${projectId}/board`);
  await page.getByRole('button', { name: 'New task' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Research online defamation case law');
  await dialog.getByLabel('Owner').selectOption({ label: 'Cian Murphy' });
  await dialog.getByLabel('Hours').fill('6');
  await dialog.getByLabel('Due date').fill('10/10/2030');
  await dialog.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByRole('heading', { name: 'Research online defamation case law' })).toBeVisible();
  await page.goto(`/p/${projectId}/board`);

  // Member marks it done and attaches a link.
  await member.goto(`/p/${projectId}/board`);
  await member.getByRole('link', { name: /Research online defamation case law/ }).click();
  await member.getByLabel('File link', { exact: true }).fill('https://docs.google.com/document/d/case-law-summary');
  await member.getByRole('button', { name: 'Add link' }).click();
  await expect(member.getByRole('link', { name: /case-law-summary/ })).toBeVisible();
  await member.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Done' }).click();
  await expect(member.getByText('Teammates can now confirm or flag this task.')).toBeVisible();

  // The owner's board updates without a reload (realtime). On mobile, status is a tab.
  if ((page.viewportSize()?.width ?? 1280) < 600) {
    await page.getByRole('tab', { name: 'Done (1)' }).click({ timeout: 15_000 });
  }
  const card = page.getByRole('link', { name: /Research online defamation case law/ });
  await expect(card).toContainText('0 confirmed · 0 flagged', { timeout: 15_000 });

  await card.click();
  await page.getByRole('button', { name: 'Confirm work was done' }).click();
  await expect(page.getByText(/You confirmed this task on/)).toBeVisible();

  // The member cannot review their own task.
  await member.reload();
  await expect(member.getByRole('button', { name: 'Confirm work was done' })).toHaveCount(0);
});
