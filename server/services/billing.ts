import Stripe from 'stripe';
import { requireEnv } from '../env.js';
import { HttpError } from '../http.js';
import { log } from '../logger.js';
import { adminClient } from '../supabase.js';

// Stripe access and the webhook rules. Card details never reach Nexa: payments happen on
// Stripe Checkout, and Nexa stores only Stripe ids, the subscription status and its renewal date.

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) client = new Stripe(requireEnv('STRIPE_SECRET_KEY'), { maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}

// Verifies the Stripe-Signature header against the raw body. Throws 400 on any mismatch.
export function verifyWebhook(rawBody: string, signature: string | undefined, secret: string): Stripe.Event {
  if (!signature) throw new HttpError(400, 'invalid_signature');
  try {
    return Stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new HttpError(400, 'invalid_signature');
  }
}

export type SubscriptionState = {
  id: string;
  status: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  customerId: string | null;
};

export type Purchase = {
  sessionId: string;
  userId: string;
  kind: 'project_credit' | 'project_unlock';
  projectId: string | null;
  amountCents: number;
  currency: string;
};

// What the webhook needs from the database. The Supabase version is below; tests use one in memory.
export interface BillingStore {
  claimEvent(id: string, type: string): Promise<boolean>;
  releaseEvent(id: string): Promise<void>;
  recordPurchase(p: Purchase): Promise<boolean>;
  addCredit(userId: string): Promise<void>;
  unlockProject(projectId: string, userId: string): Promise<boolean>;
  setCustomer(userId: string, customerId: string): Promise<void>;
  userForCustomer(customerId: string): Promise<string | null>;
  currentSubscription(userId: string): Promise<{ id: string | null; status: string | null } | null>;
  saveSubscription(userId: string, s: SubscriptionState): Promise<void>;
}

export type BillingDeps = {
  store: BillingStore;
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>;
};

const ACTIVE = new Set(['active', 'trialing', 'past_due']);

function idOf(x: string | { id: string } | null | undefined): string | null {
  if (!x) return null;
  return typeof x === 'string' ? x : x.id;
}

export function subscriptionState(sub: Stripe.Subscription): SubscriptionState {
  // Since the 2025 API versions the billing period lives on the subscription items.
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === 'number');
  const end = ends.length ? Math.max(...ends) : null;
  return {
    id: sub.id,
    status: sub.status,
    periodEnd: end ? new Date(end * 1000).toISOString() : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    customerId: idOf(sub.customer),
  };
}

async function syncSubscription(deps: BillingDeps, subscriptionId: string, hintUser: string | null): Promise<void> {
  // The current state is read from Stripe, so events that arrive out of order cannot roll it back.
  const sub = await deps.retrieveSubscription(subscriptionId);
  const state = subscriptionState(sub);
  const userId = sub.metadata?.user_id || hintUser || (state.customerId ? await deps.store.userForCustomer(state.customerId) : null);
  if (!userId) {
    log({ event: 'stripe_unmatched', code: 'subscription' });
    return;
  }
  const current = await deps.store.currentSubscription(userId);
  // An older subscription must not overwrite a newer active one.
  if (current?.id && current.id !== state.id && current.status && ACTIVE.has(current.status) && !ACTIVE.has(state.status)) return;
  await deps.store.saveSubscription(userId, state);
}

