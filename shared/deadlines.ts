// Helpers for comparing task due dates with a project's final deadline.

type Dated = { due_at: string | null };

// The latest dated deadline in a brief, taken as its final submission date.
export function finalBriefDeadline(deadlines: readonly Dated[]): string | null {
  let latest: string | null = null;
  for (const d of deadlines) {
    if (d.due_at && (!latest || new Date(d.due_at).getTime() > new Date(latest).getTime())) latest = d.due_at;
  }
  return latest;
}

// True when a task is due after the final deadline. Missing dates never count as late.
export function isAfterDeadline(dueAt: string | null | undefined, finalDeadline: string | null | undefined): boolean {
  if (!dueAt || !finalDeadline) return false;
  return new Date(dueAt).getTime() > new Date(finalDeadline).getTime();
}

// True when the brief's final submission date differs from the project's final deadline.
export function deadlineDiffers(briefFinal: string | null, projectFinal: string | null): boolean {
  if (!briefFinal) return false;
  if (!projectFinal) return true;
  return new Date(briefFinal).getTime() !== new Date(projectFinal).getTime();
}
