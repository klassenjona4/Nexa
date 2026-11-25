import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDateTime } from '../../../shared/dates';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/Dialog';
import { TextField } from '../../components/Field';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { downloadFromApi } from '../../lib/download';
import { errorMessage } from '../../lib/errors';
import { type RedeemPromoResponse, saveEmailUpdates, useEmailUpdates } from '../../lib/promo';
import { RedeemConfirmation, RedeemForm } from '../promo/RedeemForm';
import s from './Account.module.css';
import { Billing } from './Billing';

export function Account() {
  const { user, profile, signOut } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const provider = (user?.app_metadata?.provider as string | undefined) === 'google' ? 'Signed in with Google.' : 'Signed in with email link.';

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setNameError('Enter your full name.');
    try {
      await api('/api/profile', { method: 'PATCH', body: { full_name: name.trim() } });
      await qc.invalidateQueries({ queryKey: ['profile', user?.id] });
      await qc.invalidateQueries({ queryKey: ['project'] });
      toast.show('Profile saved.');
    } catch (err) {
      setNameError(errorMessage(codeOf(err)));
    }
  };

  return (
    <div className={p.content}>
      <div className={p.stackLg} style={{ maxWidth: 720, gap: 32 }}>
        <PageHeader title="Account settings" />
        <form onSubmit={saveProfile} className={s.section} noValidate>
          <h2 className={[p.h2, p.h2Rule].join(' ')}>Profile</h2>
          <div className={s.row}>
            <TextField label="Full name" autoComplete="name" value={name} maxLength={100} onChange={(e) => { setName(e.target.value); setNameError(null); }} error={nameError} />
          </div>
          <div className={s.readonly}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Email address</span>
            <span>{user?.email}</span>
            <span className={p.caption}>Used for sign in links and reminders. {provider}</span>
          </div>
          <Button type="submit" className={s.start}>
            Save profile
          </Button>
        </form>

        <Billing userId={user?.id} />

        <RedeemSection />

        <EmailUpdates userId={user?.id} />

        <section className={s.section} aria-labelledby="data-title">
          <h2 id="data-title" className={[p.h2, p.h2Rule].join(' ')}>
            Your data
          </h2>
          <p className={[p.serif, p.muted].join(' ')}>Download a JSON file with your profile, group memberships, tasks, file links, log entries, confirmations, flags, statements you drafted or edited, and calendar links.</p>
          <Button
            variant="secondary"
            className={s.start}
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await downloadFromApi('/api/account/export', 'nexa-data.json');
                toast.show('Your data was downloaded as a JSON file.');
              } catch (err) {
                toast.show(`Error: ${errorMessage(codeOf(err))}`);
              } finally {
                setExporting(false);
              }
            }}
          >
            Download my data
          </Button>
        </section>

        <section className={s.section} aria-labelledby="delete-title">
          <h2 id="delete-title" className={[p.h2, p.h2Rule].join(' ')}>
            Delete account
          </h2>
          <p className={[p.serif, p.muted].join(' ')}>
            Your profile and sign in details are deleted immediately. Groups where you are the only member are deleted with their data. Your entries in other groups' logs stay under the name Former member so group records stay accurate.
          </p>
          <Button variant="destructive" className={s.start} onClick={() => setDeleting(true)}>
            Delete my account
          </Button>
        </section>

        <nav aria-label="Legal and session" className={s.links}>
          <Link to="/pricing">Pricing</Link>
          <Link to="/help">Help</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of use</Link>
          <Button variant="text" onClick={() => {
              navigate('/', { replace: true });
              void signOut();
            }}>
            Sign out
          </Button>
        </nav>
      </div>

      <ConfirmDialog
        open={deleting}
        label="Delete account"
        title="Delete your account?"
        body="Your profile and sign in details are deleted immediately. Your log entries stay in group records under the name Former member. If you are the only owner of a group, ownership passes to the member who joined first. This cannot be undone."
        requireText="DELETE"
        confirmLabel="Delete my account"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await api('/api/account/delete', { body: { confirm: 'DELETE' } });
            navigate('/', { replace: true });
            await signOut();
            toast.show('Your account was deleted.');
          } catch (err) {
            setDeleting(false);
            toast.show(`Error: ${errorMessage(codeOf(err))}`);
          }
        }}
      />
    </div>
  );
}

function RedeemSection() {
  const [result, setResult] = useState<RedeemPromoResponse | null>(null);
  return (
    <section className={s.section} aria-labelledby="redeem-title">
      <h2 id="redeem-title" className={[p.h2, p.h2Rule].join(' ')}>
        Redeem code
      </h2>
      {result ? (
        <RedeemConfirmation result={result} headingLevel="h3" />
      ) : (
        <div className={s.row}>
          <RedeemForm compact onRedeemed={setResult} />
        </div>
      )}
    </section>
  );
}

function EmailUpdates({ userId }: { userId: string | undefined }) {
  const consent = useEmailUpdates(userId);
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Shows the new choice at once and returns to the stored one if saving fails.
  const [pending, setPending] = useState<boolean | null>(null);
  const checked = pending ?? consent.data?.email_updates ?? false;

  return (
    <section className={s.section} aria-labelledby="emails-title">
      <h2 id="emails-title" className={[p.h2, p.h2Rule].join(' ')}>
        Emails about Nexa
      </h2>
      <label className={s.consent}>
        <input
          type="checkbox"
          checked={checked}
          disabled={busy || consent.isPending}
          onChange={async (e) => {
            const value = e.target.checked;
            setPending(value);
            setBusy(true);
            try {
              await saveEmailUpdates(value);
              await qc.invalidateQueries({ queryKey: ['email-updates', userId] });
              toast.show(value ? 'You will receive occasional emails about Nexa.' : 'You will no longer receive emails about Nexa.');
            } catch (err) {
              toast.show(`Error: ${errorMessage(codeOf(err))}`);
            } finally {
              setPending(null);
              setBusy(false);
            }
          }}
        />
        <span>Send me occasional emails about Nexa.</span>
      </label>
      <p className={p.caption}>
        Optional. Sign in links, invites, reminders and deletion notices are sent either way.
        {consent.data ? ` Last changed ${formatDateTime(consent.data.decided_at)}.` : ''}
      </p>
    </section>
  );
}
