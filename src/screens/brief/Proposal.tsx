import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDate } from '../../../shared/dates';
import type { AnalysisResult } from '../../../shared/schemas/brief';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { Card, ProgressBar } from '../../components/Display';
import { SelectField, TextField } from '../../components/Field';
import { Label } from '../../components/Label';
import { EmptyState, ErrorPanel, LoadingState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { type Analysis, useLatestAnalyses } from '../../lib/brief';
import { errorMessage } from '../../lib/errors';
import { type Member, useProject } from '../../lib/project';
import s from './Proposal.module.css';

type Draft = { key: number; title: string; description: string; deliverable: string; estimated_hours: number; due_at: string | null; assignee_id: string | null };

// Even split: longest tasks first, each to the member with the fewest hours so far.
export function rebalance(tasks: Draft[], members: Member[]): Draft[] {
  if (members.length === 0) return tasks;
  const totals = new Map(members.map((m) => [m.user_id, 0]));
  const order = [...tasks].sort((a, b) => b.estimated_hours - a.estimated_hours);
  const owner = new Map<number, string>();
  for (const t of order) {
    const [id] = [...totals.entries()].sort((a, b) => a[1] - b[1] || members.findIndex((m) => m.user_id === a[0]) - members.findIndex((m) => m.user_id === b[0]))[0]!;
    owner.set(t.key, id);
    totals.set(id, (totals.get(id) ?? 0) + t.estimated_hours);
  }
  return tasks.map((t) => ({ ...t, assignee_id: owner.get(t.key) ?? null }));
}

export function Proposal() {
  const { project } = useProject();
  const analyses = useLatestAnalyses(project.id);

  if (analyses.isPending) return <div className={p.content}><LoadingState text="Proposing tasks from the brief" /></div>;
  if (analyses.isError) {
    return (
      <div className={p.content}>
        <ErrorPanel title="Tasks could not be proposed" body="Nexa could not reach the server. Try again, or add tasks by hand on the task board." onRetry={() => void analyses.refetch()} />
      </div>
    );
  }
  const pending = analyses.data.find((a) => a.status === 'ready' && !a.accepted_at && a.result);
  if (!pending?.result || pending.result.tasks.length === 0) {
    return (
      <div className={p.content}>
        <PageHeader label="Step 3 of 3 · Tasks" title="Proposed tasks and split" />
        <EmptyState
          label="No tasks proposed"
          title={pending ? 'The brief has no deliverables' : 'No brief is waiting for review'}
          body={pending ? 'Tasks are proposed from the deliverables in the brief. Review the brief and add at least one deliverable.' : 'Upload the assignment brief first. Nexa proposes tasks after you check the extracted details.'}
          action={{ label: 'Review the brief', to: `/p/${project.id}/brief` }}
        />
      </div>
    );
  }
  return <ProposalEditor analysis={pending} result={pending.result} />;
}

function ProposalEditor({ analysis, result }: { analysis: Analysis; result: AnalysisResult }) {
  const { project, members } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<Draft[]>(() =>
    result.tasks.map((t, i) => ({
      key: i,
      title: t.title,
      description: t.description,
      deliverable: t.deliverable,
      estimated_hours: t.estimated_hours,
      due_at: t.due_at,
      // The model suggests member numbers; they map to members in joining order.
      assignee_id: t.member_index ? (members[(t.member_index - 1) % members.length]?.user_id ?? null) : null,
    })),
  );
  const [nextKey, setNextKey] = useState(result.tasks.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<Draft>) => setTasks((x) => x.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const total = tasks.reduce((a, t) => a + t.estimated_hours, 0);
  const split = members.map((m) => {
    const hours = tasks.filter((t) => t.assignee_id === m.user_id).reduce((a, t) => a + t.estimated_hours, 0);
    return { id: m.user_id, name: m.full_name, hours, pct: total ? Math.round((hours / total) * 100) : 0 };
  });
  const unassigned = tasks.filter((t) => !t.assignee_id).reduce((a, t) => a + t.estimated_hours, 0);
  const hs = split.map((x) => x.hours);
  const diff = hs.length ? Math.max(...hs) - Math.min(...hs) : 0;
  const note = `Total ${total} h across ${tasks.length} tasks. Difference between the highest and lowest share: ${diff} h.${diff === 0 && !unassigned ? ' The split is even.' : ''}${unassigned ? ` ${unassigned} h are unassigned.` : ''}`;

  const create = async () => {
    setError(null);
    if (tasks.some((t) => !t.title.trim())) return setError('Every task needs a title.');
    if (tasks.some((t) => !(t.estimated_hours >= 0 && t.estimated_hours <= 200) || Math.round(t.estimated_hours * 2) !== t.estimated_hours * 2)) {
      return setError('Hours must be between 0 and 200 in steps of 0.5.');
    }
    setBusy(true);
    try {
      await api(`/api/projects/${project.id}/briefs/${analysis.id}/accept`, {
        body: { tasks: tasks.map(({ key: _key, ...t }) => ({ ...t, title: t.title.trim() })) },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['analyses', project.id] }),
        qc.invalidateQueries({ queryKey: ['project', project.id] }),
        qc.invalidateQueries({ queryKey: ['tasks', project.id] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      toast.show(`${tasks.length} tasks created and added to the board.`);
      navigate(`/p/${project.id}/board`);
    } catch (err) {
      setError(errorMessage(codeOf(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={p.content}>
      <PageHeader
        label="Step 3 of 3 · Tasks"
        title="Proposed tasks and split"
        intro={`The AI proposed ${result.tasks.length} tasks from ${result.brief.deliverables.length} deliverables and ${result.brief.criteria.length} marking criteria. Estimated hours follow the word counts in the brief. Change titles, owners or hours before you create the tasks.`}
      />
      <div className={s.layout}>
        <ol className={s.list}>
          {tasks.map((t, i) => (
            <li key={t.key} className={s.item}>
              <TextField className={s.title} compact label={`Task ${i + 1}`} value={t.title} maxLength={200} onChange={(e) => update(t.key, { title: e.target.value })} hint={t.due_at ? `Due ${formatDate(t.due_at)}` : undefined} />
              <SelectField className={s.owner} compact label="Owner" value={t.assignee_id ?? ''} onChange={(e) => update(t.key, { assignee_id: e.target.value || null })}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name}
                  </option>
                ))}
              </SelectField>
              <TextField className={s.hours} compact label="Hours" type="number" min={0} max={200} step={0.5} numeric value={String(t.estimated_hours)} onChange={(e) => update(t.key, { estimated_hours: Math.max(0, Number(e.target.value) || 0) })} />
              <Button variant="text" className={s.remove} aria-label={`Remove task ${i + 1}`} onClick={() => setTasks((x) => x.filter((y) => y.key !== t.key))}>
                Remove
              </Button>
            </li>
          ))}
          <li>
            <Button
              variant="secondary"
              disabled={tasks.length >= 40}
              onClick={() => {
                setTasks((x) => [...x, { key: nextKey, title: 'New task', description: '', deliverable: '', estimated_hours: 1, due_at: null, assignee_id: null }]);
                setNextKey((k) => k + 1);
              }}
            >
              Add task
            </Button>
          </li>
        </ol>
        <Card as="aside" className={s.aside} aria-label="Split by estimated hours">
          <Label>Split by estimated hours</Label>
          {split.map((m) => (
            <div key={m.id} className={s.split}>
              <div className={s.splitRow}>
                <span>{m.name}</span>
                <span className={s.splitValue}>
                  {m.hours} h · {m.pct}%
                </span>
              </div>
              <ProgressBar percent={m.pct} tone="slate" />
            </div>
          ))}
          <p className={s.note}>{note}</p>
          {members.length === 1 ? <p className={[p.small, p.muted].join(' ')}>Invite members first for a split between people. You can reassign tasks on the board later.</p> : null}
          {error ? <p className={p.small} style={{ color: 'var(--rust)', fontWeight: 600 }}>Error: {error}</p> : null}
          <Button size="lg" onClick={() => void create()} disabled={busy || tasks.length === 0}>
            Create {tasks.length} tasks
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setTasks((x) => rebalance(x, members));
              toast.show('Split updated. Estimated hours are shared as evenly as the tasks allow.');
            }}
          >
            Suggest a new split
          </Button>
        </Card>
      </div>
    </div>
  );
}
