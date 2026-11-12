import { Hono } from 'hono';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../context.js';
import { HttpError } from '../http.js';
import { type BillingDeps, type BillingStore, handleStripeEvent, type Purchase, type SubscriptionState } from './billing.js';

vi.mock('../ratelimit.js', () => ({ rateLimit: vi.fn(async () => {}), clientIp: () => 'test', LIMITS: {} }));
vi.mock('../logger.js', () => ({ log: vi.fn() }));

const USER = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const SECRET = 'whsec_test_secret_for_unit_tests';

class MemoryStore implements BillingStore {
  events = new Set<string>();
  purchases = new Map<string, Purchase>();
  credits = new Map<string, number>();
  unlocks = new Map<string, number>();
  members = new Set<string>([`${PROJECT}:${USER}`]);
  customers = new Map<string, string>();
  subs = new Map<string, SubscriptionState>();
  failNextCredit = false;

  async claimEvent(id: string) {
    if (this.events.has(id)) return false;
    this.events.add(id);
    return true;
  }
  async releaseEvent(id: string) {
    this.events.delete(id);
  }
  async recordPurchase(p: Purchase) {
    if (this.purchases.has(p.sessionId)) return false;
    this.purchases.set(p.sessionId, p);
    return true;
  }
  async addCredit(userId: string) {
    if (this.failNextCredit) {
      this.failNextCredit = false;
      throw new Error('database down');
    }
    this.credits.set(userId, (this.credits.get(userId) ?? 0) + 1);
  }
  async unlockProject(projectId: string, userId: string) {
    if (!this.members.has(`${projectId}:${userId}`)) return false;
    this.unlocks.set(projectId, (this.unlocks.get(projectId) ?? 0) + 1);
    return true;
  }
  async setCustomer(userId: string, customerId: string) {
    this.customers.set(customerId, userId);
  }
  async userForCustomer(customerId: string) {
    return this.customers.get(customerId) ?? null;
  }
  async currentSubscription(userId: string) {
    const s = this.subs.get(userId);
    return s ? { id: s.id, status: s.status } : null;
  }
  async saveSubscription(userId: string, s: SubscriptionState) {
    this.subs.set(userId, s);
  }
}

function subscription(id: string, status: string, end = 1_900_000_000, metadata: Record<string, string> = { user_id: USER }): Stripe.Subscription {
  return {
    id,
    object: 'subscription',
    status,
    customer: 'cus_1',
    cancel_at_period_end: false,
    metadata,
    items: { object: 'list', data: [{ current_period_end: end }], has_more: false, url: '' },
  } as unknown as Stripe.Subscription;
}

let n = 0;
function event(type: string, object: Record<string, unknown>, id = `evt_${++n}`): Stripe.Event {
  return { id, object: 'event', type, created: 1_800_000_000, data: { object }, api_version: '2026-10-28.endive', livemode: false } as unknown as Stripe.Event;
}

function paidProjectSession(extra: Record<string, unknown> = {}) {
  return {
    id: `cs_${++n}`,
    object: 'checkout.session',
    mode: 'payment',
    payment_status: 'paid',
    customer: 'cus_1',
    client_reference_id: USER,
    amount_total: 200,
    currency: 'eur',
    metadata: { user_id: USER, kind: 'project', project_id: '' },
    ...extra,
  };
}

let store: MemoryStore;
let subs: Map<string, Stripe.Subscription>;
let deps: BillingDeps;

beforeEach(() => {
  store = new MemoryStore();
  subs = new Map();
  deps = {
    store,
    retrieveSubscription: async (id) => {
      const s = subs.get(id);
      if (!s) throw new Error('no such subscription');
      return s;
    },
  };
});

