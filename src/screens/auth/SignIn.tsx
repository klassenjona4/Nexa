import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import p from '../../app/page.module.css';
import { PublicFooter } from '../../app/Shell';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { Label } from '../../components/Label';
import { useToast } from '../../components/Toast';
import { ErrorPanel } from '../../components/States';
import { api, codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { magicLinkRequest, safeNextPathOrDefault } from './next';
import s from './SignIn.module.css';

export function SignIn() {
  const [params] = useSearchParams();
  const next = safeNextPathOrDefault(params.get('next'));
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const toast = useToast();

  const send = async (address: string) => {
    setBusy(true);
    setFailure(null);
    try {
      await api('/api/auth/magic-link', { body: { email: address, next }, auth: false });
      return true;
    } catch (err) {
      setFailure(errorMessage(codeOf(err)));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = magicLinkRequest.safeParse({ email, next });
    if (!parsed.success) {
      setError('Enter an email address in the format name@example.ie.');
      return;
    }
    if (await send(parsed.data.email)) setSent(parsed.data.email);
  };

  const google = async () => {
    setFailure(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (oauthError) setFailure(errorMessage('sign_in_unavailable'));
  };

  if (sent) {
    return (
      <div className={p.content}>
        <section className={s.panel}>
          <div role="status" className={p.stack}>
            <Label>Link sent</Label>
            <h1 className={p.h1}>Check your email</h1>
            <p className={p.serif}>
              A sign in link was sent to <strong className={s.email}>{sent}</strong>. Open the email on this device and select the link. It works once and expires after 15 minutes.
            </p>
            <p className={[p.serif, p.muted].join(' ')}>If the email has not arrived after 2 minutes, check your spam or junk folder.</p>
          </div>
          {failure ? <p className={s.failure}>Error: {failure}</p> : null}
          <div className={p.stack}>
            <Button
              size="lg"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (await send(sent)) toast.show('A new sign in link was sent. Earlier links no longer work.');
              }}
            >
              Send the link again
            </Button>
            <Button variant="text" onClick={() => setSent(null)} className={s.start}>
              Use a different email address
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={p.content}>
      <section className={s.panel} aria-labelledby="signin-title">
        <div className={p.stack}>
          <h1 id="signin-title" className={p.h1}>
            Sign in to Nexa
          </h1>
          <p className={p.intro}>Enter your email address and a sign in link will be sent to it. No password is needed. A new account is created the first time you sign in.</p>
        </div>
        {failure ? <ErrorPanel title="The sign in link was not sent" body={failure} /> : null}
        <form onSubmit={onSubmit} className={p.stack} noValidate>
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            error={error}
            required
          />
          <Button type="submit" size="lg" disabled={busy}>
            Send sign in link
          </Button>
        </form>
        <div className={s.or} aria-hidden="true">
          <span />
          or
          <span />
        </div>
        <Button size="lg" variant="secondary" onClick={() => void google()}>
          Continue with Google
        </Button>
        <p className={s.legal}>
          By signing in you accept the <Link to="/terms">terms of use</Link> and the <Link to="/privacy">privacy policy</Link>. You must be 16 or older.
        </p>
      </section>
      <PublicFooter />
    </div>
  );
}
