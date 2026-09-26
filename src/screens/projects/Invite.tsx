import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { formatDate, formatDateTime } from '../../../shared/dates';
import { email as emailSchema } from '../../../shared/schemas/common';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { Card, InlineNotice } from '../../components/Display';
import { TextField } from '../../components/Field';
import { QRCode } from '../../components/QRCode';
import { ErrorPanel, LoadingState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { firstName, useProject } from '../../lib/project';
import s from './Invite.module.css';

type InviteData = {
  link: { id: string; url: string; use_count: number; max_uses: number; expires_at: string } | null;
  pending: { id: string; email: string; created_at: string; expires_at: string }[];
};

export function Invite() {
  const { project, isOwner, members } = useProject();
  const owners = members.filter((m) => m.role === 'owner').map((m) => firstName(m.full_name));

  if (!isOwner) {
    return (
      <div className={p.content}>
        <PageHeader title="Invite members" intro="Only group owners can create invite links and send invites." />
        <InlineNotice>Ask {owners.join(' or ') || 'a group owner'} for the invite link.</InlineNotice>
      </div>
    );
  }
  return <OwnerInvite projectId={project.id} memberCount={members.length} />;
}

function OwnerInvite({ projectId, memberCount }: { projectId: string; memberCount: number }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(true);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const creating = useRef(false);
  const key = ['invites', projectId];

  const q = useQuery({ queryKey: key, queryFn: () => api<InviteData>(`/api/projects/${projectId}/invites`) });
  const createLink = useMutation({
    mutationFn: () => api(`/api/projects/${projectId}/invites`, { body: { kind: 'link' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const full = memberCount >= 8;

  // A group always has one active link while it has room for more members.
  useEffect(() => {
    if (q.data && !q.data.link && !full && !creating.current) {
      creating.current = true;
      createLink.mutate();
    }
  }, [q.data, full, createLink]);

  const sendEmail = useMutation({
    mutationFn: (address: string) => api(`/api/projects/${projectId}/invites`, { body: { kind: 'email', email: address } }),
    onSuccess: (_d, address) => {
      setEmail('');
      toast.show(`Invite sent to ${address}.`);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (err) => setEmailError(errorMessage(codeOf(err))),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/invites/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  const link = q.data?.link;
  const expires = link ? formatDate(link.expires_at) : '';

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.show('Invite link copied.');
    } catch {
      toast.show('The link could not be copied. Select it and copy it by hand.');
    }
  };
  const share = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my group on Nexa', url: link.url });
      } catch {
        // Cancelled by the user.
      }
    } else {
      await copy();
    }
  };
  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError('Enter an email address in the format name@example.ie.');
      return;
    }
    sendEmail.mutate(parsed.data);
  };

  const intro = link
    ? `Anyone with the link can see the project summary and join the group. The link expires on ${expires}. Groups can have up to 8 members.`
    : 'Anyone with the link can see the project summary and join the group. Links expire after 7 days. Groups can have up to 8 members.';

  if (q.isPending) return <div className={p.content}><PageHeader title="Invite members" /><LoadingState text="Loading invites" /></div>;
  if (q.isError) {
    return (
      <div className={p.content}>
        <PageHeader title="Invite members" />
        <ErrorPanel title="The invite link could not be created" body="Try again. If this keeps happening, contact the site operator." onRetry={() => void q.refetch()} />
      </div>
    );
  }

  return (
    <div className={p.content}>
      <PageHeader title="Invite members" intro={intro} />
      <div className={s.grid}>
        <Card>
          {full ? (
            <InlineNotice>The group has 8 members, the maximum. Remove a member in group settings to invite someone else.</InlineNotice>
          ) : link ? (
            <>
              <TextField label="Invite link" readOnly value={link.url} onFocus={(e) => e.target.select()} hint={`Used ${link.use_count} of ${link.max_uses} times · Expires ${expires}`} />
              <div className={s.buttons}>
                <Button size="lg" onClick={() => void copy()}>
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
                <Button size="lg" variant="secondary" onClick={() => void share()}>
                  Share
                </Button>
                <Button size="lg" variant="secondary" aria-expanded={qrOpen} onClick={() => setQrOpen((v) => !v)}>
                  {qrOpen ? 'Hide QR code' : 'Show QR code'}
                </Button>
              </div>
              {qrOpen ? (
                <div className={s.qrRow}>
                  <div className={s.qr}>
                    <QRCode value={link.url} label="QR code for the invite link" />
                  </div>
                  <p className={[p.small, p.muted].join(' ')}>Scan with a phone camera to open the invite. Show this on screen in a tutorial or meeting.</p>
                </div>
              ) : null}
              <Button variant="text" className={s.start} onClick={() => createLink.mutate(undefined, { onSuccess: () => toast.show('New invite link created. The old link no longer works.') })}>
                Create a new link
              </Button>
            </>
          ) : (
            <LoadingState text="Creating the invite link" />
          )}
          <form onSubmit={submitEmail} className={s.emailForm} noValidate>
            <div className={s.emailRow}>
              <TextField
                className={s.grow}
                label="Or send the link by email"
                type="email"
                placeholder="name@mymtu.ie"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                error={emailError}
                disabled={full}
              />
              <Button type="submit" variant="secondary" disabled={full || sendEmail.isPending} className={s.send}>
                Send
              </Button>
            </div>
          </form>
        </Card>
        <Card compact={false}>
          <div className={s.pendingHead}>
            <h2 className={p.h3}>Pending invites</h2>
            <span className={[p.small, p.muted].join(' ')}>{q.data.pending.length} pending</span>
          </div>
          {q.data.pending.length === 0 ? (
            <p className={[p.serif, p.muted, s.ruleTop].join(' ')}>No pending invites. Invites sent by email appear here until the person joins or the invite expires.</p>
          ) : (
            <ul className={s.list}>
              {q.data.pending.map((i) => (
                <li key={i.id} className={s.item}>
                  <span className={s.itemText}>
                    <span className={s.itemEmail}>{i.email}</span>
                    <span className={p.caption}>
                      Sent {formatDateTime(i.created_at)} · Expires {formatDate(i.expires_at)}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Revoke invite for ${i.email}`}
                    onClick={() => revoke.mutate(i.id, { onSuccess: () => toast.show(`Invite for ${i.email} revoked.`) })}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
