import { describe, expect, it } from 'vitest';
import { PAYMENTS_AVAILABLE } from '../shared/plans.js';
import { app } from './app.js';

// Until the business is registered there is no payment backend at all.
describe('payments switched off', () => {
  it('has no billing or webhook routes', async () => {
    expect(PAYMENTS_AVAILABLE).toBe(false);
    for (const path of ['/api/billing/checkout', '/api/billing/portal', '/api/stripe/webhook']) {
      const res = await app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      expect(res.status, path).toBe(404);
    }
  });
});
