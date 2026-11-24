import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { formatDate, formatLongDate, formatTime } from '../../../shared/dates';
import { normalisePromoCode } from '../../../shared/promo';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { Label } from '../../components/Label';
import { codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { redeemCode, type RedeemPromoResponse, useEmailUpdates } from '../../lib/promo';
import s from './Redeem.module.css';

// The plain terms shown before and after redeeming. No payment details, no automatic renewal.
export function PremiumTerms() {
  return (
    <p className={[p.small, p.muted].join(' ')}>
      Premium from a code is free for 30 days and then simply ends. Your account goes back to the Free plan on its own. No payment details are collected and nothing renews automatically.
    </p>
  );
}

export function RedeemConfirmation({ result, headingLevel = 'h1' }: { result: RedeemPromoResponse; headingLevel?: 'h1' | 'h3' }) {
  const H = headingLevel;
  return (
    <div role="status" className={[s.confirm, p.stack].join(' ')}>
      <Label>Premium is active</Label>
      <H className={headingLevel === 'h1' ? p.h1 : p.h3}>Premium until {formatLongDate(result.premium_until)}</H>
      <p className={p.serif}>
        Your free Premium runs for {result.premium_days} days, until <strong>{formatDate(result.premium_until)} at {formatTime(result.premium_until)}</strong> Irish time. After that it simply ends and your account goes back to the Free plan.
        No payment details were collected and nothing renews automatically.
      </p>
      <p className={[p.small, p.muted].join(' ')}>
        Projects you create during Premium keep their tasks, log and files afterwards. Brief breakdowns and statements in those projects stop when Premium ends.
      </p>
    </div>
  );
}

// Used on the redeem page (code from the QR link) and in account settings.
export function RedeemForm({ initialCode = '', onRedeemed, compact = false }: { initialCode?: string; onRedeemed: (r: RedeemPromoResponse) => void; compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const consent = useEmailUpdates(user?.id);
  const [code, setCode] = useState(initialCode);
  // Unticked unless the person already chose to receive emails.
  const [emails, setEmails] = useState<boolean | null>(null);
  const emailChoice = emails ?? consent.data?.email_updates ?? false;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = normalisePromoCode(code);
    if (!value) {
      setError('Enter the code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // The email choice is sent only when the person changed it or has never made one.
      const send = emails !== null || !consent.data ? emailChoice : undefined;
      const result = await redeemCode(value, send);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['entitlements'] }),
        qc.invalidateQueries({ queryKey: ['billing-account'] }),
        qc.invalidateQueries({ queryKey: ['email-updates'] }),
      ]);
      onRedeemed(result);
    } catch (err) {
      setError(errorMessage(codeOf(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={p.stack} noValidate>
      <TextField
        label="Code"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        error={error}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={64}
        className={s.code}
      />
      {compact ? null : (
        <label className={s.consent}>
          <input type="checkbox" checked={emailChoice} onChange={(e) => setEmails(e.target.checked)} />
          <span>
            Send me occasional emails about Nexa.
            <span className={s.consentHint}>Optional. You can redeem the code without it and change this any time in account settings.</span>
          </span>
        </label>
      )}
      <Button type="submit" size={compact ? undefined : 'lg'} disabled={busy} className={compact ? s.start : undefined}>
        {busy ? 'Redeeming' : 'Redeem code'}
      </Button>
    </form>
  );
}
