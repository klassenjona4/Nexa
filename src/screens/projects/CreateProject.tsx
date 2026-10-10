import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { parseIrishDateTime } from '../../../shared/dates';
import { createGroup } from '../../../shared/schemas/groups';
import p from '../../app/page.module.css';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { ErrorPanel } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, codeOf } from '../../lib/api';
import s from './CreateProject.module.css';

type Errors = Partial<Record<'group_name' | 'title' | 'deadline_date' | 'deadline_time', string>>;

export function CreateProject() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ group_name: '', module_code: '', title: '', deadline_date: '', deadline_time: '17:00' });
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.group_name.trim()) next.group_name = 'Enter a group name.';
    if (!form.title.trim()) next.title = 'Enter the assignment title.';
    if (form.deadline_date.trim() && !parseIrishDateTime(form.deadline_date, form.deadline_time || '17:00')) {
      next.deadline_date = 'Enter a real date in the format DD/MM/YYYY.';
    }
    if (form.deadline_time.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.deadline_time.trim())) next.deadline_time = 'Enter the time as HH:MM, 24 hour.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = createGroup.parse({ ...form, deadline_time: form.deadline_date.trim() ? form.deadline_time : '' });
    setBusy(true);
    setFailed(false);
    try {
      const res = await api<{ project_id: string }>('/api/groups', { body });
      await qc.invalidateQueries({ queryKey: ['projects'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.show('Group created. Next, upload the brief.');
      navigate(`/p/${res.project_id}/brief`);
    } catch (err) {
      if (codeOf(err) === 'invalid_input') setErrors({ deadline_date: 'Check the date and time.' });
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={p.content}>
      <div className={[p.narrow, p.stackLg].join(' ')} style={{ gap: 32 }}>
        <PageHeader label="Step 1 of 3 · Group and project" title="Create a group and project" intro="You become the owner of the group. Next you upload the brief, then invite members." />
        {failed ? <ErrorPanel title="The group was not created" body="A connection error stopped the group from saving. Your entries are kept. Try again." /> : null}
        <form onSubmit={submit} className={s.form} noValidate>
          <fieldset className={s.fieldset}>
            <legend className={s.legend}>Group</legend>
            <TextField label="Group name" placeholder="Media Law group 4" value={form.group_name} onChange={set('group_name')} error={errors.group_name} maxLength={80} required />
          </fieldset>
          <fieldset className={[s.fieldset, s.ruled].join(' ')}>
            <legend className={s.legend}>Project</legend>
            <div className={s.row}>
              <TextField className={s.small} label="Module code" placeholder="MDIA7012" value={form.module_code} onChange={set('module_code')} maxLength={20} />
              <TextField className={s.large} label="Assignment title" placeholder="Assignment 2 · Case study report" value={form.title} onChange={set('title')} error={errors.title} maxLength={160} required />
            </div>
            <div className={s.row}>
              <TextField className={s.date} label="Final deadline date" inputMode="numeric" placeholder="DD/MM/YYYY" hint="Format DD/MM/YYYY" value={form.deadline_date} onChange={set('deadline_date')} error={errors.deadline_date} numeric />
              <TextField className={s.time} label="Time" inputMode="numeric" placeholder="HH:MM" hint="24 hour, Irish time" value={form.deadline_time} onChange={set('deadline_time')} error={errors.deadline_time} numeric />
            </div>
            <p className={[p.small, p.muted].join(' ')}>The brief can change these details. You review everything before tasks are created.</p>
          </fieldset>
          <div className={[p.actions, p.actionsRuled].join(' ')}>
            <Button type="submit" size="lg" disabled={busy}>
              Create and continue
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('/projects')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
