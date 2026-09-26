import { type FormEvent, useId, useState } from 'react';
import { formatDate, formatTime, parseIrishDateTime } from '../../../shared/dates';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { SelectField, TextArea, TextField } from '../../components/Field';
import { Label } from '../../components/Label';
import type { Member } from '../../lib/project';
import type { Task } from '../../lib/tasks';
import s from './Board.module.css';

export type TaskFormValues = {
  title: string;
  description: string;
  deliverable: string;
  assignee_id: string | null;
  due_date: string;
  due_time: string;
  estimated_hours: number;
};

export function taskToForm(t?: Task, defaultAssignee?: string): TaskFormValues {
  return {
    title: t?.title ?? '',
    description: t?.description ?? '',
    deliverable: t?.deliverable ?? '',
    assignee_id: t ? t.assignee_id : (defaultAssignee ?? null),
    due_date: t?.due_at ? formatDate(t.due_at) : '',
    due_time: t?.due_at ? formatTime(t.due_at) : '',
    estimated_hours: t ? Number(t.estimated_hours) : 1,
  };
}

// New task and edit task, in a modal from 600 px and a bottom sheet below.
export function TaskFormDialog({
  open,
  title,
  initial,
  members,
  submitLabel,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  initial: TaskFormValues;
  members: Member[];
  submitLabel: string;
  onSubmit: (v: TaskFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={`${id}-t`}>
      {open ? <TaskFormBody headingId={`${id}-t`} title={title} initial={initial} members={members} submitLabel={submitLabel} onSubmit={onSubmit} onClose={onClose} /> : null}
    </Dialog>
  );
}

function TaskFormBody({ headingId, title, initial, members, submitLabel, onSubmit, onClose }: { headingId: string; title: string; initial: TaskFormValues; members: Member[]; submitLabel: string; onSubmit: (v: TaskFormValues) => Promise<void>; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormValues, string>>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TaskFormValues>(k: K, value: TaskFormValues[K]) => {
    setV((x) => ({ ...x, [k]: value }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!v.title.trim()) next.title = 'Enter a task title.';
    if (v.due_date.trim() && !parseIrishDateTime(v.due_date, v.due_time || '17:00')) next.due_date = 'Enter a real date in the format DD/MM/YYYY.';
    if (v.due_time.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.due_time.trim())) next.due_time = 'Enter the time as HH:MM, 24 hour.';
    if (!(v.estimated_hours >= 0 && v.estimated_hours <= 200) || Math.round(v.estimated_hours * 2) !== v.estimated_hours * 2) next.estimated_hours = 'Enter hours between 0 and 200 in steps of 0.5.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await onSubmit({ ...v, title: v.title.trim(), due_date: v.due_date.trim(), due_time: v.due_date.trim() ? v.due_time.trim() : '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={s.form} noValidate>
      <div className={s.formHead}>
        <Label>Task</Label>
        <h2 id={headingId} className={s.formTitle}>
          {title}
        </h2>
      </div>
      <TextField label="Title" value={v.title} onChange={(e) => set('title', e.target.value)} error={errors.title} maxLength={200} data-autofocus />
      <div className={s.formRow}>
        <SelectField className={s.flex2} label="Owner" value={v.assignee_id ?? ''} onChange={(e) => set('assignee_id', e.target.value || null)}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name}
            </option>
          ))}
        </SelectField>
        <TextField className={s.flex1} label="Hours" type="number" min={0} max={200} step={0.5} numeric value={String(v.estimated_hours)} onChange={(e) => set('estimated_hours', Number(e.target.value))} error={errors.estimated_hours} />
      </div>
      <div className={s.formRow}>
        <TextField className={s.flex2} label="Due date" placeholder="DD/MM/YYYY" inputMode="numeric" numeric value={v.due_date} onChange={(e) => set('due_date', e.target.value)} error={errors.due_date} hint="Format DD/MM/YYYY" />
        <TextField className={s.flex1} label="Time" placeholder="17:00" inputMode="numeric" numeric value={v.due_time} onChange={(e) => set('due_time', e.target.value)} error={errors.due_time} hint="24 hour" />
      </div>
      <TextField label="Deliverable" value={v.deliverable} onChange={(e) => set('deliverable', e.target.value)} maxLength={200} />
      <TextArea label="Description" rows={4} value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={4000} />
      <div className={s.formActions}>
        <Button type="submit" size="lg" disabled={busy}>
          {submitLabel}
        </Button>
        <Button size="lg" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
