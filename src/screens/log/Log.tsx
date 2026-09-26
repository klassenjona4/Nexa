import { useState } from 'react';
import { formatDate, formatTime } from '../../../shared/dates';
import { describeEntry } from '../../../shared/logText';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { BarChart } from '../../components/BarChart';
import { ButtonLink } from '../../components/Button';
import { Avatar, Card } from '../../components/Display';
import { EmptyState, ErrorPanel, LoadingState } from '../../components/States';
import { firstName, useProject } from '../../lib/project';
import { reviewsFor, useLog, useTasks } from '../../lib/tasks';
import s from './Log.module.css';

export function Log() {
  const { project, members, memberName } = useProject();
  const log = useLog(project.id);
  const tasks = useTasks(project.id);
  const [filter, setFilter] = useState('all');

  const header = (
    <PageHeader
      title="Contribution log"
      intro="Entries are added automatically and cannot be edited or deleted by any member."
      actions={<ButtonLink to={`/p/${project.id}/statement`}>Draft contribution statement</ButtonLink>}
    />
  );
  if (log.isPending || tasks.isPending) return <div className={p.content}>{header}<LoadingState text="Loading the contribution log" /></div>;
  if (log.isError || tasks.isError) {
    return (
      <div className={p.content}>
        {header}
        <ErrorPanel title="The contribution log could not be loaded" body="Nexa could not reach the server. No entries are lost. Try again." onRetry={() => void log.refetch()} />
      </div>
    );
  }
  const entries = log.data;
  const interesting = entries.filter((e) => e.event !== 'group_joined' || entries.length > members.length);
  if (interesting.length === 0) {
    return (
      <div className={p.content}>
        {header}
        <EmptyState
          label="No activity"
          title="Nothing recorded yet"
          body="The log records completed tasks, file links, confirmations and flags as they happen. Entries appear after the first task is updated."
          action={{ label: 'Open the task board', to: `/p/${project.id}/board` }}
        />
      </div>
    );
  }

  const allTasks = tasks.data;
  const summary = members.map((m) => {
    const own = allTasks.filter((t) => t.assignee_id === m.user_id);
    const reviews = own.flatMap((t) => reviewsFor(entries, t));
    return {
      id: m.user_id,
      name: m.full_name,
      done: own.filter((t) => t.status === 'done').length,
      total: own.length,
      hours: own.reduce((a, t) => a + t.estimated_hours, 0),
      doneHours: own.filter((t) => t.status === 'done').reduce((a, t) => a + t.estimated_hours, 0),
      conf: reviews.filter((r) => r.kind === 'confirmed').length,
      flags: reviews.filter((r) => r.kind === 'flagged').length,
    };
  });
  const chart = summary.map((x) => ({ label: firstName(x.name), value: x.doneHours }));
  const hi = chart.reduce((best, d, i, a) => (d.value > (a[best]?.value ?? 0) ? i : best), 0);
  const leader = summary[hi];
  const anyDone = chart.some((d) => d.value > 0);
  const maxAssigned = Math.max(...summary.map((x) => x.hours), 1);

  const shown = entries.filter((e) => filter === 'all' || e.actor_id === filter);
  const days: { date: string; items: typeof shown }[] = [];
  for (const e of shown) {
    const d = formatDate(e.created_at);
    const last = days[days.length - 1];
    if (last && last.date === d) last.items.push(e);
    else days.push({ date: d, items: [e] });
  }

  return (
    <div className={p.content}>
      {header}
      <section className={p.stack} aria-labelledby="summary-title">
        <h2 id="summary-title" className={p.h2}>
          Summary per member
        </h2>
        <div className={s.summary}>
          {summary.map((x) => (
            <Card key={x.id} compact>
              <div className={s.memberHead}>
                <Avatar name={x.name} />
                {x.name}
              </div>
              <dl className={s.stats}>
                <dt>Tasks completed</dt>
                <dd>
                  {x.done} of {x.total}
                </dd>
                <dt>Hours estimated</dt>
                <dd>{x.hours} h</dd>
                <dt>Confirmations received</dt>
                <dd>{x.conf}</dd>
                <dt>Flags received</dt>
                <dd>{x.flags}</dd>
              </dl>
            </Card>
          ))}
        </div>
        <figure className={s.figure}>
          <figcaption className={p.stack} style={{ gap: 4 }}>
            <span className={s.figNumber}>Figure 1.</span>
            <span className={s.figTitle}>{anyDone && leader ? `${leader.name} has completed the most estimated hours so far` : 'No tasks are completed yet'}</span>
          </figcaption>
          <BarChart data={chart} highlight={anyDone ? hi : undefined} max={maxAssigned} unit=" h" categoryLabel="Member" valueLabel="Estimated hours of completed tasks" />
          <p className={p.caption}>Source: Nexa contribution log, {formatDate(new Date())}.</p>
        </figure>
      </section>
      <section className={p.stack} aria-labelledby="timeline-title">
        <div className={s.timelineHead}>
          <h2 id="timeline-title" className={p.h2}>
            Timeline
          </h2>
          <label className={s.filter}>
            Member
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All members</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {days.map((d) => (
          <div key={d.date} className={s.day}>
            <h3 className={s.dayHead}>{d.date}</h3>
            <ol className={s.entries}>
              {d.items.map((e) => {
                const text = describeEntry(e, (id) => memberName(id));
                return (
                  <li key={e.id} className={s.entry}>
                    <span className={s.time}>{formatTime(e.created_at)}</span>
                    <span className={s.entryText}>
                      <span>
                        <strong style={{ fontWeight: 600 }}>{e.actor_id ? memberName(e.actor_id) : 'Former member'}</strong> {text.text}
                      </span>
                      {text.note ? <span className={s.note}>{text.note}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}
