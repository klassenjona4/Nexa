// Operator script for event promo codes. Never part of the app or the API.
//
//   npx tsx scripts/promo.ts create     --campaign rubicon-final --event-start 2026-11-27T18:00
//   npx tsx scripts/promo.ts status     --campaign rubicon-final
//   npx tsx scripts/promo.ts deactivate --campaign rubicon-final
//   npx tsx scripts/promo.ts activate   --campaign rubicon-final
//   npx tsx scripts/promo.ts qr         --campaign rubicon-final
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only, never in the browser). Load them
// from a file with --env <file>, for example --env .env.promo.local (ignored by git).
// Every option can also be set as an environment variable; options win. See README.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import type { Database } from '../shared/database.types.js';
import { formatDateTime } from '../shared/dates.js';
import { CAMPAIGN_RE, eventWindow, generatePromoCode, parseLocalDateTime, PROMO_CODE_RE, PROMO_DEFAULT_DAYS, PROMO_DEFAULT_MAX_USES } from '../shared/promo.js';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: 'string' },
    campaign: { type: 'string' },
    'event-start': { type: 'string' },
    'valid-from': { type: 'string' },
    'valid-until': { type: 'string' },
    'max-uses': { type: 'string' },
    'premium-days': { type: 'string' },
    'base-url': { type: 'string' },
    out: { type: 'string' },
    replace: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (opt.env) process.loadEnvFile(opt.env);

const command = positionals[0];
const USAGE = `Usage: npx tsx scripts/promo.ts <create|status|deactivate|activate|qr> --campaign <name> [options]

create      Creates the campaign code, prints the redeem URL and writes the QR code (PNG and SVG).
            --event-start YYYY-MM-DDTHH:MM   Event start in Irish time (PROMO_EVENT_START). The code is
                                             valid from 1 hour before until midnight at the end of that day.
            --valid-from / --valid-until     Exact window instead (PROMO_VALID_FROM, PROMO_VALID_UNTIL).
            --max-uses N                     Cap on uses (PROMO_MAX_USES, default ${PROMO_DEFAULT_MAX_USES}).
            --premium-days N                 Days of Premium (PROMO_PREMIUM_DAYS, default ${PROMO_DEFAULT_DAYS}).
            --base-url URL                   App address for the link (PROMO_BASE_URL, else APP_URL).
            --out DIR                        Where the QR files go (PROMO_OUT_DIR, default promo-out).
            --replace                        Deactivate the campaign's current code and create a new one.
                                             People who redeemed the old code cannot redeem again.
            --dry-run                        Print what would be created without touching the database.
status      Prints uses / max_uses, redemptions, the window and whether the code is active.
deactivate  Switches the campaign's codes off immediately (they stop working at once).
activate    Switches the campaign's newest code back on.
qr          Writes the QR code again for the campaign's active code.

Options: --env <file> loads environment variables from a file first. --campaign or PROMO_CAMPAIGN.`;

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (opt.help || !command) {
  console.log(USAGE);
  process.exit(command ? 0 : 1);
}

const campaign = opt.campaign ?? process.env.PROMO_CAMPAIGN ?? '';
if (!CAMPAIGN_RE.test(campaign)) fail('Give a campaign with --campaign: lowercase letters, digits and hyphens, for example rubicon-final.');

