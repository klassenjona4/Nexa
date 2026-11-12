// Plan rules shared by the client and server. The database enforces them; these only describe them.

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
