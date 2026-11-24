import { TIME_ZONE } from './dates.js';

// Promo codes: 10 characters from an alphabet without 0/O, 1/I/L and without vowels, so a code
// is easy to type from a slide and never spells a word. 28 characters give 28^10 (about 3 * 10^14)
// codes. The database checks the same format (supabase/migrations/20261124104335_event_promo.sql).
export const PROMO_ALPHABET = 'BCDFGHJKMNPQRSTVWXYZ23456789';
export const PROMO_LENGTH = 10;
export const PROMO_CODE_RE = /^[B-DF-HJKMNP-TV-Z2-9]{10}$/;
export const CAMPAIGN_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;

export const PROMO_DEFAULT_MAX_USES = 60;
export const PROMO_DEFAULT_DAYS = 30;

// Generates a code with a cryptographically secure RNG. Rejection sampling keeps every character
// equally likely (256 is not a multiple of 28).
export function generatePromoCode(randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const limit = 256 - (256 % PROMO_ALPHABET.length);
  let out = '';
  while (out.length < PROMO_LENGTH) {
    for (const b of randomBytes(PROMO_LENGTH * 2)) {
      if (b < limit && out.length < PROMO_LENGTH) out += PROMO_ALPHABET[b % PROMO_ALPHABET.length];
    }
  }
  return out;
}

// What a person typed or what came from the QR link: trimmed, uppercased, spaces and hyphens removed.
export function normalisePromoCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, '');
}

// Offset of a time zone from UTC at a moment, in milliseconds.
function zoneOffsetMs(at: Date, timeZone: string): number {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(at)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0, p.second ?? 0);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// Parses "YYYY-MM-DDTHH:MM" as wall clock time in a time zone (Irish time by default). A value
// with Z or an explicit offset is taken as it is.
export function parseLocalDateTime(value: string, timeZone = TIME_ZONE): Date {
  const v = value.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new Error(`Not a date and time: ${value}`);
    return d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(v);
  if (!m) throw new Error(`Use the format YYYY-MM-DDTHH:MM: ${value}`);
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Two passes settle the offset also on daylight saving days.
  let utc = wall - zoneOffsetMs(new Date(wall), timeZone);
  utc = wall - zoneOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

// Default window for an event: from 1 hour before it starts until midnight at the end of the
// event day, both in the event's time zone.
export function eventWindow(eventStart: Date, timeZone = TIME_ZONE): { validFrom: Date; validUntil: Date } {
  const validFrom = new Date(eventStart.getTime() - 60 * 60 * 1000);
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const day = f.format(eventStart); // YYYY-MM-DD in the event's time zone
  const [y, mo, d] = day.split('-').map(Number);
  const next = new Date(Date.UTC(y ?? 0, (mo ?? 1) - 1, (d ?? 1) + 1));
  const nextDay = next.toISOString().slice(0, 10);
  return { validFrom, validUntil: parseLocalDateTime(`${nextDay}T00:00`, timeZone) };
}
