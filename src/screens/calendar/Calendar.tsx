import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import p from '../../app/page.module.css';
import { Button } from '../../components/Button';
import { Tabs } from '../../components/Controls';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { InlineNotice } from '../../components/Display';
import { TextField } from '../../components/Field';
import { Label } from '../../components/Label';
import { ErrorPanel, LoadingState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { useProject } from '../../lib/project';
import { Board } from '../board/Board';
import s from './Calendar.module.css';

type Feed = { url: string; deadlines: number; tasks: number };
type App = 'google' | 'apple' | 'outlook';

const STEPS: Record<App, string[]> = {
  google: ['Copy the calendar link above.', 'On a computer, open Google Calendar.', 'Next to Other calendars, select Add, then From URL.', 'Paste the link and select Add calendar.'],
  apple: [
    'Copy the calendar link above.',
    'On iPhone or iPad, open Settings, then Apps, then Calendar, then Calendar Accounts, then Add Account, then Other.',
    'Select Add Subscribed Calendar, paste the link and select Next.',
    'On a Mac, open Calendar and choose File, then New Calendar Subscription.',
  ],
  outlook: ['Copy the calendar link above.', 'Open Outlook on the web or the new Outlook app.', 'Select Add calendar, then Subscribe from web.', 'Paste the link, name the calendar and select Import.'],
};
const NOTES: Record<App, string> = {
  google: 'Google Calendar reads the feed about every 12 hours, so a change can take up to a day to appear. The feed cannot be added in the Google Calendar phone app.',
  apple: 'Apple Calendar lets you choose how often to refresh. Every hour is recommended.',
  outlook: 'Outlook reads subscribed calendars every few hours.',
};

// Route /p/:id/calendar: the board with the subscription dialog on top.
export function CalendarRoute() {
  const { project } = useProject();
  const navigate = useNavigate();
  return (
    <>
      <Board />
      <CalendarDialog projectId={project.id} groupName={project.group_name} onClose={() => navigate(`/p/${project.id}/board`)} />
    </>
  );
}

function CalendarDialog({ projectId, groupName, onClose }: { projectId: string; groupName: string; onClose: () => void }) {
  const id = useId();
  const toast = useToast();
  const qc = useQueryClient();
  const [app, setApp] = useState<App>('google');
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const key = ['calendar', projectId];
  const q = useQuery({ queryKey: key, queryFn: () => api<Feed>(`/api/projects/${projectId}/calendar`, { method: 'POST' }), staleTime: Infinity });

  const copy = async () => {
    if (!q.data) return;
    try {
      await navigator.clipboard.writeText(q.data.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.show('Calendar link copied.');
    } catch {
      toast.show('The link could not be copied. Select it and copy it by hand.');
    }
  };

  const intro = q.data
    ? `The feed contains ${q.data.deadlines} ${q.data.deadlines === 1 ? 'deadline' : 'deadlines'} from the brief and the due dates of your ${q.data.tasks} ${q.data.tasks === 1 ? 'task' : 'tasks'}. It contains titles and dates only and updates when a due date changes. The link is personal. Anyone who has it can see the deadlines, so do not share it.`
    : '';

  return (
    <>
      <Dialog open={!confirm} onClose={onClose} labelledBy={`${id}-t`}>
        <div className={s.head}>
          <div className={s.titleBlock}>
            <Label>{groupName}</Label>
            <h2 id={`${id}-t`} className={s.title}>
              Subscribe to group deadlines
            </h2>
          </div>
          <button type="button" className={s.close} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={s.body}>
          {q.isPending ? <LoadingState text="Loading the calendar feed" /> : null}
          {q.isError ? <ErrorPanel title="The calendar link could not be created" body="Try again. Existing subscriptions keep working." onRetry={() => void q.refetch()} /> : null}
          {q.data ? (
            <>
              {q.data.deadlines + q.data.tasks === 0 ? <InlineNotice>The feed has no deadlines yet. Deadlines appear after the brief is reviewed and tasks have due dates.</InlineNotice> : null}
              <p className={p.intro}>{intro}</p>
              <div className={p.stack} style={{ gap: 8 }}>
                <TextField label="Calendar link" readOnly value={q.data.url} onFocus={(e) => e.target.select()} />
                <div className={s.buttons}>
                  <Button onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
                  <Button variant="secondary" onClick={() => setConfirm(true)}>
                    Regenerate link
                  </Button>
                </div>
              </div>
              <Tabs
                idPrefix="cal"
                small
                label="Calendar app"
                options={[
                  { value: 'google', label: 'Google' },
                  { value: 'apple', label: 'Apple' },
                  { value: 'outlook', label: 'Outlook' },
                ]}
                value={app}
                onChange={setApp}
              />
              <ol role="tabpanel" id="cal-panel" aria-labelledby={`cal-tab-${app}`} className={s.steps}>
                {STEPS[app].map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className={p.caption} style={{ lineHeight: 1.5 }}>
                {NOTES[app]}
              </p>
            </>
          ) : null}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        label="Calendar feed"
        title="Regenerate the calendar link?"
        body="The current link stops working. Calendars subscribed with it stop updating and need to be subscribed again with the new link."
        confirmLabel="Regenerate link"
        destructive={false}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          const next = await api<Feed>(`/api/projects/${projectId}/calendar/regenerate`, { method: 'POST' });
          qc.setQueryData(key, next);
          setConfirm(false);
          toast.show('New calendar link created. The old link no longer works.');
        }}
      />
    </>
  );
}
