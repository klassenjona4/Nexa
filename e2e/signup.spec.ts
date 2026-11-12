import { expect, test } from '@playwright/test';
import { createGroup, signIn, uniqueEmail } from './helpers.js';

test('sign up with a magic link, enter a name and create a group', async ({ page }) => {
  const email = uniqueEmail('aoife');
  await signIn(page, email, 'Aoife Byrne');
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();
  await expect(page.getByText('You are not in a group yet')).toBeVisible();
  await page.goto('/projects/new');
  await expect(page.getByText('This is your free project.', { exact: false })).toBeVisible();

  await createGroup(page, 'Media Law group 4', 'Assignment 2 · Case study report');
  await expect(page.getByText('Group created. Next, upload the brief.')).toBeVisible();

  await page.goto('/projects');
  await expect(page.getByRole('link', { name: /Media Law group 4/ }).first()).toBeVisible();

  // The free plan has 1 project. A second one points to the prices instead of the form.
  await page.goto('/projects/new');
  await expect(page.getByRole('heading', { name: 'Your free project is used' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See prices' })).toBeVisible();

  // Account settings show the plan; paying needs the start now consent first.
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Plan and billing' })).toBeVisible();
  await expect(page.getByText('Free plan.')).toBeVisible();
  await page.goto('/pricing');
  await page.getByRole('button', { name: 'Unlock a project' }).click();
  await expect(page.getByRole('alert')).toContainText('Tick the box above the plans');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Unlock a project' }).click();
  // Stripe is not configured in local tests, so the server says so and nothing is charged.
  await expect(page.getByRole('alert')).toContainText('not set up on the server');

  // A signed in visitor to the landing page is offered their projects, never "Sign in".
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('link', { name: 'Your projects' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
});

test('the pricing page asks visitors to sign in before paying', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Pricing' }).first().click();
  await expect(page.getByRole('heading', { name: 'Plans and prices' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to continue' })).toHaveCount(2);
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
