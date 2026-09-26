import { z } from 'zod';
import { email, irishDate, irishTime, requiredText, text, uuid } from './common.js';

export const createGroup = z
  .object({
    group_name: requiredText(80),
    module_code: text(20),
    title: requiredText(160),
    deadline_date: irishDate.or(z.literal('')),
    deadline_time: irishTime.or(z.literal('')),
  })
  .strict();
export type CreateGroup = z.infer<typeof createGroup>;

export const renameGroup = z.object({ name: requiredText(80) }).strict();
export const changeRole = z.object({ role: z.enum(['owner', 'member']) }).strict();
export const deleteGroup = z.object({ confirm_name: requiredText(80) }).strict();

export const createInvite = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('link') }).strict(),
  z.object({ kind: z.literal('email'), email }).strict(),
]);
export type CreateInvite = z.infer<typeof createInvite>;

export const inviteCode = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const idParam = uuid;
