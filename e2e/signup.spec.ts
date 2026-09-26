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
