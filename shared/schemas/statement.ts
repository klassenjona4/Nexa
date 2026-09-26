import { z } from 'zod';
import { requiredText, text } from './common.js';

export const aiStatementOutput = z.object({
  sections: z
    .array(
      z.object({
        heading: z.string().describe('Member name, with ", group owner" for owners, or "Summary" for the last section.'),
        body: z.string().describe('Factual paragraph based only on the log.'),
      }),
    )
    .describe('One section per member in the order given, then one Summary section.'),
});

export const statementSections = z.array(z.object({ heading: requiredText(120), body: text(3000) }).strict()).min(1).max(12);
export type StatementSection = z.infer<typeof statementSections>[number];

export const updateStatement = z.object({ sections: statementSections }).strict();