describe('handleStripeEvent', () => {
  it('a paid project checkout without a project adds a credit', async () => {
    await handleStripeEvent(event('checkout.session.completed', paidProjectSession()), deps);
    expect(store.credits.get(USER)).toBe(1);
    expect([...store.purchases.values()][0]).toMatchObject({ kind: 'project_credit', amountCents: 200, currency: 'eur' });
    expect(store.customers.get('cus_1')).toBe(USER);
  });

  it('a paid checkout for a project unlocks that project', async () => {
    await handleStripeEvent(event('checkout.session.completed', paidProjectSession({ metadata: { user_id: USER, kind: 'project', project_id: PROJECT } })), deps);
    expect(store.unlocks.get(PROJECT)).toBe(1);
    expect(store.credits.get(USER)).toBeUndefined();
  });

  it('a buyer who left the project gets a credit instead', async () => {
    store.members.clear();
    await handleStripeEvent(event('checkout.session.completed', paidProjectSession({ metadata: { user_id: USER, kind: 'project', project_id: PROJECT } })), deps);
    expect(store.unlocks.size).toBe(0);
    expect(store.credits.get(USER)).toBe(1);
  });

  it('an unpaid checkout grants nothing until the payment succeeds', async () => {
    const session = paidProjectSession({ payment_status: 'unpaid' });
    await handleStripeEvent(event('checkout.session.completed', session), deps);
    expect(store.credits.size).toBe(0);
    await handleStripeEvent(event('checkout.session.async_payment_succeeded', { ...session, payment_status: 'paid' }), deps);
    expect(store.credits.get(USER)).toBe(1);
  });

  it('the same event is applied once', async () => {
    const e = event('checkout.session.completed', paidProjectSession());
    expect(await handleStripeEvent(e, deps)).toBe(true);
    expect(await handleStripeEvent(e, deps)).toBe(false);
    expect(store.credits.get(USER)).toBe(1);
  });

  it('the same Checkout session in two different events is applied once', async () => {
    const session = paidProjectSession();
    await handleStripeEvent(event('checkout.session.completed', session), deps);
    await handleStripeEvent(event('checkout.session.async_payment_succeeded', session), deps);
    expect(store.credits.get(USER)).toBe(1);
  });

  it('a failure releases the event so the Stripe retry is applied', async () => {
    store.failNextCredit = true;
    const e = event('checkout.session.completed', paidProjectSession());
    await expect(handleStripeEvent(e, deps)).rejects.toThrow();
    expect(store.events.has(e.id)).toBe(false);
    store.purchases.clear();
    expect(await handleStripeEvent(e, deps)).toBe(true);
    expect(store.credits.get(USER)).toBe(1);
  });

  it('a subscription checkout stores the subscription as read from Stripe', async () => {
    subs.set('sub_1', subscription('sub_1', 'active'));
    await handleStripeEvent(event('checkout.session.completed', { id: 'cs_s', mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: USER, metadata: { user_id: USER, kind: 'subscription' } }), deps);
    expect(store.subs.get(USER)).toMatchObject({ id: 'sub_1', status: 'active', periodEnd: new Date(1_900_000_000 * 1000).toISOString() });
  });

  it('subscription updates and cancellation follow the current state in Stripe', async () => {
    subs.set('sub_1', subscription('sub_1', 'past_due'));
    await handleStripeEvent(event('customer.subscription.updated', { id: 'sub_1' }), deps);
    expect(store.subs.get(USER)?.status).toBe('past_due');
    subs.set('sub_1', subscription('sub_1', 'canceled'));
    await handleStripeEvent(event('customer.subscription.deleted', { id: 'sub_1' }), deps);
    expect(store.subs.get(USER)?.status).toBe('canceled');
  });

  it('an event that arrives late cannot roll back the state', async () => {
    subs.set('sub_1', subscription('sub_1', 'canceled'));
    // An old "updated" event that still says active: Stripe is asked for the current state.
    await handleStripeEvent(event('customer.subscription.updated', { id: 'sub_1', status: 'active' }), deps);
    expect(store.subs.get(USER)?.status).toBe('canceled');
  });

  it('an old subscription ending does not overwrite a newer active one', async () => {
    store.subs.set(USER, { id: 'sub_new', status: 'active', periodEnd: null, cancelAtPeriodEnd: false, customerId: 'cus_1' });
    subs.set('sub_old', subscription('sub_old', 'canceled'));
    await handleStripeEvent(event('customer.subscription.deleted', { id: 'sub_old' }), deps);
    expect(store.subs.get(USER)?.id).toBe('sub_new');
  });

  it('a failed invoice payment updates the subscription status', async () => {
    subs.set('sub_1', subscription('sub_1', 'past_due'));
    await handleStripeEvent(event('invoice.payment_failed', { id: 'in_1', parent: { subscription_details: { subscription: 'sub_1' } } }), deps);
    expect(store.subs.get(USER)?.status).toBe('past_due');
  });

  it('finds the user by customer when the subscription has no user id', async () => {
    store.customers.set('cus_1', USER);
    subs.set('sub_1', subscription('sub_1', 'active', 1_900_000_000, {}));
    await handleStripeEvent(event('customer.subscription.created', { id: 'sub_1' }), deps);
    expect(store.subs.get(USER)?.status).toBe('active');
  });

  it('ignores event types it does not use', async () => {
    expect(await handleStripeEvent(event('charge.refunded', { id: 'ch_1' }), deps)).toBe(true);
    expect(store.credits.size + store.subs.size).toBe(0);
  });
});

