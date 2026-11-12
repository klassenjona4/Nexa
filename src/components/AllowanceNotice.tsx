import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { type Allowance, allowanceLeft, type UsageKind } from '../lib/billing';
import { InlineNotice } from './Display';

const NAMES: Record<UsageKind, { label: string; many: string; fallback: string }> = {
  brief_breakdown: {
    label: 'Brief breakdowns',
    many: 'breakdowns',
    fallback: 'You can still add and edit tasks by hand.',
  },
  statement_generation: {
    label: 'Statement generations',
    many: 'generations',
    fallback: 'You can still edit and export the current statement.',
  },
};

// Shows a project's AI allowance and, when it runs out, where to get more.
export function AllowanceNotice({ kind, allowance, projectId }: { kind: UsageKind; allowance: Allowance; projectId: string }) {
  const n = NAMES[kind];
  const left = allowanceLeft(allowance);
  const unlock = (
    <Link to={`/pricing?project=${projectId}`} style={{ color: 'inherit', fontWeight: 600 }}>
      Unlock 3 more of each for 2 euro
    </Link>
  );
  if (allowance.plan === 'subscription' && !allowance.subscriptionActive) {
    return (
      <AllowanceBox>
          The monthly plan that paid for this project has ended. AI features are paused and your data is kept. {n.fallback}{' '}
          <Link to={`/pricing?project=${projectId}`} style={{ color: 'inherit', fontWeight: 600 }}>
            See the options on Pricing
          </Link>
          .
      </AllowanceBox>
    );
  }
  if (left === null) {
    return <AllowanceBox>Monthly plan. {n.label} used on this project: {allowance.used}. A failed attempt does not count.</AllowanceBox>;
  }
  return (
    <AllowanceBox>
      {n.label} used: {allowance.used} of {allowance.max}.{' '}
      {left > 0 ? (
        'A failed attempt does not count.'
      ) : (
        <>
          No {n.many} are left for this project. {n.fallback} {unlock}.
        </>
      )}
    </AllowanceBox>
  );
}

function AllowanceBox({ children }: { children: ReactNode }) {
  return <InlineNotice role="note">{children}</InlineNotice>;
}
