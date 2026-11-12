import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('a visitor asks the help chat a question and closes it with Escape', async ({ page }) => {
  await page.goto('/help');
  await page.getByRole('button', { name: 'Ask the help chat' }).click();
  const chat = page.getByRole('dialog', { name: 'Help chat' });
  await expect(chat).toBeVisible();
  await expect(chat.getByText('The chat cannot see your account or projects.', { exact: false })).toBeVisible();

  const input = chat.getByLabel('Your question');
  await expect(input).toBeFocused();
  await input.fill('How do I start a project?');
  await input.press('Enter');
  await expect(chat.getByRole('log')).toContainText('New group and project');
  await expect(input).toHaveValue('');

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(chat).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask the help chat' })).toBeFocused();
});

test('the help chat is not offered on sign in pages', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask the help chat' })).toHaveCount(0);
});
