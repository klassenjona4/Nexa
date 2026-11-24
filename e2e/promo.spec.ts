import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { generatePromoCode } from '../shared/promo.js';
import { createGroup, latestLink, uniqueEmail } from './helpers.js';

// The event flow on a phone: scan the QR code, sign up with only an email address, redeem the
// prefilled code, see the Premium end date. Codes are created with the service role, as the
// operator script does, each in its own campaign.
const env = readFileSync('.env.local', 'utf8');
const read = (name: string) => new RegExp(`^${name}=(.+)$`, 'm').exec(env)?.[1] ?? '';
const admin = createClient(read('SUPABASE_URL'), read('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

async function newCode(opts: { maxUses?: number; fromMinutes?: number; untilMinutes?: number; active?: boolean } = {}): Promise<string> {
  const code = generatePromoCode();
  const now = Date.now();
  const { error } = await admin.from('promo_codes').insert({
    code,
    campaign: `e2e-${code.toLowerCase()}`,
    max_uses: opts.maxUses ?? 5,
    valid_from: new Date(now + (opts.fromMinutes ?? -60) * 60_000).toISOString(),
    valid_until: new Date(now + (opts.untilMinutes ?? 60) * 60_000).toISOString(),
    active: opts.active ?? true,
  });
  if (error) throw new Error(error.message);
  return code;
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('scan, sign up with an email address and redeem the prefilled code on a phone', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile', 'The event flow is a phone flow.');
  const code = await newCode();
  const email = uniqueEmail('attendee');
  const started = Date.now();

  // Scanning the QR code opens the redeem link. Without an account it asks for an email address only.
  await page.goto(`/redeem?code=${code}`);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(page.getByText('Create an account or sign in to redeem your code.')).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send sign in link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  // The sign in link carries the redeem address, so the code survives a switch to the mail app's browser.
  const link = await latestLink(page, email, /http:\/\/localhost:5173\/auth\/confirm\?\S+/);
  expect(decodeURIComponent(link)).toContain(`/redeem?code=${code}`);
  await page.goto(link);
  await expect(page).toHaveURL(new RegExp(`/redeem\\?code=${code}`));

  // No name is needed before redeeming. The code is filled in and the email box is not ticked.
  await expect(page.getByRole('heading', { name: 'Redeem your code' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Code', exact: true })).toHaveValue(code);
  const emails = page.getByLabel('Send me occasional emails about Nexa.');
  await expect(emails).not.toBeChecked();
  await expect(page.getByText('free for 30 days and then simply ends', { exact: false })).toBeVisible();
  await expect(page.getByText('nothing renews automatically', { exact: false })).toBeVisible();
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole('button', { name: 'Redeem code' }).click();
  const confirmation = page.getByRole('status').filter({ hasText: 'Premium is active' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('heading', { name: /^Premium until \w+day \d{2}\/\d{2}\/\d{4}$/ })).toBeVisible();
  await expect(confirmation).toContainText('runs for 30 days');
  await expect(confirmation).toContainText('goes back to the Free plan');
  await expect(confirmation).toContainText('No payment details were collected and nothing renews automatically.');
  await noHorizontalScroll(page);
  // Local timing only; email delivery adds a few seconds at the event.
  expect(Date.now() - started).toBeLessThan(60_000);

  // The exact date shown is the one stored on the server.
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const userId = users.users.find((u) => u.email === email)?.id;
  const { data: billing } = await admin.from('billing_accounts').select('premium_until').eq('user_id', userId!).single();
  const until = new Date(billing!.premium_until!);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const dublin = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(until);
  await expect(confirmation).toContainText(dublin);
  expect(Math.abs(until.getTime() - (Date.now() + 30 * 86400_000))).toBeLessThan(5 * 60_000);
  const { data: consent } = await admin.from('marketing_consents').select('email_updates, source').eq('user_id', userId!).single();
  expect(consent).toEqual({ email_updates: false, source: 'redeem' });
  void p2;

  // Afterwards the name is asked for once, then the app opens.
  await page.getByRole('link', { name: 'Continue' }).click();
  await page.getByLabel('Full name').fill('Event Attendee');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();

  // Premium is applied by the database: more than the one free project is allowed.
  await createGroup(page, 'Event group 1', 'Pitch follow up');
  await createGroup(page, 'Event group 2', 'Second project');

  // Account settings show the end date and that nothing renews.
  await page.goto('/account');
  await expect(page.getByText('Premium, free from a code, until', { exact: false })).toBeVisible();
  await expect(page.getByText('Premium ends')).toBeVisible();
  await expect(page.getByText('It does not renew', { exact: false })).toBeVisible();
  await noHorizontalScroll(page);

  // Redeeming the same campaign again is refused.
  const redeemSection = page.getByRole('region', { name: 'Redeem code' });
  await redeemSection.getByRole('textbox', { name: 'Code', exact: true }).fill(code);
  await redeemSection.getByRole('button', { name: 'Redeem code' }).click();
  await expect(redeemSection.getByText('You have already redeemed this code.', { exact: false })).toBeVisible();

  // The email choice can be changed in account settings.
  const settingsEmails = page.getByRole('region', { name: 'Emails about Nexa' }).getByLabel('Send me occasional emails about Nexa.');
  await expect(settingsEmails).not.toBeChecked();
  await settingsEmails.check();
  await expect(page.getByText('You will receive occasional emails about Nexa.')).toBeVisible();
  await expect(settingsEmails).toBeChecked();
});

test('codes outside their window, at their cap or deactivated give the same message', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'Runs once.');
  const early = await newCode({ fromMinutes: 30 });
  const late = await newCode({ fromMinutes: -120, untilMinutes: -1 });
  const off = await newCode({ active: false });
  const full = await newCode({ maxUses: 1 });
  await admin.from('promo_codes').update({ uses: 1 }).eq('code', full);

  const email = uniqueEmail('checker');
  await page.goto(`/redeem?code=${early}`);
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send sign in link' }).click();
  await page.goto(await latestLink(page, email, /http:\/\/localhost:5173\/auth\/confirm\?\S+/));
  await expect(page.getByRole('heading', { name: 'Redeem your code' })).toBeVisible();

  // The local test stack raises rate limits (RATE_LIMIT_MULTIPLIER); unit tests prove the limit of 5.
  for (const code of [early, late, off, full, 'BCDFGHJK22']) {
    await page.getByRole('textbox', { name: 'Code', exact: true }).fill(code);
    await page.getByRole('button', { name: 'Redeem code' }).click();
    await expect(page.getByText('This code is invalid or has expired.')).toBeVisible();
  }
  const { data } = await admin.from('promo_codes').select('uses').in('code', [early, late, off]);
  expect(data?.map((r) => r.uses)).toEqual([0, 0, 0]);
});

test('the public site does not mention or advertise the promo', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'Runs once.');
  for (const path of ['/', '/pricing', '/help', '/sign-in']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const word of ['promo', 'redeem', 'free premium', 'free month']) expect(text, `${path} mentions ${word}`).not.toContain(word);
  }
});
