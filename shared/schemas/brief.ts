import { z } from 'zod';
import { irishDate, irishTime, isoDateTime, requiredText, text, uuid } from './common.js';

// What the model must return. Kept flat and simple so it compiles to a structured output schema.
// Length and count limits are enforced by zod after parsing (the API ignores them).
export const aiBriefOutput = z.object({
  module_code: z.string().describe('Module code if stated, for example MDIA7012, otherwise an empty string.'),
  assignment_title: z.string().describe('Assignment title as stated in the brief, otherwise an empty string.'),
  deliverables: z
    .array(
      z.object({
        name: z.string().describe('What must be submitted, for example Written case study report.'),
        detail: z.string().describe('Length or format, for example 3,000 words, 10% tolerance. Empty string if not stated.'),
      }),
    )
    .describe('Every item the group must hand in.'),
  deadlines: z
    .array(
      z.object({
        item: z.string().describe('What is due.'),
        date: z.string().describe('Due date as DD/MM/YYYY, or an empty string if no date is stated.'),
        time: z.string().describe('Due time as 24 hour HH:MM, or an empty string if no time is stated.'),
      }),
    )
    .describe('Every submission deadline stated in the brief.'),
  word_counts: z
    .array(z.object({ item: z.string(), words: z.number().int().describe('Word count as a whole number.') }))
    .describe('Word counts or limits stated in the brief.'),
  criteria: z
    .array(
      z.object({
        name: z.string().describe('Marking criterion name.'),
        weight: z.number().nullable().describe('Weight in percent, or null if not stated.'),
      }),
    )
    .describe('Marking criteria with their weights.'),
  tasks: z
    .array(
      z.object({
        title: z.string().describe('Short task title, for example Ethics discussion (800 words).'),
        description: z.string().describe('One or two plain sentences on what the task involves. Never write the assessed content itself.'),
        deliverable: z.string().describe('Name of the deliverable this task contributes to.'),
        estimated_hours: z.number().describe('Estimated hours, in steps of 0.5.'),
        due_date: z.string().describe('Suggested internal due date as DD/MM/YYYY before the relevant deadline, or an empty string.'),
        member: z.number().int().describe('Suggested member number from 1 to the number of members, for an even split of hours.'),
      }),
    )
    .describe('Proposed tasks that together cover every deliverable.'),
  split_note: z.string().describe('One sentence on how the hours are split between members.'),
});
export type AiBriefOutput = z.infer<typeof aiBriefOutput>;

// Stricter validation of the same output before anything is stored.
export const aiBriefChecked = z.object({
  module_code: text(20),
  assignment_title: text(160),
  deliverables: z.array(z.object({ name: requiredText(200), detail: text(200) })).max(20),
  deadlines: z.array(z.object({ item: requiredText(200), date: z.string().max(10), time: z.string().max(5) })).max(20),
  word_counts: z.array(z.object({ item: text(200), words: z.number().int().min(0).max(100000) })).max(30),
  criteria: z.array(z.object({ name: requiredText(200), weight: z.number().min(0).max(100).nullable() })).max(30),
  tasks: z
    .array(
      z.object({
        title: requiredText(200),
        description: text(1000),
        deliverable: text(200),
        estimated_hours: z.number().min(0).max(200),
        due_date: z.string().max(10),
        member: z.number().int().min(0).max(8),
      }),
    )
    .min(1)
    .max(40),
  split_note: text(400),
});

// The brief as stored on the project and edited by members.
export const briefContent = z
  .object({
    deliverables: z.array(z.object({ name: requiredText(200), detail: text(200) }).strict()).max(20),
    deadlines: z.array(z.object({ item: requiredText(200), due_at: isoDateTime.nullable() }).strict()).max(20),
    criteria: z.array(z.object({ name: requiredText(200), weight: z.number().min(0).max(100).nullable() }).strict()).max(30),
    word_counts: z.array(z.object({ item: text(200), words: z.number().int().min(0).max(100000) }).strict()).max(30).default([]),
  })
  .strict();
export type BriefContent = z.infer<typeof briefContent>;

export const proposedTask = z
  .object({
    title: requiredText(200),
    description: text(1000),
    deliverable: text(200),
    estimated_hours: z.number().min(0).max(200).multipleOf(0.5),
    due_at: isoDateTime.nullable(),
    member_index: z.number().int().min(1).max(8).nullable(),
  })
  .strict();

// Normalised analysis result stored in brief_analyses.result.
export const analysisResult = z.object({
  module_code: text(20),
  assignment_title: text(160),
  brief: briefContent,
  tasks: z.array(proposedTask).max(40),
  split_note: text(400),
  members: z.number().int().min(1).max(8),
  reviewed: z.boolean().default(false),
});
export type AnalysisResult = z.infer<typeof analysisResult>;

// Client input -------------------------------------------------------------------
export const uploadUrlRequest = z
  .object({
    file_name: requiredText(200),
    file_size: z.number().int().min(5).max(10 * 1024 * 1024),
  })
  .strict();

export const analyseRequest = z.union([
  z.object({ storage_path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/), file_name: requiredText(200) }).strict(),
  z.object({ text: z.string().trim().min(200, 'The brief text is too short.').max(60000) }).strict(),
]);

// Review step: edited brief with Irish dates, converted to UTC on the server.
export const reviewRequest = z
  .object({
    deliverables: z.array(z.object({ name: requiredText(200), detail: text(200) }).strict()).max(20),
    deadlines: z.array(z.object({ item: requiredText(200), date: irishDate.or(z.literal('')), time: irishTime.or(z.literal('')) }).strict()).max(20),
    criteria: z.array(z.object({ name: requiredText(200), weight: z.number().min(0).max(100).nullable() }).strict()).max(30),
  })
  .strict();

export const acceptRequest = z
  .object({
    tasks: z
      .array(
        z
          .object({
            title: requiredText(200),
            description: text(1000),
            deliverable: text(200),
            estimated_hours: z.number().min(0).max(200).multipleOf(0.5),
            due_at: isoDateTime.nullable(),
            assignee_id: uuid.nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();
