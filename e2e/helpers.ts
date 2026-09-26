import { type Browser, expect, type Page } from '@playwright/test';

type Mail = { to: string; subject: string; text: string };

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.ie`;
}

// Reads the in-memory outbox of the API (EMAIL_MOCK=1) and returns the newest link for an address.
export async function latestLink(page: Page, to: string, pattern: RegExp): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await page.request.get('http://localhost:8787/api/test/outbox');
    const mails = (await res.json()) as Mail[];
    const mail = [...mails].reverse().find((m) => m.to === to);
    const match = mail?.text.match(pattern);
    if (match) return match[0];
    await page.waitForTimeout(250);
  }
  throw new Error(`No email for ${to}`);
}

// Signs in with a magic link. New accounts are asked for a name once.
export async function signIn(page: Page, email: string, name: string, next?: string): Promise<void> {
  await page.goto(next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send sign in link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const link = await latestLink(page, email, /http:\/\/localhost:5173\/auth\/confirm\?\S+/);
  await page.goto(link);
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  await page.waitForLoadState('networkidle');
  if (new URL(page.url()).pathname === '/welcome') {
    await page.getByLabel('Full name').fill(name);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL((url) => url.pathname !== '/welcome');
  }
}

export async function createGroup(page: Page, group: string, title: string): Promise<string> {
  await page.goto('/projects/new');
  await page.getByLabel('Group name').fill(group);
  await page.getByLabel('Module code').fill('MDIA7012');
  await page.getByLabel('Assignment title').fill(title);
  await page.getByLabel('Final deadline date').fill('14/11/2030');
  await page.getByRole('button', { name: 'Create and continue' }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}\/brief/);
  const id = /\/p\/([0-9a-f-]{36})\//.exec(page.url())?.[1];
  if (!id) throw new Error('No project id');
  return id;
}

export async function newPage(browser: Browser, like: Page): Promise<Page> {
  const ctx = await browser.newContext({ viewport: like.viewportSize() ?? undefined });
  return ctx.newPage();
}
