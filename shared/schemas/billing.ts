import { z } from 'zod';

// Starts Stripe Checkout. 'project' is the 2 euro unlock: for a new project when project_id is
// left out, or 3 more of each on that project. 'subscription' is the monthly plan.
// The buyer must ask for the service to start at once, which ends the 14 day withdrawal right
// for digital content once it is delivered (EU Directive 2011/83/EU, Article 16(m)).
export const checkoutRequest = z
  .object({
    kind: z.enum(['project', 'subscription']),
    project_id: z.uuid().optional(),
    start_now: z.literal(true),
  })
  .strict()
  .refine((b) => b.kind === 'project' || b.project_id === undefined, { path: ['project_id'] });

export type CheckoutRequest = z.infer<typeof checkoutRequest>;
