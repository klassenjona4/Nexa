import { describe, expect, it } from 'vitest';
import { eventWindow, generatePromoCode, normalisePromoCode, parseLocalDateTime, PROMO_ALPHABET, PROMO_CODE_RE } from './promo.js';

describe('promo codes', () => {
  it('uses an alphabet without ambiguous characters or vowels', () => {
    for (const ch of '0O1IL' + 'AEIOU') expect(PROMO_ALPHABET).not.toContain(ch);
    expect(new Set(PROMO_ALPHABET).size).toBe(PROMO_ALPHABET.length);
  });

  it('generates 10 character codes in the database format', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generatePromoCode()));
    expect(codes.size).toBe(2000);
    for (const c of codes) expect(c).toMatch(PROMO_CODE_RE);
  });

  // Bytes at or above 252 would make the first characters more likely; they must be skipped.
  it('skips biased bytes', () => {
    let calls = 0;
    const code = generatePromoCode((n: number) => {
      calls += 1;
      return calls === 1 ? new Uint8Array(n).fill(255) : new Uint8Array(n).fill(0);
    });
    expect(code).toBe('BBBBBBBBBB');
    expect(calls).toBe(2);
  });

  it('normalises what people type', () => {
    expect(normalisePromoCode('  bcdf-ghjk 23\n')).toBe('BCDFGHJK23');
  });
});

describe('event window', () => {
  it('reads wall clock time in Irish time, in winter and summer', () => {
    expect(parseLocalDateTime('2026-11-27T18:00').toISOString()).toBe('2026-11-27T18:00:00.000Z');
    expect(parseLocalDateTime('2026-07-03T18:00').toISOString()).toBe('2026-07-03T17:00:00.000Z');
    expect(parseLocalDateTime('2026-11-27T18:00:00+01:00').toISOString()).toBe('2026-11-27T17:00:00.000Z');
    expect(() => parseLocalDateTime('27/11/2026 18:00')).toThrow();
  });

  it('runs from 1 hour before the event until midnight at the end of the event day', () => {
    const w = eventWindow(parseLocalDateTime('2026-11-27T18:00'));
    expect(w.validFrom.toISOString()).toBe('2026-11-27T17:00:00.000Z');
    expect(w.validUntil.toISOString()).toBe('2026-11-28T00:00:00.000Z');
    const summer = eventWindow(parseLocalDateTime('2026-07-03T18:00'));
    expect(summer.validUntil.toISOString()).toBe('2026-07-03T23:00:00.000Z');
  });
});
