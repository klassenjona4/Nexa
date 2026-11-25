import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatDate, formatTime } from '../../../shared/dates';
import p from '../../app/page.module.css';
import { Button, ButtonLink } from '../../components/Button';
import { InlineNotice } from '../../components/Display';
import { Label } from '../../components/Label';
import { useToast } from '../../components/Toast';
import { codeOf } from '../../lib/api';
import { type BillingAccount, openBillingPortal, PAYMENTS_AVAILABLE, useBillingAccount, useEntitlements } from '../../lib/billing';
import { errorMessage } from '../../lib/errors';
import { premiumActive } from '../../lib/promo';
import s from './Billing.module.css';

const MONTHLY_PERKS = [
  { strong: 'Unlimited projects', rest: 'for every group you start' },
  { strong: 'Unlimited brief breakdowns', rest: 'on every project' },
  { strong: 'Unlimited contribution statements', rest: 'drafted from the log' },
  { strong: 'Members join at no cost', rest: 'and use your plan on your projects' },
];

function unlockText(n: number): string {
  return `${n} project ${n === 1 ? 'unlock' : 'unlocks'}`;
}

// The plan section of Account settings, shaped by the current subscription status.
export function Billing({ userId }: { userId: string | undefined }) {
  const account = useBillingAccount(userId);
  const entitlements = useEntitlements();
  const [params] = useSearchParams();
  const [now] = useState(() => Date.now());
  const a = account.data ?? null;
  // A paid subscription takes precedence; otherwise free Premium from a code is shown on its own,
  // with its end date and no renewal.
  const stripeActive =
    !!a?.subscription_status && ['active', 'trialing', 'past_due'].includes(a.subscription_status) && (!a.current_period_end || new Date(a.current_period_end).getTime() > now);
  const promoPremium = !stripeActive && premiumActive(a?.premium_until, now);

  return (
    <section className={s.section} aria-labelledby="billing-title">
      <h2 id="billing-title" className={[p.h2, p.h2Rule].join(' ')}>
        Plan and billing
      </h2>
      {params.get('billing') === 'success' ? <InlineNotice role="status">Payment received. It can take a minute to show here.</InlineNotice> : null}
      {account.isPending || entitlements.isPending ? (
        <p className={[p.serif, p.muted].join(' ')}>Loading your plan</p>
      ) : promoPremium && a?.premium_until ? (
        <PremiumPlan account={a} premiumUntil={a.premium_until} />
      ) : entitlements.data?.subscriptionActive ? (
        <MonthlyPlan account={account.data ?? null} credits={entitlements.data.projectCredits} />
      ) : (
        <FreePlan
          account={account.data ?? null}
          freeAvailable={entitlements.data?.freeProjectAvailable ?? false}
          credits={entitlements.data?.projectCredits ?? 0}
        />
      )}
      <p className={[p.small, p.muted].join(' ')}>Projects you create use your plan. Projects you join use the plan of the member who created them.</p>
    </section>
  );
}

function MonthlyPlan({ account, credits }: { account: BillingAccount | null; credits: number }) {
  const status = account?.subscription_status;
  const end = account?.current_period_end;
  const pastDue = status === 'past_due';
  const renewal = !end ? 'No end date' : account?.cancel_at_period_end ? `Ends on ${formatDate(end)}` : `Renews on ${formatDate(end)}`;

  return (
    <div className={[s.card, s.active].join(' ')}>
      <div className={s.head}>
        <Label color="slate">Monthly plan</Label>
        <span className={[s.pill, pastDue ? s.pillWarn : ''].join(' ')}>{pastDue ? 'Payment failed' : 'Active'}</span>
      </div>
      <p className={s.title}>Unlimited projects and AI features</p>
      <ul className={s.perks}>
        {MONTHLY_PERKS.map((perk) => (
          <li key={perk.strong}>
            <strong>{perk.strong}</strong> {perk.rest}
          </li>
        ))}
      </ul>
      {pastDue ? <p className={s.warn}>The last payment failed. Stripe will try again; update your card in Manage billing to keep the plan.</p> : null}
      <dl className={s.facts}>
        <div>
          <dt>{account?.cancel_at_period_end ? 'Plan ends' : 'Renewal'}</dt>
          <dd>{renewal}</dd>
        </div>
        {credits > 0 ? (
          <div>
            <dt>Kept for later</dt>
            <dd>{unlockText(credits)}</dd>
          </div>
        ) : null}
      </dl>
      {credits > 0 ? <p className={[p.small, p.muted].join(' ')}>Your project unlocks are not used while the monthly plan is active. They stay on your account.</p> : null}
      <BillingActions account={account} subscribed />
    </div>
  );
}

