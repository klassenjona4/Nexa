import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatLongDate, parseIrishDateTime } from './dates.js';

describe('Irish date handling', () => {
  it('formats as DD/MM/YYYY and 24 hour time in Irish time', () => {
    expect(formatDate('2026-11-14T17:00:00Z')).toBe('14/11/2026');
    expect(formatDateTime('2026-11-14T17:00:00Z')).toBe('14/11/2026 17:00');
    // Summer time: 16:00 UTC is 17:00 in Dublin.
    expect(formatDateTime('2026-07-01T16:00:00Z')).toBe('01/07/2026 17:00');
    expect(formatLongDate('2026-09-26T10:00:00Z')).toBe('Saturday 26/09/2026');
  });

  it('parses Irish wall time to UTC in winter and summer', () => {
    expect(parseIrishDateTime('14/11/2026', '17:00')?.toISOString()).toBe('2026-11-14T17:00:00.000Z');
    expect(parseIrishDateTime('01/07/2026', '17:00')?.toISOString()).toBe('2026-07-01T16:00:00.000Z');
  });

  it('rejects invalid input', () => {
    expect(parseIrishDateTime('2026-11-14', '17:00')).toBeNull();
    expect(parseIrishDateTime('31/02/2026', '17:00')).toBeNull();
    expect(parseIrishDateTime('14/11/2026', '24:00')).toBeNull();
    expect(parseIrishDateTime('14/11/2026', '5pm')).toBeNull();
  });
});
