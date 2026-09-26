import { z } from 'zod';
import { irishDate, irishTime, requiredText, text, uuid } from './common.js';

export const taskStatus = z.enum(['todo', 'in_progress', 'done']);
const hours = z.number().min(0).max(200).multipleOf(0.5);

export const taskFields = z.object({
  title: requiredText(200),
  description: text(4000),
  deliverable: text(200),
  assignee_id: uuid.nullable(),
  due_date: irishDate.or(z.literal('')),
  due_time: irishTime.or(z.literal('')),
  estimated_hours: hours,
});

export const createTask = taskFields.strict();
export type CreateTask = z.infer<typeof createTask>;

export const updateTask = taskFields.partial().extend({ status: taskStatus.optional() }).strict();
export type UpdateTask = z.infer<typeof updateTask>;

export const addLink = z
  .object({
    url: z
      .string()
      .trim()
      .max(2048)
      .pipe(z.url({ protocol: /^https$/, hostname: z.regexes.domain })),
    label: text(200).optional(),
  })
  .strict();

export const reviewTask = z
  .object({
    kind: z.enum(['confirmed', 'flagged']),
    note: text(1000).optional(),
  })
  .strict()
  .refine((v) => v.kind === 'confirmed' || (v.note ?? '').length > 0, { path: ['note'], message: 'A flag needs a reason.' });
