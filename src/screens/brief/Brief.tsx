import { useQueryClient } from '@tanstack/react-query';
import { type DragEvent, type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDate, formatDateTime, formatTime, parseIrishDateTime } from '../../../shared/dates';
import type { AnalysisResult } from '../../../shared/schemas/brief';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { Card, InlineNotice } from '../../components/Display';
import { TextArea, TextField } from '../../components/Field';
import { Label } from '../../components/Label';
import { ErrorPanel, LoadingState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import { type Analysis, formatSize, looksLikePdf, useLatestAnalyses, useUsage } from '../../lib/brief';
import { errorMessage } from '../../lib/errors';
import { useProject } from '../../lib/project';
import { supabase } from '../../lib/supabase';
import s from './Brief.module.css';

const MAX_BYTES = 10 * 1024 * 1024;
type Failure = { code: string; size?: number };

function failureCopy(f: Failure): { title: string; body: string } {
  switch (f.code) {
    case 'file_too_large':
      return { title: 'The brief could not be read', body: `The file is ${formatSize(f.size)}. Upload a PDF of 10 MB or less, or paste the text of the brief instead.` };
    case 'not_a_pdf':
      return { title: 'The brief could not be read', body: 'The file is not a PDF. Upload a PDF, or paste the text of the brief instead.' };
    case 'brief_unreadable':
      return { title: 'The brief could not be read', body: 'The PDF could not be read. It may be too long (more than 100 pages), protected or scanned. Paste the text of the brief instead.' };
    case 'ai_timeout':
      return { title: 'The brief could not be read', body: 'The AI service did not respond within 60 seconds. Try again, or add tasks by hand on the task board. This attempt does not count against the limit.' };
    case 'ai_refused':
    case 'ai_invalid_output':
      return { title: 'The brief could not be read', body: 'The AI service could not extract the brief. Check that the document is an assignment brief, or paste the text instead. This attempt does not count against the limit.' };
    case 'usage_limit_reached':
      return { title: 'No brief breakdowns left', body: 'This project has used all of its brief breakdowns. Add or edit tasks by hand on the task board.' };
    default:
      return { title: 'The brief could not be read', body: `${errorMessage(f.code)} This attempt does not count against the limit.` };
  }
}

export function Brief() {
  const { project } = useProject();
  const analyses = useLatestAnalyses(project.id);
  const usage = useUsage(project.id, project.plan, 'brief_breakdown');
  const [busy, setBusy] = useState<{ name: string; size: number | null } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const qc = useQueryClient();
  const toast = useToast();

  if (analyses.isPending || usage.isPending) return <div className={p.content}><LoadingState text="Loading the brief" /></div>;
  if (analyses.isError) {
    return (
      <div className={p.content}>
        <ErrorPanel title="The brief could not be loaded" body="Nexa could not reach the server. Check your connection and try again." onRetry={() => void analyses.refetch()} />
      </div>
    );
  }

  const latest = analyses.data[0];
  const pending = latest && latest.status === 'ready' && !latest.accepted_at && latest.result ? latest : null;
  const inFlight = latest && latest.status === 'processing' && openedAt - new Date(latest.created_at).getTime() < 120_000 ? latest : null;
  const left = usage.data ? usage.data.max - usage.data.used : 0;

  const run = async (input: { file?: File; text?: string }) => {
    setFailure(null);
    const name = input.file?.name ?? 'Pasted brief text';
    setBusy({ name, size: input.file?.size ?? null });
    try {
      if (input.file) {
        const up = await api<{ path: string; token: string }>(`/api/projects/${project.id}/briefs/upload-url`, { body: { file_name: input.file.name.slice(0, 200), file_size: input.file.size } });
        const { error } = await supabase.storage.from('briefs').uploadToSignedUrl(up.path, up.token, input.file, { contentType: 'application/pdf' });
        if (error) throw Object.assign(new Error('upload'), { code: 'upload_failed' });
        await api(`/api/projects/${project.id}/briefs/analyse`, { body: { storage_path: up.path, file_name: input.file.name.slice(0, 200) } });
      } else {
        await api(`/api/projects/${project.id}/briefs/analyse`, { body: { text: input.text } });
      }
      await qc.invalidateQueries({ queryKey: ['analyses', project.id] });
      setReplacing(false);
      toast.show('Brief read. Check the extracted details below.');
    } catch (err) {
      const code = (err as { code?: string }).code === 'upload_failed' ? 'upload_failed' : codeOf(err);
      setFailure({ code, size: input.file?.size });
    } finally {
      setBusy(null);
      await qc.invalidateQueries({ queryKey: ['usage', project.id, 'brief_breakdown'] });
      await qc.invalidateQueries({ queryKey: ['analyses', project.id] });
    }
  };

  if (busy || inFlight) {
    return <Processing name={busy?.name ?? inFlight?.file_name ?? 'Pasted brief text'} size={busy?.size ?? inFlight?.file_size ?? null} />;
  }
  if (pending && pending.result && !replacing) {
    return <Review analysis={pending} result={pending.result} onReplace={() => setReplacing(true)} />;
  }
  if (project.brief && !replacing && !failure) {
    return <CurrentBrief analyses={analyses.data} onReplace={() => setReplacing(true)} left={left} />;
  }
  return <Upload left={left} max={usage.data?.max ?? 0} failure={failure} onFile={(f) => void run({ file: f })} onText={(t) => void run({ text: t })} onCancel={project.brief || pending ? () => setReplacing(false) : undefined} />;
}

function UsageNotice({ left, max }: { left: number; max: number }) {
  const used = max - left;
  return (
    <InlineNotice role="note">
      Brief breakdowns used: {used} of {max}.{' '}
      {left > 0 ? 'A failed attempt does not count.' : 'No breakdowns are left for this project. You can still add and edit tasks by hand.'}
    </InlineNotice>
  );
}

function Upload({ left, max, failure, onFile, onText, onCancel }: { left: number; max: number; failure: Failure | null; onFile: (f: File) => void; onText: (t: string) => void; onCancel?: () => void }) {
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const disabled = left <= 0;

  const accept = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError(`The file is ${formatSize(file.size)}. Upload a PDF of 10 MB or less, or paste the text instead.`);
    if (!(await looksLikePdf(file))) return setError('The file is not a PDF. Upload a PDF, or paste the text instead.');
    onFile(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (!disabled) void accept(e.dataTransfer.files[0]);
  };
  const submitText = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t.length < 200) return setTextError('Paste the full text of the brief, at least 200 characters.');
    if (t.length > 60000) return setTextError('The text is longer than 60,000 characters. Upload the PDF instead.');
    onText(t);
  };

  return (
    <div className={p.content}>
      <PageHeader label="Step 2 of 3 · Brief" title="Upload the assignment brief" intro="Nexa extracts the deliverables, deadlines, word counts and marking criteria. You can correct everything before tasks are created." />
      {failure ? <ErrorPanel {...failureCopy(failure)} /> : null}
      <UsageNotice left={left} max={max} />
      <div className={s.uploadGrid}>
        <div
          className={[s.drop, drag ? s.dropActive : ''].join(' ')}
          onDragOver={(e) => {
            e.preventDefault();
            if (!drag) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <Label>Upload a file</Label>
          <p className={s.dropTitle}>{drag ? 'Release to upload' : 'Drop the brief here'}</p>
          <p className={[p.muted].join(' ')} style={{ fontSize: '0.9375rem' }}>
            PDF only, maximum 10 MB.
          </p>
          <label className={s.fileButton} aria-disabled={disabled}>
            Choose file
            <input className={s.fileInput} type="file" accept="application/pdf,.pdf" disabled={disabled} onChange={(e) => void accept(e.target.files?.[0])} />
          </label>
          {error ? <p className={p.small} style={{ color: 'var(--rust)', fontWeight: 600 }}>Error: {error}</p> : null}
        </div>
        <form className={s.paste} onSubmit={submitText} noValidate>
          <TextArea label="Or paste the brief text" rows={8} placeholder="Paste the full text of the assignment brief" value={text} onChange={(e) => { setText(e.target.value); setTextError(null); }} error={textError} disabled={disabled} />
          <Button type="submit" className={s.start} disabled={disabled}>
            Read brief
          </Button>
        </form>
      </div>
      <p className={[p.small, p.muted].join(' ')} style={{ maxWidth: 720 }}>
        The brief is visible to all group members. It is sent to an AI model (Anthropic Claude) to extract details and is not used to train models. See the <a href="/privacy">privacy policy</a>.
      </p>
      {onCancel ? (
        <Button variant="text" className={s.start} onClick={onCancel}>
          Back to the current brief
        </Button>
      ) : null}
    </div>
  );
}

function Processing({ name, size }: { name: string; size: number | null }) {
  const steps = [
    ['Uploading file', 'Done'],
    ['Reading the brief', 'In progress'],
    ['Finding deliverables, deadlines and criteria', 'Waiting'],
    ['Proposing tasks and a split', 'Waiting'],
  ];
  return (
    <div className={p.content}>
      <PageHeader label="Step 2 of 3 · Brief" title="Reading the brief" intro="Nexa is extracting deliverables, deadlines, word counts and marking criteria." />
      <Card className={s.processing} role="status" aria-live="polite">
        <div className={s.fileRow}>
          <span style={{ fontWeight: 600 }}>{name}</span>
          <span className={p.muted}>{formatSize(size)}</span>
        </div>
        <span aria-hidden="true" style={{ display: 'block', height: 8, background: 'var(--mist)' }}>
          <span style={{ display: 'block', height: 8, width: '50%', background: 'var(--ink)' }} />
        </span>
        <p className={[p.small, p.muted].join(' ')}>Step 2 of 4. This usually takes under 30 seconds. You can leave this page; the result is saved.</p>
        <ol className={s.steps}>
          {steps.map(([label, status]) => (
            <li key={label} className={s.step}>
              <span style={{ fontWeight: status === 'In progress' ? 600 : 400 }}>{label}</span>
              <span className={s.stepStatus}>{status}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

type EditDeadline = { item: string; date: string; time: string };

function Review({ analysis, result, onReplace }: { analysis: Analysis; result: AnalysisResult; onReplace: () => void }) {
  const { project } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [deliverables, setDeliverables] = useState(result.brief.deliverables);
  const [deadlines, setDeadlines] = useState<EditDeadline[]>(result.brief.deadlines.map((d) => ({ item: d.item, date: d.due_at ? formatDate(d.due_at) : '', time: d.due_at ? formatTime(d.due_at) : '' })));
  const [criteria, setCriteria] = useState(result.brief.criteria);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const total = criteria.reduce((a, c) => a + (c.weight ?? 0), 0);

  const save = async () => {
    const next: Record<string, string> = {};
    deliverables.forEach((d, i) => { if (!d.name.trim()) next[`d${i}`] = 'Enter the deliverable or remove it.'; });
    deadlines.forEach((d, i) => {
      if (!d.item.trim()) next[`dl${i}`] = 'Enter what is due or remove the row.';
      if (d.date.trim() && !parseIrishDateTime(d.date, d.time || '17:00')) next[`dd${i}`] = 'Enter a real date as DD/MM/YYYY.';
      if (d.time.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time.trim())) next[`dt${i}`] = 'Use HH:MM, 24 hour.';
    });
    criteria.forEach((c, i) => { if (!c.name.trim()) next[`c${i}`] = 'Enter the criterion or remove it.'; });
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api(`/api/projects/${project.id}/briefs/${analysis.id}/review`, {
        method: 'PUT',
        body: {
          deliverables: deliverables.map((d) => ({ name: d.name.trim(), detail: d.detail.trim() })),
          deadlines: deadlines.map((d) => ({ item: d.item.trim(), date: d.date.trim(), time: d.date.trim() ? d.time.trim() : '' })),
          criteria: criteria.map((c) => ({ name: c.name.trim(), weight: c.weight })),
        },
      });
      await qc.invalidateQueries({ queryKey: ['analyses', project.id] });
      navigate(`/p/${project.id}/proposal`);
    } catch (err) {
      toast.show(`Error: ${errorMessage(codeOf(err))}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={p.content}>
      <PageHeader label="Step 2 of 3 · Brief" title="Check the extracted brief" intro="Compare these details with the brief and correct anything that is wrong. Tasks are proposed from this information." />
      <div className={s.reviewGrid}>
        <Card>
          <div className={s.cardHead}>
            <h2 className={p.h3}>Deliverables</h2>
            <span className={p.caption}>{analysis.file_name ?? 'Pasted text'}</span>
          </div>
          {deliverables.map((d, i) => (
            <div key={i} className={s.editRow}>
              <TextField className={s.w2} compact label="Deliverable" value={d.name} error={errors[`d${i}`]} onChange={(e) => setDeliverables((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
              <TextField className={s.w1} compact label="Length or format" value={d.detail} onChange={(e) => setDeliverables((x) => x.map((y, j) => (j === i ? { ...y, detail: e.target.value } : y)))} />
              <Button variant="text" className={s.remove} aria-label={`Remove deliverable ${i + 1}`} onClick={() => setDeliverables((x) => x.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="text" className={s.start} onClick={() => setDeliverables((x) => [...x, { name: '', detail: '' }])} disabled={deliverables.length >= 20}>
            Add deliverable
          </Button>
        </Card>
        <div className={p.stackLg}>
          <Card>
            <h2 className={p.h3}>Deadlines</h2>
            {deadlines.map((d, i) => (
              <div key={i} className={s.editRow}>
                <TextField className={s.w2} compact label="Item" value={d.item} error={errors[`dl${i}`]} onChange={(e) => setDeadlines((x) => x.map((y, j) => (j === i ? { ...y, item: e.target.value } : y)))} />
                <TextField className={s.wDate} compact label="Date" placeholder="DD/MM/YYYY" numeric inputMode="numeric" value={d.date} error={errors[`dd${i}`]} onChange={(e) => setDeadlines((x) => x.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)))} />
                <TextField className={s.wTime} compact label="Time" placeholder="17:00" numeric inputMode="numeric" value={d.time} error={errors[`dt${i}`]} onChange={(e) => setDeadlines((x) => x.map((y, j) => (j === i ? { ...y, time: e.target.value } : y)))} />
                <Button variant="text" className={s.remove} aria-label={`Remove deadline ${i + 1}`} onClick={() => setDeadlines((x) => x.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="text" className={s.start} onClick={() => setDeadlines((x) => [...x, { item: '', date: '', time: '17:00' }])} disabled={deadlines.length >= 20}>
              Add deadline
            </Button>
          </Card>
          <Card>
            <div className={s.cardHead}>
              <h2 className={p.h3}>Marking criteria</h2>
              <span className={[s.total, total !== 100 && criteria.length ? s.totalWarn : ''].join(' ')}>Total {total}%</span>
            </div>
            {criteria.map((c, i) => (
              <div key={i} className={s.criterion}>
                <TextField hideLabel label={`Criterion ${i + 1}`} value={c.name} error={errors[`c${i}`]} onChange={(e) => setCriteria((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                <TextField
                  className={s.weight}
                  hideLabel
                  label={`Weight of criterion ${i + 1} in percent`}
                  inputMode="numeric"
                  numeric
                  value={c.weight == null ? '' : String(c.weight)}
                  onChange={(e) => {
                    const n = e.target.value.trim() === '' ? null : Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setCriteria((x) => x.map((y, j) => (j === i ? { ...y, weight: n } : y)));
                  }}
                />
                <span aria-hidden="true">%</span>
              </div>
            ))}
            <Button variant="text" className={s.start} onClick={() => setCriteria((x) => [...x, { name: '', weight: null }])} disabled={criteria.length >= 30}>
              Add criterion
            </Button>
          </Card>
        </div>
      </div>
      <div className={[p.actions, p.actionsRuled].join(' ')}>
        <Button size="lg" onClick={() => void save()} disabled={busy}>
          Save and propose tasks
        </Button>
        <Button size="lg" variant="secondary" onClick={onReplace}>
          Upload a different brief
        </Button>
      </div>
    </div>
  );
}

function CurrentBrief({ analyses, onReplace, left }: { analyses: Analysis[]; onReplace: () => void; left: number }) {
  const { project } = useProject();
  const toast = useToast();
  const brief = project.brief!;
  const source = analyses.find((a) => a.accepted_at);
  const openPdf = async () => {
    if (!source) return;
    try {
      const { url } = await api<{ url: string }>(`/api/projects/${project.id}/briefs/${source.id}/file`);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.show(`Error: ${errorMessage(codeOf(err))}`);
    }
  };
  return (
    <div className={p.content}>
      <PageHeader
        label="Brief"
        title={project.title}
        intro={source ? `Read from ${source.file_name ?? 'pasted text'} on ${formatDate(source.created_at)} and checked by the group.` : 'Checked by the group.'}
        actions={
          <>
            {source?.storage_path ? (
              <Button variant="secondary" onClick={() => void openPdf()}>
                Open the original PDF
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onReplace} disabled={left <= 0}>
              Upload a new brief
            </Button>
          </>
        }
      />
      <div className={s.reviewGrid}>
        <Card>
          <h2 className={p.h3}>Deliverables</h2>
          {brief.deliverables.map((d, i) => (
            <div key={i} className={s.readRow}>
              <span>{d.name}</span>
              <span className={s.readRight}>{d.detail}</span>
            </div>
          ))}
        </Card>
        <div className={p.stackLg}>
          <Card>
            <h2 className={p.h3}>Deadlines</h2>
            {brief.deadlines.map((d, i) => (
              <div key={i} className={s.readRow}>
                <span>{d.item}</span>
                <span className={s.num}>{d.due_at ? formatDateTime(d.due_at) : 'Not set'}</span>
              </div>
            ))}
          </Card>
          <Card>
            <h2 className={p.h3}>Marking criteria</h2>
            {brief.criteria.map((c, i) => (
              <div key={i} className={s.readRow}>
                <span>{c.name}</span>
                <span className={s.num}>{c.weight != null ? `${c.weight}%` : ''}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
      <p className={[p.small, p.muted].join(' ')}>A new brief proposes additional tasks. Existing tasks and the contribution log are kept. {left} brief {left === 1 ? 'breakdown' : 'breakdowns'} left.</p>
    </div>
  );
}
