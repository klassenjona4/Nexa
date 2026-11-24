// When a new version of the app is ready, the page reloads only when nobody can lose work:
// right after it opened, while the tab is hidden, or when the person moves to another page.
export const RELOAD_GRACE_MS = 10_000;

export function canReloadNow(loadedAt: number, now: number, hidden: boolean): boolean {
  return hidden || now - loadedAt < RELOAD_GRACE_MS;
}
