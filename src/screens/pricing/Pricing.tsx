import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { PublicFooter } from '../../app/Shell';
import { Button, ButtonLink } from '../../components/Button';
import { InlineNotice } from '../../components/Display';
import { Label } from '../../components/Label';
import { codeOf } from '../../lib/api';
import { startCheckout, useEntitlements } from '../../lib/billing';
import { errorMessage } from '../../lib/errors';
import s from './Pricing.module.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Pricing() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const projectParam = params.get('project');
  const projectId = projectParam && UUID.test(projectParam) ? projectParam : undefined;
  const cancelled = params.get('billing') === 'cancelled';
  const entitlements = useEntitlements(!!session);
  const [startNow, setStartNow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscribed = entitlements.data?.subscriptionActive ?? false;

  const buy = async (kind: 'project' | 'subscription', forProject?: string) => {
    setError(null);
    if (!startNow) return setError('Tick the box above the plans to continue.');
    setBusy(kind);
    try {
      await startCheckout(kind, forProject);
    } catch (err) {
      setError(errorMessage(codeOf(err)));
      setBusy(null);
    }
  };

  const signInTo = `/sign-in?next=${encodeURIComponent(`/pricing${projectId ? `?project=${projectId}` : ''}`)}`;
  const action = (kind: 'project' | 'subscription', label: string, forProject?: string) =>
    session ? (
      <Button onClick={() => void buy(kind, forProject)} disabled={!!busy || (kind === 'subscription' && subscribed)}>
        {busy === kind ? 'Opening Stripe' : label}
      </Button>
    ) : (
      <ButtonLink to={signInTo}>Sign in to continue</ButtonLink>
    );

  return (
    <div className={[p.content, p.wide].join(' ')} style={{ gap: 32 }}>
      <div className={p.stack} style={{ gap: 12, maxWidth: 720 }}>
        <Label>Pricing</Label>
        <h1 className={p.h1}>Plans and prices</h1>
        <p className={[p.serif, p.muted].join(' ')}>
          A project is paid for by the member who creates it. Members who join a project use its allowance and pay nothing. Payments are handled by Stripe; Nexa does not see or store card details.
        </p>
      </div>
      {cancelled ? <InlineNotice role="status">The payment was cancelled. Nothing was charged.</InlineNotice> : null}
      {projectId ? (
        <InlineNotice role="note">You are unlocking more AI use for one project. The 2 euro unlock below adds 3 brief breakdowns and 3 contribution statements to it.</InlineNotice>
      ) : null}
      {session ? (
        <label className={s.consent}>
          <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} />
          <span>
            I ask for the unlock or plan to start immediately. I understand that I lose my 14 day right of withdrawal once it has been provided in full, and that if I withdraw from the monthly plan I pay for the time already provided. I can cancel the monthly plan at any time.
          </span>
        </label>
      ) : null}
      {error ? (
        <p role="alert" className={p.small} style={{ color: 'var(--rust)', fontWeight: 600 }}>
          Error: {error}
        </p>
      ) : null}
      <ul className={s.plans}>
        <li className={s.plan}>
          <Label>Free</Label>
          <p className={s.price}>
            0 euro
          </p>
          <ul className={[s.list, s.grow].join(' ')}>
            <li>1 project</li>
            <li>1 brief breakdown</li>
            <li>1 contribution statement</li>
            <li>Task board, contribution log, invites and calendar feed</li>
          </ul>
          {session ? (
            <p className={[p.small, p.muted].join(' ')}>{entitlements.data?.freeProjectAvailable ? 'Your free project is available.' : 'Your free project is used.'}</p>
          ) : (
            <ButtonLink to="/sign-in" variant="secondary">
              Sign in
            </ButtonLink>
          )}
        </li>
        <li className={s.plan}>
          <Label>Project unlock</Label>
          <p className={s.price}>
            2 euro <span className={s.per}>once</span>
          </p>
          <ul className={[s.list, s.grow].join(' ')}>
            <li>1 more project, or more use on an existing project</li>
            <li>3 brief breakdowns</li>
            <li>3 contribution statements</li>
            <li>Drafting a statement again counts as one statement</li>
          </ul>
          {projectId ? action('project', 'Unlock this project', projectId) : action('project', 'Unlock a project')}
          {session && entitlements.data?.projectCredits ? (
            <p className={[p.small, p.muted].join(' ')}>
              You have {entitlements.data.projectCredits} unused {entitlements.data.projectCredits === 1 ? 'unlock' : 'unlocks'}. It is used when you create your next project.
            </p>
          ) : null}
        </li>
        <li className={s.plan}>
          <Label>Monthly plan</Label>
          <p className={s.price}>
            7.99 euro <span className={s.per}>a month</span>
          </p>
          <ul className={[s.list, s.grow].join(' ')}>
            <li>Unlimited projects</li>
            <li>Unlimited brief breakdowns and statements, within a fair use limit per project</li>
            <li>Cancel at any time in Account settings</li>
            <li>When the plan ends, projects and data stay; AI features on them pause</li>
          </ul>
          {subscribed ? <p className={[p.small, p.muted].join(' ')}>Your monthly plan is active.</p> : action('subscription', 'Choose the monthly plan')}
        </li>
      </ul>
      <p className={[p.small, p.muted].join(' ')} style={{ maxWidth: 720 }}>
        The fair use limit is 30 brief breakdowns and 30 statements per project, to protect the service from automated use. Payments are processed in euro by Stripe Payments Europe, Ltd., Dublin.
      </p>
      <PublicFooter />
    </div>
  );
}
