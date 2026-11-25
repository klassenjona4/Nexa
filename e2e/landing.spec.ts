import { expect, test } from '@playwright/test';

test('the landing page shows the launch video and loads YouTube only after Play', async ({ page }) => {
  const youtube: string[] = [];
  page.on('request', (r) => {
    if (/youtube|ytimg|googlevideo/.test(r.url())) youtube.push(r.url());
  });
  // Keep the test offline: YouTube is not needed to check the embed.
  await page.route(/youtube-nocookie\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>video</body></html>' }));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Record who did each part.');
  await expect(page.getByRole('link', { name: 'Start free' })).toBeVisible();

  // Nothing from YouTube until Play.
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('link', { name: 'Watch the video' }).click();
  await expect(page).toHaveURL(/#video$/);
  expect(youtube).toEqual([]);

  await page.getByRole('button', { name: 'Play video' }).click();
  const frame = page.locator('iframe[title="Nexa explained in under a minute"]');
  await expect(frame).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/pztb9J6tM3g\?autoplay=1/);
  await expect(page.getByRole('link', { name: 'watch it on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=pztb9J6tM3g');

  // The steps and the free plan note are still there.
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
  await expect(page.getByText('Free plan: 1 project with 1 brief breakdown', { exact: false })).toBeVisible();
});
