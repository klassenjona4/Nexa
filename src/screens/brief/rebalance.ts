import type { Member } from '../../lib/project';

export type Draft = { key: number; title: string; description: string; deliverable: string; estimated_hours: number; due_at: string | null; assignee_id: string | null };

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
