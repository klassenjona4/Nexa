import { expect, test } from '@playwright/test';
import { createGroup, signIn, uniqueEmail } from './helpers.js';

test('calendar feed contains titles and dates only, and regenerating revokes the old link', async ({ page }) => {
  await signIn(page, uniqueEmail('cal'), 'Aoife Byrne');
  const projectId = await createGroup(page, 'Calendar group', 'Assignment 4');
  await page.goto(`/p/${projectId}/board`);
  await page.getByRole('button', { name: 'New task' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Title').fill('Ethics discussion (800 words)');
  await d.getByLabel('Description').fill('Private notes that must not appear in the feed');
  await d.getByLabel('Due date').fill('31/10/2030');
  await d.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByRole('heading', { name: 'Ethics discussion (800 words)' })).toBeVisible();

  await page.goto(`/p/${projectId}/calendar`);
  const dialog = page.getByRole('dialog', { name: 'Subscribe to group deadlines' });
  await expect(dialog).toBeVisible();
  const field = dialog.getByLabel('Calendar link');
  await expect(field).toHaveValue(/\/cal\/[A-Za-z0-9_-]{22}\.ics$/);
  const url = new URL(await field.inputValue());

  const ics = await page.request.get(`http://localhost:8787${url.pathname}`);
  expect(ics.status()).toBe(200);
  expect(ics.headers()['content-type']).toContain('text/calendar');
  const body = await ics.text();
  expect(body).toContain('SUMMARY:Ethics discussion (800 words)');
  expect(body).toContain('SUMMARY:Final deadline');
  expect(body).not.toContain('Private notes');
  expect(body).not.toContain('Aoife');

  await dialog.getByRole('button', { name: 'Regenerate link' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Regenerate link' }).click();
  await expect(page.getByText('New calendar link created. The old link no longer works.')).toBeVisible();
  const old = await page.request.get(`http://localhost:8787${url.pathname}`);
  expect(old.status()).toBe(404);
  const fresh = new URL(await page.getByRole('dialog', { name: 'Subscribe to group deadlines' }).getByLabel('Calendar link').inputValue());
  expect(fresh.pathname).not.toBe(url.pathname);
  expect((await page.request.get(`http://localhost:8787${fresh.pathname}`)).status()).toBe(200);

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${projectId}/board`));
});
