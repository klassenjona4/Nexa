import { describe, expect, it } from 'vitest';
import { app } from './app.js';

// The calendar feed was removed on 24/11/2026. Its table stays in the database, so reverting the
// code brings the feature back with its data; until then none of its routes may exist.
describe('calendar feed removed', () => {
  it('registers no calendar routes', () => {
    const paths = app.routes.map((r) => r.path);
    expect(paths.filter((p) => p.includes('calendar') || p.startsWith('/cal'))).toEqual([]);
  });

  it('answers 404 for an old calendar feed link', async () => {
    const res = await app.request('/cal/AbCdEfGhIjKlMnOpQrStUv.ics');
    expect(res.status).toBe(404);
  });
});
