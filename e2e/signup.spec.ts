import { expect, test } from '@playwright/test';
import { createGroup, signIn, uniqueEmail } from './helpers.js';

test('sign up with a magic link, enter a name and create a group', async ({ page }) => {
  const email = uniqueEmail('aoife');
  await signIn(page, email, 'Aoife Byrne');
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();
  await expect(page.getByText('You are not in a group yet')).toBeVisible();

  await createGroup(page, 'Media Law group 4', 'Assignment 2 · Case study report');
  await expect(page.getByText('Group created. Next, upload the brief.')).toBeVisible();

  await page.goto('/projects');
  await expect(page.getByRole('link', { name: /Media Law group 4/ }).first()).toBeVisible();
});

test('sign in rejects an invalid email address', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByRole('button', { name: 'Send sign in link' }).click();
  await expect(page.getByText('Error: Enter an email address in the format name@example.ie.')).toBeVisible();
});

test('download my data and delete my account', async ({ page }) => {
  const email = uniqueEmail('leaver');
  await signIn(page, email, 'Seán Kelly');
  await createGroup(page, 'Solo group', 'Assignment 5');
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download my data' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^nexa-data-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await (await import('node:fs/promises')).readFile(await file.path(), 'utf8'));
  expect(data.profile.email).toBe(email);
  expect(data.memberships[0].group_name).toBe('Solo group');

  await page.getByRole('button', { name: 'Delete my account' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
  await confirm.getByLabel('Type DELETE to confirm').fill('DELETE');
  await confirm.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Your account was deleted.')).toBeVisible();

  // Signing in again creates a new, empty account.
  await signIn(page, email, 'Seán Kelly');
  await expect(page.getByText('You are not in a group yet')).toBeVisible();
});
