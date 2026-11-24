import { describe, expect, it } from 'vitest';
import { canReloadNow, RELOAD_GRACE_MS } from './appUpdate.js';

describe('canReloadNow', () => {
  it('reloads straight away just after the page opened', () => {
    expect(canReloadNow(1_000, 1_000 + RELOAD_GRACE_MS - 1, false)).toBe(true);
  });
  it('waits while someone is using the page', () => {
    expect(canReloadNow(1_000, 1_000 + RELOAD_GRACE_MS + 1, false)).toBe(false);
  });
  it('reloads when the tab is hidden', () => {
    expect(canReloadNow(1_000, 1_000 + 3_600_000, true)).toBe(true);
  });
});
