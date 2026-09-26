import { describe, expect, it } from 'vitest';
import { clean, normaliseAnalysis } from './ai.js';
import { isPdf } from './storage.js';

describe('AI output handling', () => {
  it('removes dashes, emoji and control characters from model text', () => {
    expect(clean('Week 1\u2013Week 3 \u2014 draft \u{1F600}\u0007', 100)).toBe('Week 1 to Week 3, draft');
  });

  it('normalises dates to UTC, hours to half hours and member numbers to the group size', () => {
    const r = normaliseAnalysis(
      {
        module_code: 'MDIA7012',
        assignment_title: 'Report',
        deliverables: [{ name: 'Report', detail: '3,000 words' }],
        deadlines: [{ item: 'Report', date: '14/11/2030', time: '17:00' }, { item: 'Bad', date: '31/02/2030', time: '' }],
        word_counts: [{ item: 'Report', words: 3000 }],
        criteria: [{ name: 'Analysis', weight: 130 }],
        tasks: [
          { title: 'Research', description: '', deliverable: 'Report', estimated_hours: 2.3, due_date: '10/11/2030', member: 3 },
          { title: 'Write', description: '', deliverable: 'Report', estimated_hours: 4, due_date: '', member: 9 },
        ],
        split_note: 'Even.',
      },
      3,
    );
    expect(r.brief.deadlines[0]?.due_at).toBe('2030-11-14T17:00:00.000Z');
    expect(r.brief.deadlines[1]?.due_at).toBeNull();
    expect(r.brief.criteria[0]?.weight).toBe(100);
    expect(r.tasks[0]?.estimated_hours).toBe(2.5);
    expect(r.tasks[0]?.member_index).toBe(3);
    expect(r.tasks[1]?.member_index).toBeNull();
  });

  it('recognises PDFs by file signature only', () => {
    expect(isPdf(new TextEncoder().encode('%PDF-1.7\n'))).toBe(true);
    expect(isPdf(new TextEncoder().encode('<html>'))).toBe(false);
    expect(isPdf(new Uint8Array([0x25, 0x50]))).toBe(false);
  });
});
