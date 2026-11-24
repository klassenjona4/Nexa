import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { ButtonLink } from '../../components/Button';
import type { RedeemPromoResponse } from '../../lib/promo';
import { PremiumTerms, RedeemConfirmation, RedeemForm } from './RedeemForm';
import s from './Redeem.module.css';

// Opened from the QR code: /redeem?code=XXXXXXXXXX. Sign in (or sign up) keeps the address,
// including the code, through the sign in link, so the code is filled in here afterwards.
// Nothing here reveals whether a code exists until the server answers.
export function Redeem() {
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const [result, setResult] = useState<RedeemPromoResponse | null>(null);
  const initialCode = (params.get('code') ?? '').slice(0, 64);
  const needsName = !!profile && profile.full_name.trim() === '';

  if (result) {
    return (
      <div className={p.content}>
        <section className={s.panel}>
          <RedeemConfirmation result={result} />
          <div className={p.stack}>
            <ButtonLink to="/projects" size="lg">
              {needsName ? 'Continue' : 'Go to your projects'}
            </ButtonLink>
            <ButtonLink to="/account" variant="secondary">
              See it in account settings
            </ButtonLink>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={p.content}>
      <section className={s.panel} aria-labelledby="redeem-title">
        <div className={p.stack}>
          <h1 id="redeem-title" className={p.h1}>
            Redeem your code
          </h1>
          <p className={p.intro}>Premium gives you everything in the monthly plan: unlimited projects, and brief breakdowns and statements within the fair use limit of each project.</p>
        </div>
        <RedeemForm initialCode={initialCode} onRedeemed={setResult} />
        <PremiumTerms />
      </section>
    </div>
  );
}
