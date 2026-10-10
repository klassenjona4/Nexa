import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Display';
import { TextField } from '../../components/Field';
import { ConfirmDialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { firstName, type Member, useProject } from '../../lib/project';
import s from './GroupSettings.module.css';

type Dialog = { kind: 'remove'; member: Member } | { kind: 'leave' } | { kind: 'delete' } | null;

export function GroupSettings() {
  const { project, members, isOwner } = useProject();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(project.group_name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['project', project.id] });
    await qc.invalidateQueries({ queryKey: ['projects'] });
  };
  const fail = (err: unknown) => toast.show(`Error: ${errorMessage(codeOf(err))}`);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Enter a group name.');
      return;
    }
    try {
      await api(`/api/groups/${project.group_id}`, { method: 'PATCH', body: { name: name.trim() } });
      await refresh();
      toast.show('Group settings saved.');
    } catch (err) {
      setNameError(errorMessage(codeOf(err)));
    }
  };

  const changeRole = async (m: Member, role: 'owner' | 'member') => {
    try {
      await api(`/api/groups/${project.group_id}/members/${m.user_id}`, { method: 'PATCH', body: { role } });
      await refresh();
      toast.show(`Role for ${m.full_name} changed.`);
    } catch (err) {
      await refresh();
      fail(err);
    }
  };

  const onlyOwner = isOwner && members.filter((m) => m.role === 'owner').length === 1;
  const successor = members.filter((m) => m.user_id !== user?.id).sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];

  const leaveBody = [
    'Your open tasks become unassigned. Your log entries stay in the group record.',
    onlyOwner && successor ? `You are the only owner, so ${successor.full_name} becomes owner.` : '',
    members.length === 1 ? 'You are the only member, so the group and its data are deleted.' : '',
    'To join again you need a new invite link.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={p.content}>
      <div className={[p.stackLg].join(' ')} style={{ maxWidth: 720, gap: 32 }}>
        <PageHeader title="Group settings" />
        <form onSubmit={saveName} noValidate>
          <div className={s.nameRow}>
            <TextField
              className={s.grow}
              label="Group name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              error={nameError}
              maxLength={80}
              disabled={!isOwner}
              hint={isOwner ? undefined : 'Only owners can change the group name.'}
            />
            {isOwner ? (
              <Button type="submit" className={s.save}>
                Save
              </Button>
            ) : null}
          </div>
        </form>

        <section aria-labelledby="members-title">
          <div className={s.head}>
            <h2 id="members-title" className={p.h2}>
              Members
            </h2>
            <span className={[p.small, p.muted].join(' ')}>{members.length} of 8</span>
          </div>
          {members.map((m) => {
            const isMe = m.user_id === user?.id;
            return (
              <div key={m.user_id} className={s.member}>
                <Avatar name={m.full_name} size={40} />
                <span className={s.memberText}>
                  <span className={s.memberName}>
                    {m.full_name || 'Member'}
                    {isMe ? ' (you)' : ''}
                  </span>
                  <span className={s.memberEmail}>{m.email}</span>
                </span>
                <label className={s.role}>
                  Role
                  <select className={s.select} value={m.role} disabled={!isOwner || isMe} onChange={(e) => void changeRole(m, e.target.value as 'owner' | 'member')}>
                    <option value="owner">Owner</option>
                    <option value="member">Member</option>
                  </select>
                </label>
                {isOwner && !isMe ? (
                  <Button size="sm" variant="secondary" aria-label={`Remove ${m.full_name}`} onClick={() => setDialog({ kind: 'remove', member: m })}>
                    Remove
                  </Button>
                ) : null}
              </div>
            );
          })}
          {members.length === 1 ? (
            <p className={p.serif} style={{ padding: '16px 0', color: 'var(--graphite)' }}>
              You are the only member. <Link to={`/p/${project.id}/invite`}>Invite members</Link> to split the tasks.
            </p>
          ) : null}
        </section>

        <section className={s.danger} aria-labelledby="leave-title">
          <h2 id="leave-title" className={p.h2}>
            Leave or delete
          </h2>
          <div className={[s.dangerRow, s.ruled].join(' ')}>
            <p className={[p.serif, p.muted].join(' ')}>Leave the group. Your open tasks become unassigned and your log entries stay in the record.</p>
            <Button variant="secondary" onClick={() => setDialog({ kind: 'leave' })}>
              Leave group
            </Button>
          </div>
          <div className={s.dangerRow}>
            <p className={[p.serif, p.muted].join(' ')}>Delete the group, its project, tasks, brief and contribution log for all members. Only owners can do this.</p>
            <Button variant="destructive" disabled={!isOwner} onClick={() => setDialog({ kind: 'delete' })}>
              Delete group
            </Button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        label="Remove member"
        title={dialog?.kind === 'remove' ? `Remove ${dialog.member.full_name} from the group?` : ''}
        body={
          dialog?.kind === 'remove'
            ? `${firstName(dialog.member.full_name)} loses access to the board and the log. Tasks assigned to ${firstName(dialog.member.full_name)} become unassigned. Log entries by ${firstName(dialog.member.full_name)} stay in the record.`
            : ''
        }
        confirmLabel="Remove member"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== 'remove') return;
          try {
            await api(`/api/groups/${project.group_id}/members/${dialog.member.user_id}`, { method: 'DELETE' });
            await refresh();
            toast.show(`${dialog.member.full_name} was removed from the group.`);
          } catch (err) {
            fail(err);
          }
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'leave'}
        label="Leave group"
        title={`Leave ${project.group_name}?`}
        body={leaveBody}
        confirmLabel="Leave group"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          try {
            await api(`/api/groups/${project.group_id}/leave`, { method: 'POST' });
            setDialog(null);
            qc.clear();
            navigate('/projects');
            toast.show(`You left ${project.group_name}.`);
          } catch (err) {
            setDialog(null);
            fail(err);
          }
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        label="Delete group"
        title={`Delete ${project.group_name}?`}
        body={`This permanently deletes the project, its tasks, the brief and the contribution log for all ${members.length} ${members.length === 1 ? 'member' : 'members'}. Exported statements are not affected. This cannot be undone.`}
        requireText={project.group_name}
        confirmLabel="Delete group"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          try {
            await api(`/api/groups/${project.group_id}`, { method: 'DELETE', body: { confirm_name: project.group_name } });
            setDialog(null);
            qc.clear();
            navigate('/projects');
            toast.show(`${project.group_name} was deleted.`);
          } catch (err) {
            setDialog(null);
            fail(err);
          }
        }}
      />
    </div>
  );
}
