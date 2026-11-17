import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Slice 136 — Stripe webhook, REWRITTEN to the live billing table.
//
// Writes ONLY public.saas_subscriptions (migration
// 20261115170000_saas_subscriptions.sql) plus the existing
// profiles.subscription_status / stripe_customer_id columns.
// The previous version of this route upserted into
// public.subscriptions — that table is created by NO migration in
// this repo, so those writes could never land. Nothing here writes
// to it any more.
//
// STATUS MAPPING (honest, no silent relabels): saas_subscriptions
// has CHECK (plan_status in ('trialing','active','past_due',
// 'canceled')). Stripe also sends unpaid, incomplete,
// incomplete_expired, and paused — none of those is in the CHECK,
// so writing one would fail the write, and silently relabeling one
// (e.g. unpaid -> past_due, paused -> canceled) would misstate what
// Stripe said. So an unmapped status is LOGGED and plan_status is
// left untouched, while the Stripe customer/subscription ids are
// still recorded — the next subscription event with a mappable
// status corrects the row. The one exception is
// customer.subscription.deleted -> 'canceled': the event itself
// means the subscription was deleted, so that is the event's own
// meaning, not a relabel.
//
// USER LINKING (never invent a user row): a saas_subscriptions row
// is created by the signup trigger (handle_new_wholesaler_signup)
// for every auth user, so this route only ever UPDATEs — it never
// INSERTs. The user is resolved, in order, from
//   1. subscription metadata.supabase_user_id (set at checkout
//      creation), or Checkout Session client_reference_id;
//   2. an existing saas_subscriptions row already carrying this
//      stripe_subscription_id;
//   3. a profiles row already carrying this stripe_customer_id
//      (profiles.id is the auth user id).
// If none of those resolves, the event is logged and skipped.
//
// STATUS: IMPLEMENTED, NOT LIVE-TESTED. There is NO Stripe account,
// product, or price ID — nothing here can be tested live. Do not
// claim otherwise.
//
// Stripe webhook — SERVER ONLY. This route never runs in the browser.
// Required server env (Vercel / hosting env, never NEXT_PUBLIC, never chat):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY
// The service-role key bypasses RLS, which is why the webhook (no user
// session) can update profiles/subscriptions. Never put it in the client.
// Owner steps (not done by code alone):
//   1. Stripe account under THE FEET WASHERS, INC. (for-profit), NOT NC GOD INC.
//   2. WholesalingOS Pro product: $150/mo, 90-day trial, Payment Link pasted
//      as NEXT_PUBLIC_STRIPE_PAYMENT_LINK.
//   3. Webhook endpoint in Stripe pointing at /api/stripe/webhook with the
//      events below, and its signing secret as STRIPE_WEBHOOK_SECRET.

type PlanStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

type SaasPatch = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan_status?: PlanStatus;
  trial_ends_at?: string;
};

