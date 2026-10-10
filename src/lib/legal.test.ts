import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLegal } from './legal';

describe('legal documents', () => {
  for (const name of ['privacy', 'terms']) {
    const doc = parseLegal(readFileSync(`legal/${name}.md`, 'utf8'));
    it(`${name} is either a marked draft or a completed final version`, () => {
      expect(['draft', 'final']).toContain(doc.status);
      if (doc.status === 'draft') {
        expect(doc.notice).toMatch(/^DRAFT\. .*legal professional/);
      } else {
        expect(doc.notice).not.toMatch(/DRAFT/);
        expect(readFileSync(`legal/${name}.md`, 'utf8')).not.toMatch(/\[(FULL NAME|ADDRESS|CONTACT EMAIL)\]/);
      }
    });
    it(`${name} has sections and dates in DD/MM/YYYY`, () => {
      expect(doc.sections.length).toBeGreaterThan(8);
      expect(doc.updated).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
  }

  it('privacy policy covers the Article 13 information', () => {
    const text = readFileSync('legal/privacy.md', 'utf8');
    for (const phrase of ['is the controller', 'Contact for all privacy questions', 'Article 6(1)(b)', 'Article 6(1)(f)', 'Supabase', 'Vercel', 'Anthropic', 'Resend', 'standard contractual clauses', 'How long data is kept', 'Data Protection Commission']) {
      expect(text).toContain(phrase);
    }
  });

  it('terms cover the required clauses', () => {
    const text = readFileSync('legal/terms.md', 'utf8');
    for (const phrase of ['free', 'usage limits', '16 or older', 'Acceptable use', 'Academic integrity', 'does not write assessed work', 'Limitation of liability', 'Ending your use', 'law of Ireland']) {
      expect(text).toContain(phrase);
    }
  });
});
