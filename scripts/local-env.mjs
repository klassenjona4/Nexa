// Writes .env.local for development against the local Supabase stack (npx supabase start).
// The keys come from `supabase status` and only work against the local stack.
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const lines = [
  `VITE_SUPABASE_URL=${status.API_URL}`,
  `VITE_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY ?? status.ANON_KEY}`,
  `SUPABASE_URL=${status.API_URL}`,
  `SUPABASE_SERVICE_ROLE_KEY=${status.SECRET_KEY ?? status.SERVICE_ROLE_KEY}`,
  'APP_URL=http://localhost:5173',
  `TOKEN_SECRET=${randomBytes(48).toString('base64')}`,
  `CRON_SECRET=${randomBytes(32).toString('base64url')}`,
  'EMAIL_MOCK=1',
  'AI_MOCK=1',
  'RATE_LIMIT_MULTIPLIER=100',
];
writeFileSync('.env.local', `${lines.join('\n')}\n`);
console.warn('Wrote .env.local for the local Supabase stack.');