function mapPlanStatus(status: string): PlanStatus | null {
  if (status === 'trialing' || status === 'active' || status === 'past_due' || status === 'canceled') {
    return status;
  }
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !webhookSecret || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Stripe webhook not configured on the server.' }, { status: 500 });
  }
  const stripe = new Stripe(secret);
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') || '';
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const obj = event.data.object as unknown as Record<string, unknown>;

  // profiles keeps the raw Stripe status, exactly as the previous
  // version did (no CHECK constrains profiles.subscription_status
  // in this repo). The saas_subscriptions write is the one that
  // must stay inside its four-value CHECK.
  const setProfile = async (customerId: string, status: string) => {
    await supabase.from('profiles').update({ subscription_status: status, stripe_customer_id: customerId }).eq('stripe_customer_id', customerId);
  };

  // Update-only helpers. The row is created by the signup trigger;
  // a miss means the trigger/migration has not run for this account
  // — log it, never invent the row here.
  const updateByUserId = async (userId: string, patch: SaasPatch): Promise<boolean> => {
    const { data, error } = await supabase.from('saas_subscriptions').update(patch).eq('user_id', userId).select('id').maybeSingle();
    if (error) {
      console.error('[stripe-webhook] saas_subscriptions update by user_id failed:', error.message);
      return false;
    }
    if (!data) {
      console.warn('[stripe-webhook] no saas_subscriptions row for user — signup trigger (migration 20261115170000) has not run for this account; nothing written, no row invented.', { userId });
      return false;
    }
    return true;
  };
  const updateByStripeSubscriptionId = async (stripeSubscriptionId: string, patch: SaasPatch): Promise<boolean> => {
    const { data, error } = await supabase.from('saas_subscriptions').update(patch).eq('stripe_subscription_id', stripeSubscriptionId).select('id').maybeSingle();
    if (error) {
      console.error('[stripe-webhook] saas_subscriptions update by stripe_subscription_id failed:', error.message);
      return false;
    }
    return !!data;
  };

  const resolveUserId = async (sub: Stripe.Subscription): Promise<string | null> => {
    const meta = sub.metadata?.supabase_user_id;
    if (typeof meta === 'string' && meta) return meta;
    const { data: bySub } = await supabase.from('saas_subscriptions').select('user_id').eq('stripe_subscription_id', sub.id).maybeSingle();
    if (bySub?.user_id) return bySub.user_id as string;
    if (typeof sub.customer === 'string') {
      const { data: prof } = await supabase.from('profiles').select('id').eq('stripe_customer_id', sub.customer).maybeSingle();
      if (prof?.id) return prof.id as string;
    }
    return null;
  };

  // trial_ends_at is NOT NULL: only include it when Stripe reports
  // a trial end — never write null into it.
  const trialEndPatch = (sub: Stripe.Subscription): Pick<SaasPatch, 'trial_ends_at'> =>
    sub.trial_end != null ? { trial_ends_at: new Date(sub.trial_end * 1000).toISOString() } : {};

  try {
    if (event.type === 'checkout.session.completed') {
      const session = obj as unknown as Stripe.Checkout.Session;
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      // Link by client_reference_id (the Supabase user id, set at
      // checkout creation). Fall back to a profile already carrying
      // this Stripe customer id. Without either, there is nobody to
      // link to — log and skip, never invent a user row.
      let userId = typeof session.client_reference_id === 'string' && session.client_reference_id ? session.client_reference_id : null;
      if (!userId && customerId) {
        const { data: prof } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
        if (prof?.id) userId = prof.id as string;
      }
      if (!userId) {
        console.warn('[stripe-webhook] checkout.session.completed with no client_reference_id and no matching profile — skipped, no user row invented.', { sessionId: session.id ?? null });
      } else {
        if (customerId) {
          await supabase.from('profiles').update({ subscription_status: 'trialing', stripe_customer_id: customerId }).eq('id', userId);
        }
        const patch: SaasPatch = {};
        if (customerId) patch.stripe_customer_id = customerId;
        if (typeof session.subscription === 'string') patch.stripe_subscription_id = session.subscription;
        // No plan_status here: a Checkout Session carries no
        // subscription status — customer.subscription.created,
        // which Stripe sends right after, carries it.
        if (Object.keys(patch).length > 0) await updateByUserId(userId, patch);
      }
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const sub = obj as unknown as Stripe.Subscription;
      const mapped = mapPlanStatus(sub.status);
      if (!mapped) {
        console.warn(`[stripe-webhook] subscription status "${sub.status}" is not in the saas_subscriptions CHECK — plan_status left untouched, Stripe ids still recorded.`, { subscriptionId: sub.id });
      }
      const patch: SaasPatch = { stripe_subscription_id: sub.id, ...trialEndPatch(sub) };
      if (typeof sub.customer === 'string') patch.stripe_customer_id = sub.customer;
      if (mapped) patch.plan_status = mapped;
      const userId = await resolveUserId(sub);
      if (userId) {
        await updateByUserId(userId, patch);
      } else {
        console.warn('[stripe-webhook] subscription event with no resolvable user — skipped, no row invented.', { subscriptionId: sub.id, status: sub.status });
      }
      if (typeof sub.customer === 'string') await setProfile(sub.customer, sub.status);
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = obj as unknown as Stripe.Subscription;
      const patch: SaasPatch = { stripe_subscription_id: sub.id, plan_status: 'canceled', ...trialEndPatch(sub) };
      if (typeof sub.customer === 'string') patch.stripe_customer_id = sub.customer;
      const userId = await resolveUserId(sub);
      if (userId) {
        await updateByUserId(userId, patch);
      } else {
        console.warn('[stripe-webhook] subscription.deleted with no resolvable user — skipped, no row invented.', { subscriptionId: sub.id });
      }
      if (typeof sub.customer === 'string') await setProfile(sub.customer, 'canceled');
    } else if (event.type === 'invoice.payment_failed') {
      // A failed payment means past_due on the row that already
      // carries this subscription id. Update-only: no row, no write.
      // Read the id off the raw event object, not the typed Invoice:
      // the installed stripe-node Invoice type has no `subscription`
      // property, and newer Stripe API versions moved it to
      // parent.subscription_details.subscription — both shapes are
      // handled so the marking works under either version.
      const rawInvoice = obj as Record<string, unknown>;
      const parent = rawInvoice.parent as Record<string, unknown> | undefined;
      const subDetails = parent?.subscription_details as Record<string, unknown> | undefined;
      const subscriptionId =
        typeof rawInvoice.subscription === 'string'
          ? rawInvoice.subscription
          : typeof subDetails?.subscription === 'string'
            ? subDetails.subscription
            : null;
      if (subscriptionId) {
        const written = await updateByStripeSubscriptionId(subscriptionId, { plan_status: 'past_due' });
        if (!written) {
          console.warn('[stripe-webhook] invoice.payment_failed with no matching saas_subscriptions row — skipped.', { subscriptionId });
        }
      }
    }
  } catch (e) {
    console.error('Stripe webhook handler failed:', e);
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
