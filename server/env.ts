import { HttpError } from './http.js';

// Server configuration. Values are read lazily so a missing optional service (for example email)
// only breaks the routes that need it. Error messages name the variable, never its value.
type Name =
  | 'SUPABASE_URL'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'VITE_SUPABASE_PUBLISHABLE_KEY'
  | 'ANTHROPIC_API_KEY'
  | 'RESEND_API_KEY'
  | 'EMAIL_FROM'
  | 'APP_URL'
  | 'TOKEN_SECRET'
  | 'CRON_SECRET'
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'STRIPE_PRICE_PROJECT'
  | 'STRIPE_PRICE_SUBSCRIPTION';

export function requireEnv(name: Name): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new HttpError(503, 'not_configured', `Server setting ${name} is missing.`);
  }
  return value.trim();
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

// True on Vercel (production and preview), on Replit and whenever NODE_ENV is production.
export function onHostedPlatform(): boolean {
  return (
    Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT) ||
    process.env.NODE_ENV === 'production'
  );
}

// Test helpers (the email outbox, AI fixtures and raised rate limits) are off unless
// NEXA_TEST_MODE=1 is set, and never run on a hosted platform, whatever else is set.
export const flags = {
  get testMode() {
    return process.env.NEXA_TEST_MODE === '1' && !onHostedPlatform();
  },
  get aiMock() {
    return flags.testMode && process.env.AI_MOCK === '1';
  },
  get emailMock() {
    return flags.testMode && process.env.EMAIL_MOCK === '1';
  },
};

const TEST_SETTINGS = ['NEXA_TEST_MODE', 'EMAIL_MOCK', 'AI_MOCK', 'RATE_LIMIT_MULTIPLIER'] as const;

function testSettingIsOn(name: (typeof TEST_SETTINGS)[number]): boolean {
  const value = process.env[name]?.trim();
  if (!value || value === '0') return false;
  return name === 'RATE_LIMIT_MULTIPLIER' ? Number(value) > 1 : true;
}

// Refuses to start a hosted deployment that carries test-only settings, so a copied .env.local
// cannot quietly turn on the outbox (which exposes sign in links) or the AI fixtures.
export function assertNoTestSettingsOnHostedPlatform(): void {
  if (!onHostedPlatform()) return;
  const on = TEST_SETTINGS.filter(testSettingIsOn);
  if (on.length) {
    throw new Error(`Test-only settings must not be set on a deployment: ${on.join(', ')}. Remove them and redeploy.`);
  }
}

export function appUrl(): string {
  return requireEnv('APP_URL').replace(/\/+$/, '');
}
