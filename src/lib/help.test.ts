import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLegal } from './legal';

describe('help page content', () => {
  const doc = parseLegal(readFileSync('content/help.md', 'utf8'));
  it('covers every topic the help page promises', () => {
    const headings = doc.sections.map((s) => s.heading);
    for (const topic of ['Creating a group and project', 'Uploading the brief', 'Reviewing the extracted details', 'The task proposal', 'The task board', 'The contribution log', 'Exporting the contribution statement', 'Inviting members', 'Calendar feed', 'Installing the app', 'Plans and billing', 'Deleting your data']) {
      expect(headings).toContain(topic);
    }
  });
  it('states the plan prices', () => {
    const text = readFileSync('content/help.md', 'utf8');
    for (const phrase of ['1 project with 1 brief breakdown and 1 contribution statement', '2 euro', '7.99 euro a month']) expect(text).toContain(phrase);
  });
});
