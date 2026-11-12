import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activityPeriod, formatDateTime } from '../../../shared/dates';
import { statementSections, type StatementSection } from '../../../shared/schemas/statement';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/Display';
import { TextArea } from '../../components/Field';
import { EmptyState, ErrorPanel, LoadingState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { allowanceLeft, useAllowance } from '../../lib/billing';
import { AllowanceNotice } from '../../components/AllowanceNotice';
import { errorMessage } from '../../lib/errors';
import { useProject } from '../../lib/project';
import { saveBlob as download } from '../../lib/download';
import { statementText } from '../../lib/statementText';
import { supabase } from '../../lib/supabase';
import { useTasks } from '../../lib/tasks';
import s from './Statement.module.css';

type Row = { id: string; sections: StatementSection[]; generated_at: string; period_from: string | null; period_to: string | null; edited_at: string | null };

function useStatement(projectId: string) {
  return useQuery({
    queryKey: ['statement', projectId],
    queryFn: async (): Promise<Row | null> => {
      const { data, error } = await supabase.from('statements').select('id, sections, generated_at, period_from, period_to, edited_at').eq('project_id', projectId).order('generated_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const parsed = statementSections.safeParse(data.sections);
      return { ...data, sections: parsed.success ? parsed.data : [] };
    },
  });
}

// Counts log entries recorded after a statement was drafted, so a stale draft is visible.
function useChangesSince(projectId: string, since: string | undefined) {
  return useQuery({
    queryKey: ['statement-changes', projectId, since],
    enabled: !!since,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase.from('activity_log').select('id', { count: 'exact', head: true }).eq('project_id', projectId).gt('created_at', since!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function Statement() {
  const { project, members } = useProject();
  const statement = useStatement(project.id);
  const tasks = useTasks(project.id);
  const usage = useAllowance(project.id, 'statement_generation');
  const qc = useQueryClient();
  const toast = useToast();
  const [drafting, setDrafting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StatementSection[]>([]);
  const changes = useChangesSince(project.id, statement.data?.generated_at);

  const left = allowanceLeft(usage.data) ?? Number.POSITIVE_INFINITY;
  const notice = usage.data ? <AllowanceNotice kind="statement_generation" allowance={usage.data} projectId={project.id} /> : null;

  const generate = async () => {
    setDrafting(true);
    setFailure(null);
    try {
      await api(`/api/projects/${project.id}/statements/generate`, { method: 'POST' });
      await qc.invalidateQueries({ queryKey: ['statement', project.id] });
      await qc.invalidateQueries({ queryKey: ['statement-changes', project.id] });
      setEditing(false);
      toast.show('Statement drafted from the contribution log. Check it before you export it.');
    } catch (err) {
      setFailure(codeOf(err));
    } finally {
      setDrafting(false);
      await qc.invalidateQueries({ queryKey: ['usage', project.id, 'statement_generation'] });
    }
  };

  const header = (row?: Row | null) => (
    <PageHeader
      title="Contribution statement"
      intro={row ? `Drafted by AI from the contribution log on ${formatDateTime(row.generated_at)}${row.edited_at ? `, last edited ${formatDateTime(row.edited_at)}` : ''}. Check every statement against the log before you export it.` : undefined}
      actions={row ? <Actions row={row} /> : undefined}
    />
  );

  function Actions({ row }: { row: Row }) {
    const input = {
      label: [project.module_code, project.title].filter(Boolean).join(' · '),
      title: `Contribution statement, ${project.group_name}`,
      period: `${activityPeriod(row.period_from, row.period_to ?? row.generated_at)} · ${members.length} ${members.length === 1 ? 'member' : 'members'}`,
      sections: editing ? draft : row.sections,
      members: members.map((m) => m.full_name),
    };
    return (
      <>
        <Button
          variant="secondary"
          aria-pressed={editing}
          onClick={async () => {
            if (!editing) {
              setDraft(row.sections);
              setEditing(true);
              return;
            }
            try {
              await api(`/api/statements/${row.id}`, { method: 'PATCH', body: { sections: draft.map((x) => ({ heading: x.heading, body: x.body.trim() })) } });
              await qc.invalidateQueries({ queryKey: ['statement', project.id] });
              setEditing(false);
              toast.show('Statement saved.');
            } catch (err) {
              toast.show(`Error: ${errorMessage(codeOf(err))}`);
            }
          }}
        >
          {editing ? 'Done editing' : 'Edit text'}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(statementText(input));
              toast.show('Statement copied as plain text.');
            } catch {
              download(new Blob([statementText(input)], { type: 'text/plain;charset=utf-8' }), `${input.title}.txt`);
              toast.show(`Plain text exported: ${input.title}.txt`);
            }
          }}
        >
          Copy text
        </Button>
        <Button
          onClick={async () => {
            const { statementPdf } = await import('../../lib/statementPdf');
            download(await statementPdf(input), `${input.title}.pdf`);
            toast.show(`PDF exported: ${input.title}.pdf`);
          }}
        >
          Export PDF
        </Button>
      </>
    );
  }

  if (statement.isPending || tasks.isPending || usage.isPending) return <div className={p.content}>{header()}<LoadingState text="Loading the contribution statement" /></div>;
  if (drafting) return <div className={p.content}>{header()}<LoadingState text="Drafting the statement from the contribution log" /></div>;
  if (statement.isError) {
    return (
      <div className={p.content}>
        {header()}
        <ErrorPanel title="The statement could not be loaded" body="Nexa could not reach the server. Try again." onRetry={() => void statement.refetch()} />
      </div>
    );
  }
  const anyDone = (tasks.data ?? []).some((t) => t.status === 'done');
  const failurePanel = failure ? (
    <ErrorPanel
      title="The statement could not be drafted"
      body={
        failure === 'usage_limit_reached'
          ? 'This project has used all of its statement generations. Edit the current statement instead.'
          : failure === 'nothing_to_draft'
            ? 'A statement needs at least one completed task in the contribution log.'
            : `The AI service did not respond. The contribution log is unchanged. Try again in a few minutes. This attempt does not count against the limit.`
      }
    />
  ) : null;

  const row = statement.data;
  if (!row) {
    return (
      <div className={p.content}>
        {header()}
        {failurePanel}
        {anyDone ? (
          <>
            {notice}
            <EmptyState
              label="No statement"
              title="Draft the contribution statement"
              body="Nexa drafts a factual statement for each member from the contribution log. Member names and the log are sent to the AI model; email addresses are not. You can edit every section before you export it."
              action={left > 0 ? { label: 'Draft statement', onClick: () => void generate() } : undefined}
            />
          </>
        ) : (
          <EmptyState label="No statement" title="Nothing to draft yet" body="A statement needs at least one completed task in the contribution log." action={{ label: 'Open the task board', to: `/p/${project.id}/board` }} />
        )}
      </div>
    );
  }

  const sections = editing ? draft : row.sections;
  return (
    <div className={p.content} style={{ gap: 24 }}>
      {header(row)}
      {failurePanel}
      {changes.data ? (
        <InlineNotice role="status">
          {changes.data === 1 ? '1 change has' : `${changes.data} changes have`} been recorded in the contribution log since this draft on {formatDateTime(row.generated_at)}. The statement does not include {changes.data === 1 ? 'it' : 'them'}. Draft it again from the log, or edit the text by hand.
        </InlineNotice>
      ) : null}
      <div className={s.desk}>
        <article className={s.doc} aria-label="Contribution statement">
          <header className={s.docHead}>
            <span className={s.docLabel}>{[project.module_code, project.title].filter(Boolean).join(' · ')}</span>
            <h2 className={s.docTitle}>Contribution statement, {project.group_name}</h2>
            <span className={[p.small, p.muted].join(' ')}>
              {activityPeriod(row.period_from, row.period_to ?? row.generated_at)} · {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </header>
          {sections.map((x, i) => (
            <div key={i} className={s.section}>
              <h3 className={p.h3}>{x.heading}</h3>
              {editing ? (
                <TextArea hideLabel label={x.heading} rows={5} value={x.body} maxLength={3000} onChange={(e) => setDraft((d) => d.map((y, j) => (j === i ? { ...y, body: e.target.value } : y)))} />
              ) : (
                <p className={s.body}>{x.body}</p>
              )}
            </div>
          ))}
          <footer className={s.signatures}>
            {members.map((m) => (
              <div key={m.user_id} className={s.signature}>
                <span className={s.line} />
                <span style={{ fontWeight: 600 }}>{m.full_name}</span>
                <span className={p.muted}>Signature and date</span>
              </div>
            ))}
          </footer>
        </article>
      </div>
      {notice}
      {left > 0 ? (
        <Button variant="secondary" style={{ alignSelf: 'flex-start' }} onClick={() => void generate()} disabled={!anyDone}>
          Draft again from the log
        </Button>
      ) : null}
    </div>
  );
}
