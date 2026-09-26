import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import p from '../../app/page.module.css';
import { ErrorPanel, LoadingState } from '../../components/States';
import { ButtonLink } from '../../components/Button';
import { supabase } from '../../lib/supabase';
import { safeNextPathOrDefault } from './next';

// Opened from the sign in email. Exchanges the one time token hash for a session.
export function AuthConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [verifyFailed, setVerifyFailed] = useState(false);
  const started = useRef(false);
  const tokenHash = params.get('token_hash');
  const rawType = params.get('type');
  const type = rawType === 'signup' ? 'signup' : rawType === 'magiclink' ? 'magiclink' : null;
  const valid = !!tokenHash && !!type && /^[A-Za-z0-9_-]{10,200}$/.test(tokenHash);
  const failed = !valid || verifyFailed;

  useEffect(() => {
    if (started.current || !valid || !tokenHash || !type) return;
    started.current = true;
    const next = safeNextPathOrDefault(params.get('next'));
    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) setVerifyFailed(true);
      else navigate(next, { replace: true });
    });
  }, [valid, tokenHash, type, params, navigate]);

  return (
    <div className={p.content}>
      <div className={p.narrow}>
        {failed ? (
          <ErrorPanel title="The sign in link has expired" body="Sign in links work once and expire after 15 minutes. Request a new link to sign in.">
            <ButtonLink to={`/sign-in?next=${encodeURIComponent(safeNextPathOrDefault(params.get('next')))}`}>Request a new link</ButtonLink>
          </ErrorPanel>
        ) : (
          <LoadingState text="Signing you in" />
        )}
      </div>
    </div>
  );
}

// Return address for Google sign in. supabase-js exchanges the code automatically.
export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(!!params.get('error'));

  useEffect(() => {
    if (failed) return;
    const next = safeNextPathOrDefault(params.get('next'));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate(next, { replace: true });
    });
    const timer = window.setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) navigate(next, { replace: true });
      else setFailed(true);
    }, 8000);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [failed, params, navigate]);

  return (
    <div className={p.content}>
      <div className={p.narrow}>
        {failed ? (
          <ErrorPanel title="Google sign in did not complete" body="The sign in was cancelled or Google did not confirm it. Try again or use a sign in link instead.">
            <ButtonLink to="/sign-in">Back to sign in</ButtonLink>
          </ErrorPanel>
        ) : (
          <LoadingState text="Signing you in" />
        )}
      </div>
    </div>
  );
}
