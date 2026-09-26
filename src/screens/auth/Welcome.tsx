import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { api, codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { safeNextPathOrDefault } from './next';

// Shown once after the first sign in, because a sign in link carries no name.
// Teammates see this name on the board, in the log and in the contribution statement.
export function Welcome() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (value.length < 1 || value.length > 100) {
      setError('Enter your full name, up to 100 characters.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/profile', { method: 'PATCH', body: { full_name: value } });
      await qc.invalidateQueries({ queryKey: ['profile', user?.id] });
      navigate(safeNextPathOrDefault(params.get('next')), { replace: true });
    } catch (err) {
      setError(errorMessage(codeOf(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={p.content}>
      <div className={p.narrow}>
        <div className={p.stackLg}>
          <PageHeader label="Your account" title="Enter your name" intro="Members of your groups see this name on the task board, in the contribution log and in the contribution statement." />
          <form onSubmit={submit} className={p.stack} noValidate>
            <TextField label="Full name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} error={error} maxLength={100} required />
            <div className={p.actions}>
              <Button type="submit" size="lg" disabled={busy}>
                Continue
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
