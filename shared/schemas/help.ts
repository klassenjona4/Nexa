import { z } from 'zod';

// A help chat conversation as the browser holds it. Nothing is stored on the server.
export const helpChatRequest = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            content: z.string().trim().min(1).max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(12)
      .refine((m) => m.at(-1)?.role === 'user', { message: 'last_must_be_user' })
      .refine((m) => m.every((x, i) => x.role === (i % 2 === m.length % 2 ? 'assistant' : 'user')), { message: 'roles_must_alternate' }),
  })
  .strict();

export type HelpChatRequest = z.infer<typeof helpChatRequest>;