function intOption(value: string | undefined, fallback: number, name: string, min: number, max: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${name} must be a whole number from ${min} to ${max}.`);
  return n;
}

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for example with --env .env.promo.local).');
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function baseUrl(): string {
  const raw = (opt['base-url'] ?? process.env.PROMO_BASE_URL ?? process.env.APP_URL ?? '').replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(raw)) fail('Set the app address with --base-url or PROMO_BASE_URL, for example https://nexa-groups.com.');
  if (raw.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(raw)) fail('The base URL must use https.');
  return raw;
}

const redeemUrl = (code: string) => `${baseUrl()}/redeem?code=${code}`;

// High resolution, 4 module quiet zone and error correction level Q (25 percent), so the code
// scans from the back of a room on a projector and survives a logo or glare.
async function writeQr(code: string): Promise<{ png: string; svg: string; url: string }> {
  const url = redeemUrl(code);
  const dir = resolve(opt.out ?? process.env.PROMO_OUT_DIR ?? 'promo-out');
  mkdirSync(dir, { recursive: true });
  const base = join(dir, `${campaign}-qr`);
  const qrOptions = { errorCorrectionLevel: 'Q' as const, margin: 4, color: { dark: '#000000', light: '#ffffff' } };
  await QRCode.toFile(`${base}.png`, url, { ...qrOptions, type: 'png', width: 2400 });
  writeFileSync(`${base}.svg`, await QRCode.toString(url, { ...qrOptions, type: 'svg' }));
  return { png: `${base}.png`, svg: `${base}.svg`, url };
}

const irish = (iso: string) => `${formatDateTime(iso)} Irish time (${new Date(iso).toISOString()})`;

async function create() {
  const maxUses = intOption(opt['max-uses'] ?? process.env.PROMO_MAX_USES, PROMO_DEFAULT_MAX_USES, 'max-uses', 1, 100000);
  const premiumDays = intOption(opt['premium-days'] ?? process.env.PROMO_PREMIUM_DAYS, PROMO_DEFAULT_DAYS, 'premium-days', 1, 366);
  const fromRaw = opt['valid-from'] ?? process.env.PROMO_VALID_FROM;
  const untilRaw = opt['valid-until'] ?? process.env.PROMO_VALID_UNTIL;
  const startRaw = opt['event-start'] ?? process.env.PROMO_EVENT_START;

  let validFrom: Date;
  let validUntil: Date;
  try {
    if (fromRaw && untilRaw) {
      validFrom = parseLocalDateTime(fromRaw);
      validUntil = parseLocalDateTime(untilRaw);
    } else if (startRaw) {
      ({ validFrom, validUntil } = eventWindow(parseLocalDateTime(startRaw)));
      if (fromRaw) validFrom = parseLocalDateTime(fromRaw);
      if (untilRaw) validUntil = parseLocalDateTime(untilRaw);
    } else {
      fail('Give --event-start, or both --valid-from and --valid-until.');
    }
  } catch (err) {
    fail((err as Error).message);
  }
  if (validUntil <= validFrom) fail('The window must end after it starts.');
  if (validUntil.getTime() < Date.now()) fail('The window has already ended.');
  if (validUntil.getTime() - validFrom.getTime() > 7 * 86400_000) fail('The window is longer than 7 days. An event code should be valid for the event only.');

  const code = generatePromoCode();
  if (!PROMO_CODE_RE.test(code)) fail('Generated an invalid code.');
  const url = redeemUrl(code);

  if (!opt['dry-run']) {
    const client = db();
    const { data: existing, error: readErr } = await client.from('promo_codes').select('id, active').eq('campaign', campaign);
    if (readErr) fail(`Could not read promo codes: ${readErr.message}`);
    const active = (existing ?? []).filter((c) => c.active);
    if (active.length && !opt.replace) fail(`Campaign ${campaign} already has an active code. Use status to see it, qr to write its QR code again, or --replace for a new code.`);
    if (active.length) {
      const { error } = await client.from('promo_codes').update({ active: false }).eq('campaign', campaign);
      if (error) fail(`Could not deactivate the old code: ${error.message}`);
      console.log(`Deactivated the previous code of ${campaign}.`);
    }
    const { error } = await client.from('promo_codes').insert({
      code,
      campaign,
      max_uses: maxUses,
      valid_from: validFrom.toISOString(),
      valid_until: validUntil.toISOString(),
      premium_days: premiumDays,
    });
    if (error) fail(`Could not create the code: ${error.message}`);
  }

  console.log(opt['dry-run'] ? 'Dry run: nothing was written to the database.\n' : 'Created.\n');
  console.log(`Campaign      ${campaign}`);
  console.log(`Code          ${code}`);
  console.log(`Valid from    ${irish(validFrom.toISOString())}`);
  console.log(`Valid until   ${irish(validUntil.toISOString())}`);
  console.log(`Max uses      ${maxUses}`);
  console.log(`Premium days  ${premiumDays}`);
  console.log(`Redeem URL    ${url}`);
  const files = await writeQr(code);
  console.log(`QR code       ${files.png}\n              ${files.svg}`);
}

async function activeCode(): Promise<string> {
  const { data, error } = await db().from('promo_codes').select('code').eq('campaign', campaign).eq('active', true).order('created_at', { ascending: false }).limit(1);
  if (error) fail(error.message);
  const code = data?.[0]?.code;
  if (!code) fail(`Campaign ${campaign} has no active code.`);
  return code;
}

async function status() {
  const { data, error } = await db().rpc('promo_campaign_status', { p_campaign: campaign });
  if (error) fail(error.message);
  if (!data?.length) fail(`No codes for campaign ${campaign}.`);
  const now = Date.now();
  for (const c of data) {
    const open = new Date(c.valid_from).getTime() <= now && now < new Date(c.valid_until).getTime();
    const state = !c.active ? 'deactivated' : c.uses >= c.max_uses ? 'used up' : open ? 'accepting redemptions' : now < new Date(c.valid_from).getTime() ? 'not open yet' : 'window ended';
    console.log(`${campaign}  ${c.code}`);
    console.log(`  Uses          ${c.uses} / ${c.max_uses}`);
    console.log(`  Redemptions   ${c.redemptions} (accounts deleted since are not counted here; uses stay)`);
    console.log(`  State         ${state}`);
    console.log(`  Window        ${formatDateTime(c.valid_from)} to ${formatDateTime(c.valid_until)} Irish time`);
    console.log(`  Premium days  ${c.premium_days}`);
  }
  const total = data.reduce((n, c) => n + c.uses, 0);
  if (data.length > 1) console.log(`Total uses across the campaign's codes: ${total}`);
}

async function setActive(active: boolean) {
  const client = db();
  if (active) {
    const { data } = await client.from('promo_codes').select('id').eq('campaign', campaign).order('created_at', { ascending: false }).limit(1);
    const id = data?.[0]?.id;
    if (!id) fail(`No codes for campaign ${campaign}.`);
    const { error } = await client.from('promo_codes').update({ active: true }).eq('id', id);
    if (error) fail(error.message);
    console.log(`Activated the newest code of ${campaign}. It works again within its window and cap.`);
  } else {
    const { data, error } = await client.from('promo_codes').update({ active: false }).eq('campaign', campaign).select('code');
    if (error) fail(error.message);
    if (!data?.length) fail(`No codes for campaign ${campaign}.`);
    console.log(`Deactivated ${data.length} code(s) of ${campaign}. They stop working immediately. Premium already given is kept.`);
  }
}

async function main() {
  switch (command) {
    case 'create':
      return create();
    case 'status':
      return status();
    case 'deactivate':
      return setActive(false);
    case 'activate':
      return setActive(true);
    case 'qr': {
      const files = await writeQr(await activeCode());
      console.log(`Redeem URL  ${files.url}\nQR code     ${files.png}\n            ${files.svg}`);
      return;
    }
    default:
      console.log(USAGE);
      process.exit(1);
  }
}

await main();
