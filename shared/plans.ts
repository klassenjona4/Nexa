// Plan rules shared by the client and server. The database enforces them; these only describe them.

// Paid plans are shown but cannot be bought until the business is registered. While this is false
// the server has no payment routes at all, and the app answers every attempt to pay with a note.
// To switch payments on: set this to true, add the Stripe variables in Vercel and redeploy.
export const PAYMENTS_AVAILABLE = false;

export type UsageKind = 'brief_breakdown' | 'statement_generation';

export type Allowance = {
  used: number;
  max: number;
  unlimited: boolean;
  plan: string;
  subscriptionActive: boolean | null;
};

export type Entitlements = { subscriptionActive: boolean; freeProjectAvailable: boolean; projectCredits: number };

// Left on a limited plan; null when the project is on the monthly plan.
export function allowanceLeft(a: Allowance | undefined): number | null {
  if (!a) return 0;
  if (a.unlimited && a.subscriptionActive) return null;
  return Math.max(0, a.max - a.used);
}

// How a new project will be paid for, in the order the database applies.
export function nextProjectSource(e: Entitlements): 'subscription' | 'free' | 'credit' | null {
  if (e.subscriptionActive) return 'subscription';
  if (e.freeProjectAvailable) return 'free';
  if (e.projectCredits > 0) return 'credit';
  return null;
}
