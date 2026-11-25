import { z } from 'zod';

// The code is checked for its format on the server after normalising, so a mistyped code counts
// as a failed attempt instead of a validation error.
export const redeemPromoRequest = z
  .object({
    code: z.string().max(64),
    email_updates: z.boolean().optional(),
  })
  .strict();
export type RedeemPromoRequest = z.infer<typeof redeemPromoRequest>;

export const emailUpdatesRequest = z.object({ email_updates: z.boolean() }).strict();

export type RedeemPromoResponse = { premium_until: string; premium_days: number };
