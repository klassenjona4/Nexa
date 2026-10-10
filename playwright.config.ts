import { defineConfig, devices } from '@playwright/test';

// End to end tests run against the local Supabase stack (npx supabase start) with the API
// and Vite dev servers. EMAIL_MOCK and AI_MOCK keep email and AI calls in process.
// Run `node scripts/local-env.mjs` first to write .env.local from `supabase status`.
const executablePath = process.env.CHROME_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 780 }, hasTouch: true, isMobile: false } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 } } },
  ],
  webServer: [
    { command: 'npx tsx server/dev.ts', url: 'http://localhost:8787/api/health', reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
});