describe('POST /api/stripe/webhook', () => {
  async function appWith() {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const { stripeWebhookRoutes } = await import('../routes/billing.js');
    const app = new Hono<AppEnv>();
    app.onError((err, c) => (err instanceof HttpError ? c.json({ error: err.code }, err.status as 400) : c.json({ error: 'server_error' }, 500)));
    app.route('/api/stripe', stripeWebhookRoutes(() => deps));
    return app;
  }
  const post = (app: Hono<AppEnv>, payload: string, signature?: string) =>
    app.request('/api/stripe/webhook', { method: 'POST', body: payload, headers: { 'content-type': 'application/json', ...(signature ? { 'stripe-signature': signature } : {}) } });

  it('applies a correctly signed event', async () => {
    const app = await appWith();
    const payload = JSON.stringify(event('checkout.session.completed', paidProjectSession()));
    const res = await post(app, payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }));
    expect(res.status).toBe(200);
    expect(store.credits.get(USER)).toBe(1);
  });

  it('refuses an event signed with another secret', async () => {
    const app = await appWith();
    const payload = JSON.stringify(event('checkout.session.completed', paidProjectSession()));
    const res = await post(app, payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_someone_else' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_signature' });
    expect(store.credits.size).toBe(0);
  });

  it('refuses a body changed after signing', async () => {
    const app = await appWith();
    const payload = JSON.stringify(event('checkout.session.completed', paidProjectSession()));
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const res = await post(app, payload.replace('"amount_total":200', '"amount_total":0'), signature);
    expect(res.status).toBe(400);
    expect(store.credits.size).toBe(0);
  });

  it('refuses a request without a signature', async () => {
    const app = await appWith();
    const res = await post(app, JSON.stringify(event('checkout.session.completed', paidProjectSession())));
    expect(res.status).toBe(400);
  });

  it('refuses an old signature (replay)', async () => {
    const app = await appWith();
    const payload = JSON.stringify(event('checkout.session.completed', paidProjectSession()));
    const old = Math.floor(Date.now() / 1000) - 3600;
    const res = await post(app, payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: old }));
    expect(res.status).toBe(400);
  });

  it('answers 200 to a duplicate delivery without applying it again', async () => {
    const app = await appWith();
    const payload = JSON.stringify(event('checkout.session.completed', paidProjectSession()));
    const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect((await post(app, payload, sig)).status).toBe(200);
    expect((await post(app, payload, sig)).status).toBe(200);
    expect(store.credits.get(USER)).toBe(1);
  });

  it('answers 503 when the webhook secret is not set', async () => {
    const app = await appWith();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const payload = JSON.stringify(event('checkout.session.completed', paidProjectSession()));
    const res = await post(app, payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }));
    expect(res.status).toBe(503);
  });
});
