import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, fold } from './ics.js';

describe('iCalendar feed', () => {
  const cal = buildCalendar('Nexa deadlines', [{ uid: 'task-1@nexa', title: 'Report, draft; final\\v2', start: new Date('2026-11-14T17:00:00Z') }], new Date('2026-09-26T10:00:00Z'));

  it('uses CRLF line endings and UTC times', () => {
    expect(cal.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(cal.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(cal).toContain('DTSTART:20261114T170000Z\r\n');
    expect(cal).toContain('DTSTAMP:20260926T100000Z\r\n');
  });

  it('escapes text values', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    expect(cal).toContain('SUMMARY:Report\\, draft\\; final\\\\v2');
  });

  it('folds long lines at 75 octets', () => {
    const long = `SUMMARY:${'Á'.repeat(60)}`;
    const folded = fold(long);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n ').join('')).toBe(long);
  });

  it('contains no personal data fields', () => {
    expect(cal).not.toMatch(/ORGANIZER|ATTENDEE|DESCRIPTION|LOCATION|URL:/);
  });
});