async function completeCheckout(deps: BillingDeps, session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id || session.client_reference_id;
  if (!userId) {
    log({ event: 'stripe_unmatched', code: 'checkout' });
    return;
  }
  const customerId = idOf(session.customer);
  if (customerId) await deps.store.setCustomer(userId, customerId);

  if (session.mode === 'subscription') {
    const subId = idOf(session.subscription);
    if (subId) await syncSubscription(deps, subId, userId);
    return;
  }
  if (session.mode !== 'payment' || session.metadata?.kind !== 'project') return;
  // Bank transfers and similar methods complete later, in checkout.session.async_payment_succeeded.
  if (session.payment_status !== 'paid') return;

  const projectId = session.metadata?.project_id || null;
  const fresh = await deps.store.recordPurchase({
    sessionId: session.id,
    userId,
    kind: projectId ? 'project_unlock' : 'project_credit',
    projectId,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? 'eur',
  });
  if (!fresh) return; // Already applied for this Checkout session.
  if (projectId && (await deps.store.unlockProject(projectId, userId))) return;
  // No project given, or the buyer is no longer a member: the payment becomes a credit.
  await deps.store.addCredit(userId);
}

// Applies one verified event. Returns false when the event was already handled.
export async function handleStripeEvent(event: Stripe.Event, deps: BillingDeps): Promise<boolean> {
  if (!(await deps.store.claimEvent(event.id, event.type))) return false;
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await completeCheckout(deps, event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await syncSubscription(deps, event.data.object.id, null);
        break;
      case 'invoice.payment_failed':
      case 'invoice.paid': {
        const inv = event.data.object;
        const subId = idOf(inv.parent?.subscription_details?.subscription ?? null);
        if (subId) await syncSubscription(deps, subId, null);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Let Stripe retry: the event is released so the retry is applied.
    await deps.store.releaseEvent(event.id);
    throw err;
  }
  return true;
}

export const supabaseBillingStore: BillingStore = {
  async claimEvent(id, type) {
    const { error } = await adminClient().from('stripe_events').insert({ id, type });
    if (!error) return true;
    if (error.code === '23505') return false;
    throw new Error('stripe_event_claim_failed');
  },
  async releaseEvent(id) {
    await adminClient().from('stripe_events').delete().eq('id', id);
  },
  async recordPurchase(p) {
    const { error } = await adminClient().from('billing_purchases').insert({
      stripe_session_id: p.sessionId,
      user_id: p.userId,
      kind: p.kind,
      project_id: p.projectId,
      amount_cents: p.amountCents,
      currency: p.currency.slice(0, 3),
    });
    if (!error) return true;
    if (error.code === '23505') return false;
    throw new Error('purchase_record_failed');
  },
  async addCredit(userId) {
    const { error } = await adminClient().rpc('add_project_credit', { p_user: userId });
    if (error) throw new Error('credit_failed');
  },
  async unlockProject(projectId, userId) {
    const { error } = await adminClient().rpc('apply_project_unlock', { p_project: projectId, p_user: userId });
    if (!error) return true;
    if (error.code === 'P0002' || error.code === '22P02') return false;
    throw new Error('unlock_failed');
  },
  async setCustomer(userId, customerId) {
    const admin = adminClient();
    await admin.from('billing_accounts').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    const { error } = await admin.from('billing_accounts').update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq('user_id', userId);
    if (error) throw new Error('customer_save_failed');
  },
  async userForCustomer(customerId) {
    const { data } = await adminClient().from('billing_accounts').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    return data?.user_id ?? null;
  },
  async currentSubscription(userId) {
    const { data } = await adminClient().from('billing_accounts').select('subscription_id, subscription_status').eq('user_id', userId).maybeSingle();
    return data ? { id: data.subscription_id, status: data.subscription_status } : null;
  },
  async saveSubscription(userId, s) {
    const admin = adminClient();
    await admin.from('billing_accounts').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    const { error } = await admin
      .from('billing_accounts')
      .update({
        subscription_id: s.id,
        subscription_status: s.status,
        current_period_end: s.periodEnd,
        cancel_at_period_end: s.cancelAtPeriodEnd,
        ...(s.customerId ? { stripe_customer_id: s.customerId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw new Error('subscription_save_failed');
  },
};

export const liveBillingDeps = (): BillingDeps => ({
  store: supabaseBillingStore,
  retrieveSubscription: (id) => stripe().subscriptions.retrieve(id),
});
