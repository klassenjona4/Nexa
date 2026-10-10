import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { formatDate, formatDateTime } from '../../../shared/dates';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { PublicFooter } from '../../app/Shell';
import { Button, ButtonLink } from '../../components/Button';
import { Avatar, Card } from '../../components/Display';
import { TextField } from '../../components/Field';
import { Label } from '../../components/Label';
import { ErrorPanel, LoadingState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useBreakpoint } from '../../lib/useBreakpoint';
import s from './Join.module.css';

type Preview = {
  group_name: string;
  inviter_name: string;
  title: string;
  module_code: string;
  final_deadline: string | null;
  expires_at: string;
  task_count: number;
  total_hours: number;
  members: { first_name: string; initials: string; role: 'owner' | 'member' }[];
  brief: {
    deliverables: { name: string; detail: string }[];
    deadlines: { item: string; due_at: string | null }[];
    criteria: { name: string; weight: number | null }[];
  } | null;
};

const CODE_RE = /^[A-Za-z0-9_-]{22}$/;

// Public page. Shows the project summary before sign up.
export function Join() {
  const { code = '' } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const bp = useBreakpoint();
  const valid = CODE_RE.test(code);
  const q = useQuery({
    queryKey: ['invite-preview', code],
    enabled: valid,
    retry: false,
    queryFn: () => api<Preview>(`/api/invites/${code}/preview`, { auth: false }),
  });

  useEffect(() => {
    document.documentElement.dataset.joinBar = bp === 'mobile' ? 'true' : 'false';
    return () => {
      delete document.documentElement.dataset.joinBar;
    };
  }, [bp]);

  const acceptPath = `/join/${code}/accept`;
  const joinWithEmail = () => navigate(session ? acceptPath : `/sign-in?next=${encodeURIComponent(acceptPath)}`);
  const joinWithGoogle = async () => {
    if (session) return navigate(acceptPath);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(acceptPath)}` },
    });
  };

  if (!valid || q.isError) {
    const code = q.isError ? codeOf(q.error) : 'invite_invalid';
    return (
      <div className={p.content}>
        <ErrorPanel
          title={code === 'rate_limited' ? 'Too many attempts' : 'This invite link no longer works'}
          body={code === 'rate_limited' ? errorMessage('rate_limited') : 'The link expired, was used the maximum number of times, or the group owner revoked it. Ask the group owner to send a new link.'}
        >
          <ButtonLink to="/" variant="secondary">
            About Nexa
          </ButtonLink>
        </ErrorPanel>
        <PublicFooter />
      </div>
    );
  }
  if (q.isPending) return <div className={p.content}><LoadingState text="Loading the invite" /></div>;

  const d = q.data;
  const deadlines = d.brief?.deadlines ?? [];
  return (
    <div className={p.content}>
      <PageHeader
        label={d.inviter_name ? `Invite from ${d.inviter_name}` : 'Invite'}
        title={`Join ${d.group_name} for ${d.title}`}
        intro={
          d.brief
            ? 'The brief below was read from the assignment document the group uploaded. After you join, you can take tasks on the group board and your completed work is recorded in the contribution log.'
            : 'After you join, you can take tasks on the group board and your completed work is recorded in the contribution log.'
        }
      />
      <div className={s.grid}>
        <Card>
          <Label>Project</Label>
          <dl className={p.dl}>
            {d.module_code ? (
              <>
                <dt>Module</dt>
                <dd>{d.module_code}</dd>
              </>
            ) : null}
            <dt>Assignment</dt>
            <dd>{d.title}</dd>
            <dt>Final deadline</dt>
            <dd className={p.num}>{d.final_deadline ? formatDateTime(d.final_deadline) : 'Not set'}</dd>
            <dt>Tasks</dt>
            <dd>{d.task_count ? `${d.task_count} tasks, ${d.total_hours} estimated hours` : 'No tasks yet'}</dd>
          </dl>
          <div className={s.members}>
            <span className={[p.small, p.muted].join(' ')}>
              {d.members.length} {d.members.length === 1 ? 'member' : 'members'}
            </span>
            <ul className={s.memberList}>
              {d.members.map((m, i) => (
                <li key={i} className={s.member}>
                  <span aria-hidden="true">
                    <Avatar name={m.first_name} text={m.initials} />
                  </span>
                  {m.first_name}
                  <span className="visually-hidden">, </span>
                  <span className={s.role}>{m.role === 'owner' ? 'Owner' : 'Member'}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        {d.brief ? (
          <Card>
            <Label>Extracted brief</Label>
            <div className={s.section}>
              <h2 className={p.h3}>Deliverables</h2>
              {d.brief.deliverables.map((x, i) => (
                <div key={i} className={s.row}>
                  <span>{x.name}</span>
                  <span className={s.right}>{x.detail}</span>
                </div>
              ))}
            </div>
            {deadlines.length ? (
              <div className={s.section}>
                <h2 className={p.h3}>Deadlines</h2>
                {deadlines.map((x, i) => (
                  <div key={i} className={s.row}>
                    <span>{x.item}</span>
                    <span className={s.num}>{x.due_at ? formatDateTime(x.due_at) : 'Not set'}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {d.brief.criteria.length ? (
              <div className={s.section}>
                <h2 className={p.h3}>Marking criteria</h2>
                {d.brief.criteria.map((x, i) => (
                  <div key={i} className={s.row}>
                    <span>{x.name}</span>
                    <span className={s.num}>{x.weight != null ? `${x.weight}%` : ''}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
      {bp !== 'mobile' ? (
        <div className={p.actions}>
          <Button size="lg" onClick={joinWithEmail}>
            {session ? `Join ${d.group_name}` : 'Join with email'}
          </Button>
          {!session ? (
            <Button size="lg" variant="secondary" onClick={() => void joinWithGoogle()}>
              Join with Google
            </Button>
          ) : null}
          <span className={[p.small, p.muted].join(' ')}>Invite link expires on {formatDate(d.expires_at)}.</span>
        </div>
      ) : (
        <>
          <p className={[p.small, p.muted].join(' ')}>Invite link expires on {formatDate(d.expires_at)}. You can sign in with email or Google on the next page.</p>
          <div className={s.spacer} />
          <div className={s.joinBar}>
            <Button size="lg" onClick={joinWithEmail}>
              Join {d.group_name}
            </Button>
          </div>
        </>
      )}
      <PublicFooter />
    </div>
  );
}

// Protected step after sign in. The server checks the code, expiry, uses and member limit.
export function JoinAccept() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ project_id: string; already_member: boolean }>(`/api/invites/${code}/accept`, { method: 'POST' })
      .then((res) => {
        toast.show(res.already_member ? 'You are already a member of this group.' : 'Invite accepted. You are now a member of the group.');
        navigate(`/p/${res.project_id}/board`, { replace: true });
      })
      .catch((err) => setError(codeOf(err)));
  }, [code, navigate, toast]);

  return (
    <div className={p.content}>
      <div className={p.narrow}>
        {error ? (
          <ErrorPanel title={error === 'group_full' ? 'The group is full' : 'This invite link no longer works'} body={errorMessage(error)}>
            <ButtonLink to="/projects">Your projects</ButtonLink>
          </ErrorPanel>
        ) : (
          <LoadingState text="Joining the group" />
        )}
      </div>
    </div>
  );
}

// "I have an invite link": paste a link or code.
export function JoinEntry() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [go, setGo] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const match = /([A-Za-z0-9_-]{22})\/?$/.exec(value.trim());
    if (!match?.[1]) {
      setError('Paste the full invite link. It ends with /join/ followed by 22 letters and numbers.');
      return;
    }
    setGo(match[1]);
  };
  if (go) return <Navigate to={`/join/${go}`} />;
  return (
    <div className={p.content}>
      <div className={[p.narrow, p.stackLg].join(' ')}>
        <PageHeader title="Open an invite" intro="Paste the invite link a group owner sent you. You see the project summary before you sign in." />
        <form onSubmit={submit} className={p.stack} noValidate>
          <TextField label="Invite link" value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} error={error} autoComplete="off" />
          <div className={p.actions}>
            <Button type="submit" size="lg">Open invite</Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('/')}>Cancel</Button>
          </div>
        </form>
      </div>
      <PublicFooter />
    </div>
  );
}
