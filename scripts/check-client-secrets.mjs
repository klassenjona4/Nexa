// Fails the build if anything secret appears in the client bundle (dist/).
// Only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY may reach the browser.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;

const PATTERNS = [
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{10,}/ },
  { name: 'Resend API key', re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/ },
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'Stripe style secret key', re: /\bsk_(live|test)_[A-Za-z0-9]{10,}/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'server environment variable name', re: /\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|ANTHROPIC_API_KEY|RESEND_API_KEY|TOKEN_SECRET|CRON_SECRET|RATE_LIMIT_SECRET)\b/ },
  { name: 'process.env reference', re: /process\.env\.[A-Z]/ },
];

// JWTs are fine only when they are not service role tokens.
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function* walk(path) {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

let files;
try {
  files = [...walk(DIST)];
} catch {
  console.error('dist/ not found. Run vite build first.');
  process.exit(1);
}

const problems = [];
for (const file of files) {
  if (!/\.(js|mjs|css|html|json|webmanifest|txt|map)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const p of PATTERNS) {
    if (p.re.test(text)) problems.push(`${relative(DIST, file)}: ${p.name}`);
  }
  for (const m of text.matchAll(JWT)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload.role && payload.role !== 'anon') problems.push(`${relative(DIST, file)}: JWT with role ${payload.role}`);
    } catch {
      // Not a JWT payload.
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error('\nSecret check failed. Nothing secret may be bundled into client code.');
  process.exit(1);
}
console.warn(`Secret check passed (${files.length} files scanned).`);
