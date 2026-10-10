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
  | 'CRON_SECRET';

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

export const flags = {
  get aiMock() {
    return process.env.AI_MOCK === '1';
  },
  get emailMock() {
    return process.env.EMAIL_MOCK === '1';
  },
  get production() {
    return process.env.VERCEL_ENV === 'production';
  },
};

export function appUrl(): string {
  return requireEnv('APP_URL').replace(/\/+$/, '');
}
