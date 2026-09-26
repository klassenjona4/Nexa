import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDate, formatDateTime } from '../../../shared/dates';
import { addLink as addLinkSchema } from '../../../shared/schemas/tasks';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/Controls';
import { ConfirmDialog } from '../../components/Dialog';
import { Badge, Card, STATUS_LABEL } from '../../components/Display';
import { TextArea, TextField } from '../../components/Field';
import { Label } from '../../components/Label';
import { ErrorPanel, LoadingState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { firstName, useProject } from '../../lib/project';
import { reviewsFor, type Task, taskKeys, useLog, useTaskLinks, useTasks } from '../../lib/tasks';
import { useBreakpoint } from '../../lib/useBreakpoint';
import { TaskFormDialog, type TaskFormValues, taskToForm } from './TaskForm';
import s from './TaskDetail.module.css';

export function TaskDetail() {
  const { taskId = '' } = useParams();
  const { project } = useProject();
  const tasks = useTasks(project.id);

  if (tasks.isPending) return <div className={p.content}><LoadingState text="Loading the task" /></div>;
  const index = tasks.data?.findIndex((t) => t.id === taskId) ?? -1;
  const task = index >= 0 ? tasks.data?.[index] : undefined;
  if (tasks.isError || !task) {
    return (
      <div className={p.content}>
        <ErrorPanel title="This task could not be loaded" body="The task may have been deleted. Return to the task board to see current tasks.">
          <Link to={`/p/${project.id}/board`}>Task board</Link>
        </ErrorPanel>
      </div>
    );
  }
  return <TaskView task={task} number={index + 1} />;
}

function TaskView({ task, number }: { task: Task; number: number }) {
  const { project, members, memberName, isOwner } = useProject();
  const { user } = useAuth();
  const bp = useBreakpoint();
  const links = useTaskLinks(task.id);
  const log = useLog(project.id);
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagNote, setFlagNote] = useState('');
  const [flagError, setFlagError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: taskKeys.list(project.id) }),
    qc.invalidateQueries({ queryKey: taskKeys.log(project.id) }),
    qc.invalidateQueries({ queryKey: taskKeys.links(task.id) }),
  ]);
  const fail = (err: unknown) => toast.show(`Error: ${errorMessage(codeOf(err))}`);

  const setStatus = async (status: Task['status']) => {
    qc.setQueryData<Task[]>(taskKeys.list(project.id), (old) => old?.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: { status } });
      toast.show(`Status changed to ${STATUS_LABEL[status]}. Recorded in the contribution log.`);
    } catch (err) {
      fail(err);
    }
    await refresh();
  };

  const submitLink = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = addLinkSchema.safeParse({ url: linkUrl });
    if (!parsed.success) {
      setLinkError('Enter a full link that starts with https://');
      return;
    }
    try {
      await api(`/api/tasks/${task.id}/links`, { body: parsed.data });
      setLinkUrl('');
      await refresh();
      toast.show('File link added and recorded in the contribution log.');
    } catch (err) {
      setLinkError(errorMessage(codeOf(err)));
    }
  };

  const review = async (kind: 'confirmed' | 'flagged') => {
    if (kind === 'flagged' && !flagNote.trim()) {
      setFlagError('Describe what is missing or incorrect.');
      return;
    }
    try {
      await api(`/api/tasks/${task.id}/reviews`, { body: kind === 'flagged' ? { kind, note: flagNote.trim() } : { kind } });
      setFlagOpen(false);
      setFlagNote('');
      await refresh();
      toast.show(kind === 'confirmed' ? 'Confirmation recorded in the contribution log.' : 'Flag recorded in the contribution log. The task owner and the group can see it.');
    } catch (err) {
      fail(err);
    }
  };

  const saveEdit = async (v: TaskFormValues) => {
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: v });
      setEditing(false);
      await refresh();
      toast.show('Task saved.');
    } catch (err) {
      fail(err);
    }
  };

  const reviews = reviewsFor(log.data ?? [], task);
  const mine = reviews.find((r) => r.actor_id === user?.id);
  const isAssignee = task.assignee_id === user?.id;
  const canAct = task.status === 'done' && !isAssignee && !mine;
  const ownerName = task.assignee_id ? memberName(task.assignee_id) : 'Unassigned';
  const note = canAct
    ? ''
    : mine
      ? `You ${mine.kind} this task on ${formatDateTime(mine.created_at)}.`
      : isAssignee
        ? task.status === 'done'
          ? 'Teammates can now confirm or flag this task.'
          : 'Teammates can confirm or flag this task after you mark it as done.'
        : 'Review opens when the owner marks the task as done.';
  const canDelete = isOwner || (task.created_by === user?.id && task.status === 'todo');

  return (
    <div className={p.content}>
      <div className={s.layout}>
        <div className={s.main}>
          {bp === 'desktop' ? (
            <Link to={`/p/${project.id}/board`} className={s.back}>
              ← Task board
            </Link>
          ) : null}
          <div className={p.stack} style={{ gap: 8 }}>
            <Label>{[`Task ${number}`, task.deliverable].filter(Boolean).join(' · ')}</Label>
            <h1 className={p.h1}>{task.title}</h1>
          </div>
          <SegmentedControl
            label="Status"
            options={[
              { value: 'todo', label: 'To do' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'done', label: 'Done' },
            ]}
            value={task.status}
            onChange={(v) => void setStatus(v)}
          />
          <section className={s.section} aria-labelledby="desc-title">
            <h2 id="desc-title" className={p.h3}>
              Description
            </h2>
            <p className={s.description}>{task.description || 'No description.'}</p>
          </section>
          <section className={s.section} aria-labelledby="links-title">
            <h2 id="links-title" className={p.h3}>
              Attached file links
            </h2>
            {(links.data ?? []).length === 0 ? <p className={s.none}>No file links yet. Add a link to a shared document so teammates can check the work.</p> : null}
            {(links.data ?? []).map((l) => (
              <div key={l.id} className={s.link}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className={s.linkName}>
                  {l.label || l.url}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
                <span className={s.linkMeta}>
                  {l.host} · Added by {memberName(l.added_by)} {formatDateTime(l.created_at)}
                </span>
              </div>
            ))}
            <form onSubmit={submitLink} className={s.addLink} noValidate>
              <TextField
                className={s.grow}
                label="File link"
                hideLabel
                type="url"
                placeholder="Paste a link to Google Drive, OneDrive or SharePoint"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkError(null);
                }}
                error={linkError}
              />
              <Button type="submit" variant="secondary">
                Add link
              </Button>
            </form>
          </section>
          <Card as="section" aria-labelledby="review-title" style={{ gap: 12 }}>
            <Label>
              <span id="review-title">Teammate review</span>
            </Label>
            {canAct ? (
              <>
                <p className={p.serif}>
                  {task.assignee_id ? `${ownerName} marked this task as done.` : 'This task is marked as done.'} Check the attached work, then confirm it or flag an issue. Your response is recorded in the contribution log.
                </p>
                {flagOpen ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void review('flagged');
                    }}
                    className={p.stack}
                    style={{ gap: 8 }}
                    noValidate
                  >
                    <TextArea
                      label="What is the issue?"
                      rows={3}
                      placeholder="Describe what is missing or incorrect. The task owner and the group can see this."
                      value={flagNote}
                      onChange={(e) => {
                        setFlagNote(e.target.value);
                        setFlagError(null);
                      }}
                      error={flagError}
                      maxLength={1000}
                      data-autofocus
                    />
                    <div className={p.actions}>
                      <Button type="submit">Submit flag</Button>
                      <Button variant="secondary" onClick={() => setFlagOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className={s.reviewButtons}>
                    <Button size="lg" onClick={() => void review('confirmed')}>
                      Confirm work was done
                    </Button>
                    <Button size="lg" variant="secondary" onClick={() => setFlagOpen(true)}>
                      Flag an issue
                    </Button>
                  </div>
                )}
              </>
            ) : null}
            {note ? <p className={[p.small, p.muted].join(' ')} style={{ fontSize: '0.9375rem' }}>{note}</p> : null}
            {reviews.length ? (
              <ul className={s.reviews}>
                {reviews.map((r, i) => (
                  <li key={i} className={s.review}>
                    <span className={s.reviewHead}>
                      <Badge kind={r.kind} small />
                      <strong>{memberName(r.actor_id)}</strong>
                      <span className={p.caption}>{formatDateTime(r.created_at)}</span>
                    </span>
                    {r.note ? <span className={s.reviewNote}>{r.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
        <Card as="aside" aria-label="Task details">
          <dl className={s.fields}>
            <div className={s.field}>
              <dt>Owner</dt>
              <dd>{ownerName}</dd>
            </div>
            <div className={s.field}>
              <dt>Due date</dt>
              <dd>{task.due_at ? formatDate(task.due_at) : 'Not set'}</dd>
            </div>
            <div className={s.field}>
              <dt>Estimated hours</dt>
              <dd>{task.estimated_hours} h</dd>
            </div>
            <div className={s.field}>
              <dt>Status</dt>
              <dd>{STATUS_LABEL[task.status]}</dd>
            </div>
            <div className={s.field}>
              <dt>Deliverable</dt>
              <dd>{task.deliverable || 'None'}</dd>
            </div>
          </dl>
          <div className={s.asideActions}>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit task
            </Button>
            {canDelete ? (
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                Delete task
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
      <TaskFormDialog open={editing} title="Edit task" initial={taskToForm(task)} members={members} submitLabel="Save task" onSubmit={saveEdit} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={deleting}
        label="Delete task"
        title={`Delete "${task.title}"?`}
        body={`The task is removed from the board. Entries about it stay in the contribution log.${task.assignee_id ? ` ${firstName(ownerName)} is no longer assigned to it.` : ''}`}
        confirmLabel="Delete task"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
            setDeleting(false);
            await refresh();
            navigate(`/p/${project.id}/board`);
            toast.show('Task deleted.');
          } catch (err) {
            setDeleting(false);
            fail(err);
          }
        }}
      />
    </div>
  );
}
