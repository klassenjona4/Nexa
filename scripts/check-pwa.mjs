// Fails the build if the service worker could cache user data, or the manifest is incomplete.
import { existsSync, readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url).pathname;
const problems = [];
const sw = readFileSync(`${dist}sw.js`, 'utf8');
for (const strategy of ['NetworkFirst', 'CacheFirst', 'StaleWhileRevalidate', 'NetworkOnly']) {
  if (sw.includes(strategy)) problems.push(`sw.js uses the ${strategy} runtime strategy; only the app shell may be cached.`);
}
if (/precacheAndRoute\([^)]*\/api\//.test(sw)) problems.push('sw.js precaches an API path.');
if (!sw.includes('api')) problems.push('sw.js does not exclude /api from the navigation fallback.');

const manifest = JSON.parse(readFileSync(`${dist}manifest.webmanifest`, 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color']) {
  if (!manifest[key]) problems.push(`manifest is missing ${key}.`);
}
for (const icon of manifest.icons ?? []) {
  if (!existsSync(`${dist}${icon.src.replace(/^\//, '')}`)) problems.push(`manifest icon ${icon.src} is missing.`);
}
if (!(manifest.icons ?? []).some((i) => i.purpose === 'maskable')) problems.push('manifest has no maskable icon.');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.warn('PWA check passed.');
