// Dates are stored in UTC and shown in Irish time as DD/MM/YYYY and 24 hour HH:MM.
export const TIME_ZONE = 'Europe/Dublin';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  weekday: 'long',
});

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: string };

function parts(date: Date): Parts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: out.weekday ?? '',
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const p = parts(new Date(value));
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  const p = parts(new Date(value));
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  return `${formatDate(value)} ${formatTime(value)}`;
}

// "Saturday 26/09/2026"
export function formatLongDate(value: Date | string): string {
  return `${parts(new Date(value)).weekday} ${formatDate(value)}`;
}

export const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Converts an Irish wall clock date and time to a UTC Date. Returns null when invalid.
export function parseIrishDateTime(date: string, time = '17:00'): Date | null {
  const d = DATE_RE.exec(date.trim());
  const t = TIME_RE.exec(time.trim());
  if (!d || !t) return null;
  const [day, month, year] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hour, minute] = [Number(t[1]), Number(t[2])];
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Irish time is UTC+0 or UTC+1. Try both offsets and keep the one that round trips.
  for (const offsetHours of [0, 1]) {
    const candidate = new Date(wall - offsetHours * 3600_000);
    const p = parts(candidate);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) {
      return candidate;
    }
  }
  return null;
}

export function daysUntil(value: Date | string, now = new Date()): number {
  const ms = new Date(value).getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}
