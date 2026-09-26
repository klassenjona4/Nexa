import { expect, test } from '@playwright/test';
import { createGroup, latestLink, newPage, signIn, uniqueEmail } from './helpers.js';

test('an invited student sees the project summary, signs up and joins the group', async ({ page, browser }) => {
  await signIn(page, uniqueEmail('owner'), 'Aoife Byrne');
  const projectId = await createGroup(page, 'Invite test group', 'Assignment 2');
  await page.goto(`/p/${projectId}/invite`);
  const linkField = page.getByLabel('Invite link', { exact: true });
  await expect(linkField).toHaveValue(/\/join\/[A-Za-z0-9_-]{22}$/);
  const inviteUrl = await linkField.inputValue();

  const guest = await newPage(browser, page);
  await guest.goto(inviteUrl.replace(/^https?:\/\/[^/]+/, ''));
  await expect(guest.getByRole('heading', { name: 'Join Invite test group for Assignment 2' })).toBeVisible();
  await expect(guest.getByRole('listitem').filter({ hasText: 'Aoife' })).toContainText('Owner');
  await guest.getByRole('button', { name: /Join/ }).first().click();
  await expect(guest).toHaveURL(/\/sign-in/);

  const guestEmail = uniqueEmail('cian');
  await guest.getByLabel('Email address').fill(guestEmail);
  await guest.getByRole('button', { name: 'Send sign in link' }).click();
  await expect(guest.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const link = await latestLink(guest, guestEmail, /http:\/\/localhost:5173\/auth\/confirm\?\S+/);
  await guest.goto(link);
  await guest.waitForURL(/\/welcome/);
  await guest.getByLabel('Full name').fill('Cian Murphy');
  await guest.getByRole('button', { name: 'Continue' }).click();
  await expect(guest).toHaveURL(new RegExp(`/p/${projectId}/board`));

  await page.goto(`/p/${projectId}/settings`);
  await expect(page.getByText('Cian Murphy')).toBeVisible();
  await expect(page.getByText('2 of 8')).toBeVisible();
});

test('a revoked or unknown invite link shows an error', async ({ page }) => {
  await page.goto('/join/AAAAAAAAAAAAAAAAAAAAAA');
  await expect(page.getByRole('heading', { name: 'This invite link no longer works' })).toBeVisible();
});
