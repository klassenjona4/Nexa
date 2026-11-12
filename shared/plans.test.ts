import { describe, expect, it } from 'vitest';
import { allowanceLeft, nextProjectSource } from './plans.js';

describe('allowanceLeft', () => {
  it('counts what is left on a limited plan', () => {
    expect(allowanceLeft({ used: 1, max: 3, unlimited: false, plan: 'project', subscriptionActive: null })).toBe(2);
    expect(allowanceLeft({ used: 1, max: 1, unlimited: false, plan: 'free', subscriptionActive: null })).toBe(0);
  });
  it('is null for an active subscription', () => {
    expect(allowanceLeft({ used: 5, max: 30, unlimited: true, plan: 'subscription', subscriptionActive: true })).toBeNull();
  });
  it('is 0 when the subscription has ended', () => {
    expect(allowanceLeft({ used: 0, max: 0, unlimited: true, plan: 'subscription', subscriptionActive: false })).toBe(0);
  });
});

describe('nextProjectSource', () => {
  it('follows the order the database applies', () => {
    expect(nextProjectSource({ subscriptionActive: true, freeProjectAvailable: true, projectCredits: 2 })).toBe('subscription');
    expect(nextProjectSource({ subscriptionActive: false, freeProjectAvailable: true, projectCredits: 2 })).toBe('free');
    expect(nextProjectSource({ subscriptionActive: false, freeProjectAvailable: false, projectCredits: 2 })).toBe('credit');
    expect(nextProjectSource({ subscriptionActive: false, freeProjectAvailable: false, projectCredits: 0 })).toBeNull();
  });
});