// Premium from a promo code: free, with an end date, and nothing renews.
function PremiumPlan({ account, premiumUntil }: { account: BillingAccount | null; premiumUntil: string }) {
  return (
    <div className={[s.card, s.active].join(' ')}>
      <div className={s.head}>
        <Label color="slate">Premium</Label>
        <span className={s.pill}>Free</span>
      </div>
      <p className={s.title}>Unlimited projects and AI features, free from your code</p>
      <ul className={s.perks}>
        {MONTHLY_PERKS.map((perk) => (
          <li key={perk.strong}>
            <strong>{perk.strong}</strong> {perk.rest}
          </li>
        ))}
      </ul>
      <dl className={s.facts}>
        <div>
          <dt>Premium ends</dt>
          <dd>
            {formatDate(premiumUntil)} at {formatTime(premiumUntil)}
          </dd>
        </div>
        <div>
          <dt>Then</dt>
          <dd>Free plan</dd>
        </div>
      </dl>
      <p className={[p.small, p.muted].join(' ')}>It does not renew: your account then goes back to the Free plan. No payment details are stored.</p>
      <BillingActions account={account} subscribed={false} />
    </div>
  );
}

function FreePlan({ account, freeAvailable, credits }: { account: BillingAccount | null; freeAvailable: boolean; credits: number }) {
  const ended = account?.subscription_status && ['canceled', 'unpaid', 'incomplete_expired', 'paused'].includes(account.subscription_status);

  return (
    <>
      <div className={s.card}>
        <div className={s.head}>
          <Label>Free plan</Label>
          <span className={[s.pill, s.pillQuiet].join(' ')}>Current plan</span>
        </div>
        <p className={s.title}>1 project with 1 brief breakdown and 1 contribution statement</p>
        {ended ? (
          <p className={s.warn}>Your monthly plan has ended. Projects created under it keep their data; AI features on them are paused until you subscribe again or unlock the project.</p>
        ) : null}
        <dl className={s.facts}>
          <div>
            <dt>Free project</dt>
            <dd>{freeAvailable ? 'Available' : 'Used'}</dd>
          </div>
          <div>
            <dt>Project unlocks</dt>
            <dd>{credits > 0 ? `${unlockText(credits)} ready` : 'None'}</dd>
          </div>
        </dl>
        {credits > 0 ? <p className={[p.small, p.muted].join(' ')}>Each unlock gives a new project 3 brief breakdowns and 3 contribution statements. It is used when you create your next project.</p> : null}
        <BillingActions account={account} subscribed={false} />
      </div>

      <div className={[s.card, s.offer].join(' ')}>
        <div className={s.head}>
          <Label color="slate">Monthly plan</Label>
          <span className={s.price}>
            7.99 euro <span className={s.per}>a month</span>
          </span>
        </div>
        <ul className={s.perks}>
          {MONTHLY_PERKS.map((perk) => (
            <li key={perk.strong}>
              <strong>{perk.strong}</strong> {perk.rest}
            </li>
          ))}
        </ul>
        <div className={s.actions}>
          <ButtonLink to="/pricing">See plans</ButtonLink>
          {!PAYMENTS_AVAILABLE ? <span className={[p.small, p.muted].join(' ')}>Paid plans are not available yet.</span> : null}
        </div>
      </div>
    </>
  );
}

function BillingActions({ account, subscribed }: { account: BillingAccount | null; subscribed: boolean }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  if (!account?.has_customer) {
    return subscribed ? (
      <div className={s.actions}>
        <ButtonLink to="/pricing" variant="secondary">
          See all plans
        </ButtonLink>
      </div>
    ) : null;
  }
  return (
    <div className={s.actions}>
      <Button
        variant="secondary"
        disabled={opening}
        onClick={async () => {
          setOpening(true);
          try {
            await openBillingPortal();
          } catch (err) {
            toast.show(`Error: ${errorMessage(codeOf(err))}`);
            setOpening(false);
          }
        }}
      >
        Manage billing
      </Button>
      <span className={[p.small, p.muted].join(' ')}>Cancel the plan, change your card or download invoices on Stripe.</span>
    </div>
  );
}
