// Wording for contribution log entries. Used by the timeline and by the statement digest.
export type LogEntryLike = {
  event: string;
  task_title: string | null;
  payload: unknown;
};

const STATUS: Record<string, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

function field(payload: unknown, key: string): string | null {
  if (payload && typeof payload === 'object' && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : null;
  }
  return null;
}

export function describeEntry(e: LogEntryLike, nameOf: (id: string | null) => string): { text: string; note: string } {
  const t = e.task_title ? `"${e.task_title}"` : 'a task';
  switch (e.event) {
    case 'group_joined':
      return { text: 'joined the group.', note: '' };
    case 'brief_uploaded':
      return { text: 'uploaded the brief.', note: field(e.payload, 'file_name') ?? '' };
    case 'tasks_created': {
      const n = Number(field(e.payload, 'count') ?? 0);
      return { text: `created ${n} ${n === 1 ? 'task' : 'tasks'} from the brief.`, note: '' };
    }
    case 'task_created':
      return { text: `created ${t}.`, note: '' };
    case 'task_status_changed': {
      const to = field(e.payload, 'to') ?? '';
      return { text: to === 'done' ? `marked ${t} as done.` : `moved ${t} to ${STATUS[to] ?? to}.`, note: '' };
    }
    case 'task_assigned': {
      const who = field(e.payload, 'assignee_id');
      return { text: who ? `assigned ${t} to ${nameOf(who)}.` : `unassigned ${t}.`, note: '' };
    }
    case 'task_link_added':
      return { text: `attached a file link to ${t}.`, note: field(e.payload, 'label') ?? '' };
    case 'task_confirmed':
      return { text: `confirmed ${t}.`, note: '' };
    case 'task_flagged':
      return { text: `flagged ${t}.`, note: field(e.payload, 'note') ?? '' };
    case 'member_left':
      return { text: 'left the group.', note: '' };
    case 'member_removed':
      return { text: `removed ${nameOf(field(e.payload, 'member_id'))} from the group.`, note: '' };
    default:
      return { text: 'updated the project.', note: '' };
  }
}
