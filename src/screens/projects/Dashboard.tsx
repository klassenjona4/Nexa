import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatDate, formatDateTime, formatLongDate, formatTime } from '../../../shared/dates';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { ButtonLink } from '../../components/Button';
import { Badge, Card, ProgressBar } from '../../components/Display';
import { Label } from '../../components/Label';
import { EmptyState, ErrorPanel, LoadingState } from '../../components/States';
import { parseBrief } from '../../lib/project';
import { supabase } from '../../lib/supabase';
import { useBreakpoint } from '../../lib/useBreakpoint';
import s from './Dashboard.module.css';

type Deadline = { item: string; at: string; group: string; projectId: string };

function useDashboard(userId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [projects, tasks, members] = await Promise.all([
        supabase.from('projects').select('id, title, module_code, final_deadline, brief, group_id, created_at, groups(name)').order('created_at'),
        supabase.from('tasks').select('id, project_id, title, status, due_at, estimated_hours, assignee_id'),
        supabase.from('group_members').select('group_id'),
      ]);
      if (projects.error) throw projects.error;
      if (tasks.error) throw tasks.error;
      if (members.error) throw members.error;
      return { projects: projects.data ?? [], tasks: tasks.data ?? [], members: members.data ?? [] };
    },
  });
}

export function Dashboard() {
  const { user } = useAuth();
  const bp = useBreakpoint();
  const q = useDashboard(user?.id);
  const [now] = useState(() => Date.now());

  const header = (
    <PageHeader
      label={formatLongDate(new Date())}
      title="Your projects"
      actions={bp !== 'desktop' ? <ButtonLink to="/projects/new">New group and project</ButtonLink> : undefined}
    />
  );

  if (q.isPending) return <div className={p.content}>{header}<LoadingState text="Loading your projects" /></div>;
  if (q.isError) {
    return (
      <div className={p.content}>
        {header}
        <ErrorPanel title="Your projects could not be loaded" body="Nexa could not reach the server. Your data is not affected. Check your connection and try again." onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const { projects, tasks, members } = q.data;
  if (projects.length === 0) {
    return (
      <div className={p.content}>
        {header}
        <EmptyState
          label="No projects"
          title="You are not in a group yet"
          body="Create a group and project, then upload the assignment brief. If a teammate already created the group, open the invite link they sent you."
          action={{ label: 'Create group and project', to: '/projects/new' }}
        />
      </div>
    );
  }

  const deadlines: Deadline[] = [];
  for (const pr of projects) {
    const group = pr.groups?.name ?? '';
    const brief = parseBrief(pr.brief);
    for (const d of brief?.deadlines ?? []) if (d.due_at) deadlines.push({ item: d.item, at: d.due_at, group, projectId: pr.id });
    if (pr.final_deadline && !(brief?.deadlines ?? []).some((d) => d.due_at === pr.final_deadline)) {
      deadlines.push({ item: 'Final deadline', at: pr.final_deadline, group, projectId: pr.id });
    }
  }
  const upcoming = deadlines.filter((d) => new Date(d.at).getTime() > now).sort((a, b) => a.at.localeCompare(b.at));
  const next = upcoming[0];
  const myOpen = tasks
    .filter((t) => t.assignee_id === user?.id && t.status !== 'done')
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));

  return (
    <div className={p.content}>
      {header}
      <div className={p.grid}>
        <section className={s.deadline} aria-labelledby="next-deadline">
          <Label color="sage">
            <span id="next-deadline">Next deadline</span>
          </Label>
          {next ? (
            <>
              <p className={s.deadlineNumber}>
                {Math.max(0, Math.ceil((new Date(next.at).getTime() - now) / 86_400_000))} days
              </p>
              <p className={s.deadlineText}>
                {next.item} · {next.group}
              </p>
              <p className={s.deadlineDate}>{formatLongDate(next.at)} {formatTime(next.at)}</p>
            </>
          ) : (
            <p className={s.deadlineText}>No upcoming deadlines. Deadlines appear after the brief is reviewed.</p>
          )}
        </section>
        <Card as="section" aria-labelledby="open-tasks">
          <div className={s.cardHead}>
            <Label>
              <span id="open-tasks">Your open tasks</span>
            </Label>
            <span className={[p.small, p.muted].join(' ')}>{myOpen.length} tasks</span>
          </div>
          {myOpen.length === 0 ? <p className={[p.serif, p.muted].join(' ')}>No open tasks are assigned to you.</p> : null}
          <div>
            {myOpen.slice(0, 5).map((t) => (
              <Link key={t.id} to={`/p/${t.project_id}/tasks/${t.id}`} className={s.taskRow}>
                <span className={s.taskText}>
                  <span className={s.taskTitle}>{t.title}</span>
                  <span className={p.caption}>
                    {t.due_at ? `Due ${formatDate(t.due_at)} · ` : ''}
                    {Number(t.estimated_hours)} h
                  </span>
                </span>
                <Badge kind={t.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <section className={p.stack} aria-labelledby="groups-title">
        <h2 id="groups-title" className={p.h2}>
          Groups and projects
        </h2>
        <div className={p.grid}>
          {projects.map((pr) => {
            const own = tasks.filter((t) => t.project_id === pr.id);
            const done = own.filter((t) => t.status === 'done').length;
            const pct = own.length ? Math.round((done / own.length) * 100) : 0;
            const count = members.filter((m) => m.group_id === pr.group_id).length;
            const nextHere = upcoming.find((d) => d.projectId === pr.id);
            return (
              <Link key={pr.id} to={own.length || pr.brief ? `/p/${pr.id}/board` : `/p/${pr.id}/brief`} className={s.projectCard}>
                <span className={p.stack} style={{ gap: 4 }}>
                  <span className={s.projectMeta}>
                    {pr.module_code ? `${pr.module_code} · ` : ''}
                    {count} {count === 1 ? 'member' : 'members'}
                  </span>
                  <span className={s.projectGroup}>{pr.groups?.name}</span>
                  <span className={s.projectTitle}>{pr.title}</span>
                </span>
                <span className={p.stack} style={{ gap: 8 }}>
                  <span className={s.progressRow}>
                    <span>{own.length ? `${done} of ${own.length} tasks done` : 'Brief not uploaded yet'}</span>
                    <span className={p.num}>{pct}%</span>
                  </span>
                  <ProgressBar percent={pct} />
                </span>
                <span className={s.next}>{nextHere ? `Next: ${nextHere.item} · ${formatDateTime(nextHere.at)}` : 'No upcoming deadline'}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
