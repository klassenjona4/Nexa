import { describe, expect, it } from 'vitest';
import type { Member } from '../../lib/project';
import { rebalance } from './Proposal';

const member = (id: string): Member => ({ user_id: id, full_name: id, email: '', role: 'member', joined_at: id });
const task = (key: number, hours: number) => ({ key, title: `T${key}`, description: '', deliverable: '', estimated_hours: hours, due_at: null, assignee_id: null });

describe('suggest a new split', () => {
  it('shares hours as evenly as the tasks allow', () => {
    const members = [member('a'), member('b'), member('c'), member('d')];
    const tasks = [6, 3, 8, 6, 3, 3, 3, 2, 1, 1].map((h, i) => task(i, h));
    const out = rebalance(tasks, members);
    const totals = members.map((m) => out.filter((t) => t.assignee_id === m.user_id).reduce((a, t) => a + t.estimated_hours, 0));
    expect(totals.reduce((a, b) => a + b, 0)).toBe(36);
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1);
  });
});
