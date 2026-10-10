import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate, formatDateTime } from '../../../shared/dates';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button, ButtonLink } from '../../components/Button';
import { FilterChips, Tabs } from '../../components/Controls';
import { Avatar, Badge } from '../../components/Display';
import { EmptyState, ErrorPanel, LoadingState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { firstName, useProject } from '../../lib/project';
import { reviewsFor, type Task, taskKeys, useLog, useTasks } from '../../lib/tasks';
import { useBreakpoint } from '../../lib/useBreakpoint';
import s from './Board.module.css';
import { TaskFormDialog, type TaskFormValues, taskToForm } from './TaskForm';

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
] as const;
type Status = (typeof COLUMNS)[number]['key'];

export function Board() {
  const { project, members, memberName } = useProject();
  const { user } = useAuth();
  const bp = useBreakpoint();
  const tasks = useTasks(project.id);
  const log = useLog(project.id);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState<Status>('todo');
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const label = [project.module_code, project.final_deadline ? `Due ${formatDateTime(project.final_deadline)}` : ''].filter(Boolean).join(' · ');
  const header = (
    <PageHeader
      label={label || undefined}
      title="Task board"
      actions={
        <>
          <ButtonLink to={`/p/${project.id}/calendar`} variant="secondary">
            Calendar feed
          </ButtonLink>
          <Button onClick={() => setCreating(true)}>New task</Button>
        </>
      }
    />
  );

  const createTask = async (v: TaskFormValues) => {
    try {
      const res = await api<{ id: string }>(`/api/projects/${project.id}/tasks`, { body: v });
      await qc.invalidateQueries({ queryKey: taskKeys.list(project.id) });
      setCreating(false);
      toast.show('Task created and recorded in the contribution log.');
      navigate(`/p/${project.id}/tasks/${res.id}`);
    } catch (err) {
      toast.show(`Error: ${errorMessage(codeOf(err))}`);
    }
  };

  const dialog = (
    <TaskFormDialog open={creating} title="New task" initial={taskToForm(undefined, user?.id)} members={members} submitLabel="Create task" onSubmit={createTask} onClose={() => setCreating(false)} />
  );

  if (tasks.isPending) return <div className={p.content}>{header}<LoadingState text="Loading the task board" /></div>;
  if (tasks.isError) {
    return (
      <div className={p.content}>
        {header}
        <ErrorPanel title="The task board could not be loaded" body="Nexa could not reach the server. Changes you made before the error are saved. Try again." onRetry={() => void tasks.refetch()} />
      </div>
    );
  }
  if (tasks.data.length === 0) {
    return (
      <div className={p.content}>
        {header}
        <EmptyState
          label="No tasks"
          title="The board is empty"
          body="Tasks appear here after the brief is reviewed and the proposed tasks are created. You can also add tasks by hand with New task."
          action={{ label: 'Upload the brief', to: `/p/${project.id}/brief` }}
        />
        {dialog}
      </div>
    );
  }

  const filters = [
    { value: 'all', label: 'All members' },
    ...members.map((m) => ({ value: m.user_id, label: m.user_id === user?.id ? 'My tasks' : firstName(m.full_name) })),
  ];
  const visible = tasks.data.filter((t) => filter === 'all' || t.assignee_id === filter);
  const byStatus = (k: Status) => visible.filter((t) => t.status === k);

  const meta = (t: Task) => {
    if (t.status !== 'done') return '';
    const r = reviewsFor(log.data ?? [], t);
    return `${r.filter((x) => x.kind === 'confirmed').length} confirmed · ${r.filter((x) => x.kind === 'flagged').length} flagged`;
  };

  const card = (t: Task, ruled: boolean) => {
    const owner = t.assignee_id ? memberName(t.assignee_id) : 'Unassigned';
    const info = (
      <>
        {t.due_at ? <span>Due {formatDate(t.due_at)}</span> : null}
        <span>{t.estimated_hours} h</span>
        {meta(t) ? <span>{meta(t)}</span> : null}
      </>
    );
    return (
      <Link key={t.id} to={`/p/${project.id}/tasks/${t.id}`} className={[s.card, ruled ? s.cardRuled : ''].join(' ')}>
        {ruled ? (
          <>
            <span className={s.cardTop}>
              <span className={[s.cardTitle, s.cardTitleLg].join(' ')}>{t.title}</span>
              <Badge kind={t.status} />
            </span>
            <span className={s.metaInline}>
              <span className={s.owner}>
                <Avatar name={owner} size={28} />
                {owner}
              </span>
              {info}
            </span>
          </>
        ) : (
          <>
            <span className={s.cardTitle}>{t.title}</span>
            <span className={s.owner}>
              <Avatar name={owner} size={28} />
              {owner}
            </span>
            <span className={s.meta}>{info}</span>
          </>
        )}
      </Link>
    );
  };

  return (
    <div className={p.content} style={{ gap: 24 }}>
      {header}
      <div className={s.filters}>
        <FilterChips label="Filter by member" options={filters} value={filter} onChange={setFilter} />
      </div>
      {bp === 'mobile' ? (
        <>
          <Tabs idPrefix="board" label="Status" options={COLUMNS.map((c) => ({ value: c.key, label: `${c.label} (${byStatus(c.key).length})` }))} value={tab} onChange={setTab} />
          <div role="tabpanel" id="board-panel" aria-labelledby={`board-tab-${tab}`} className={s.panel}>
            {byStatus(tab).length === 0 ? <p className={s.tabEmpty}>No tasks with this status for the selected member.</p> : byStatus(tab).map((t) => card(t, true))}
          </div>
        </>
      ) : (
        <div className={s.columns}>
          {COLUMNS.map((c) => (
            <section key={c.key} aria-labelledby={`col-${c.key}`} className={s.column}>
              <h2 id={`col-${c.key}`} className={s.columnHead}>
                <span>{c.label}</span>
                <span className={s.count}>{byStatus(c.key).length}</span>
              </h2>
              {byStatus(c.key).length === 0 ? <p className={s.none}>No tasks.</p> : byStatus(c.key).map((t) => card(t, false))}
            </section>
          ))}
        </div>
      )}
      {dialog}
    </div>
  );
}
