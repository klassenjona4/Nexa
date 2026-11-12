import { describe, expect, it } from 'vitest';
import { deadlineDiffers, finalBriefDeadline, isAfterDeadline } from './deadlines.js';

describe('final deadline checks', () => {
  const brief = [
    { due_at: null },
    { due_at: '2027-03-27T23:59:00.000Z' },
    { due_at: '2026-12-01T17:00:00.000Z' },
  ];

  it('takes the latest dated brief deadline as the final submission', () => {
    expect(finalBriefDeadline(brief)).toBe('2027-03-27T23:59:00.000Z');
    expect(finalBriefDeadline([{ due_at: null }])).toBeNull();
  });

  it('flags tasks due after the final deadline only', () => {
    expect(isAfterDeadline('2026-12-22T17:00:00Z', '2026-12-12T17:00:00Z')).toBe(true);
    expect(isAfterDeadline('2026-12-12T17:00:00Z', '2026-12-12T17:00:00Z')).toBe(false);
    expect(isAfterDeadline(null, '2026-12-12T17:00:00Z')).toBe(false);
    expect(isAfterDeadline('2026-12-22T17:00:00Z', null)).toBe(false);
  });

  it('notices when the brief and the project disagree', () => {
    expect(deadlineDiffers('2027-03-27T23:59:00Z', '2026-12-12T17:00:00Z')).toBe(true);
    expect(deadlineDiffers('2027-03-27T23:59:00Z', '2027-03-27T23:59:00.000Z')).toBe(false);
    expect(deadlineDiffers('2027-03-27T23:59:00Z', null)).toBe(true);
    expect(deadlineDiffers(null, '2026-12-12T17:00:00Z')).toBe(false);
  });
});
