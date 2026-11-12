import { Hono } from 'hono';
import { checkoutRequest } from '../../shared/schemas/billing.js';
import { projectAccess } from '../access.js';
import { type AppEnv, requireUser } from '../context.js';
import { appUrl, requireEnv } from '../env.js';
import { HttpError } from '../http.js';
import { log } from '../logger.js';
import { clientIp, LIMITS, rateLimit } from '../ratelimit.js';
import { type BillingDeps, handleStripeEvent, liveBillingDeps, stripe, verifyWebhook } from '../services/billing.js';
import { adminClient, dbError } from '../supabase.js';
import { parse, readJson } from '../validate.js';

// Mounted under /api/billing. Signed-in users start Checkout and open the Customer Portal.
export const billingRoutes = new Hono<AppEnv>();
billingRoutes.use('*', requireUser);

async function customerFor(userId: string, email: string): Promise<string> {
  const admin = adminClient();
  const { data } = await admin.from('billing_accounts').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  // The email address is sent to Stripe for receipts. The user id links payments back to Nexa.
  const customer = await stripe().customers.create({ email, metadata: { user_id: userId } }, { idempotencyKey: `customer:${userId}` });
  await admin.from('billing_accounts').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { error } = await admin.from('billing_accounts').update({ stripe_customer_id: customer.id }).eq('user_id', userId).is('stripe_customer_id', null);
  if (error) throw dbError(error);
  return customer.id;
}

billingRoutes.post('/checkout', async (c) => {
  const body = parse(checkoutRequest, await readJson(c));
  const user = c.var.user;
  await rateLimit([{ limit: LIMITS.billingUser, key: user.id }]);

  let projectPath: string | null = null;
  if (body.project_id) {
    const project = await projectAccess(c.var.db, body.project_id, user.id);
    projectPath = `/p/${project.id}/brief`;
  }
  if (body.kind === 'subscription') {
    const { data } = await c.var.db.rpc('my_entitlements');
    if (data?.[0]?.subscription_active) throw new HttpError(409, 'already_subscribed');
  }

  const price = requireEnv(body.kind === 'project' ? 'STRIPE_PRICE_PROJECT' : 'STRIPE_PRICE_SUBSCRIPTION');
  const base = appUrl();
  const metadata = { user_id: user.id, kind: body.kind, project_id: body.project_id ?? '', start_now: 'yes' };
  const session = await stripe().checkout.sessions.create({
    mode: body.kind === 'project' ? 'payment' : 'subscription',
    customer: await customerFor(user.id, user.email),
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    metadata,
    ...(body.kind === 'subscription' ? { subscription_data: { metadata: { user_id: user.id } } } : { payment_intent_data: { metadata } }),
    success_url: `${base}${projectPath ?? '/account'}?billing=success`,
    cancel_url: `${base}/pricing?billing=cancelled`,
  });
  if (!session.url) throw new HttpError(502, 'checkout_unavailable');
  log({ event: 'checkout_started', code: body.kind });
  return c.json({ url: session.url });
});

billingRoutes.post('/portal', async (c) => {
  await rateLimit([{ limit: LIMITS.billingUser, key: c.var.user.id }]);
  const { data } = await adminClient().from('billing_accounts').select('stripe_customer_id').eq('user_id', c.var.user.id).maybeSingle();
  if (!data?.stripe_customer_id) throw new HttpError(409, 'no_billing_account');
  const session = await stripe().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${appUrl()}/account` });
  return c.json({ url: session.url });
});

// Mounted at /api/stripe. Stripe calls the webhook; there is no user session.
export function stripeWebhookRoutes(deps: () => BillingDeps = liveBillingDeps) {
  const routes = new Hono<AppEnv>();
  routes.post('/webhook', async (c) => {
    await rateLimit([{ limit: LIMITS.stripeWebhookIp, key: clientIp(c) }]);
    const secret = requireEnv('STRIPE_WEBHOOK_SECRET');
    // The signature covers the exact bytes Stripe sent, so the body is read as raw text.
    const raw = await c.req.text();
    const event = verifyWebhook(raw, c.req.header('stripe-signature'), secret);
    const applied = await handleStripeEvent(event, deps());
    log({ event: applied ? 'stripe_event' : 'stripe_event_duplicate', code: event.type });
    return c.json({ received: true });
  });
  return routes;
}
