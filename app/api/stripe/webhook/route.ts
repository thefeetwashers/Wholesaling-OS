import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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

  const setProfile = async (customerId: string, status: string) => {
    await supabase.from('profiles').update({ subscription_status: status, stripe_customer_id: customerId }).eq('stripe_customer_id', customerId);
  };
  const upsertSubscription = async (sub: Stripe.Subscription) => {
    const profile = await supabase.from('profiles').select('id').eq('stripe_customer_id', sub.customer as string).single();
    if (!profile.data) return;
    await supabase.from('subscriptions').upsert({
      profile_id: profile.data.id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      // Stripe API v23 moved current_period_end to the subscription item.
      current_period_end: (() => { const itemEnd = (sub as unknown as { items?: { data?: { current_period_end?: number }[] } }).items?.data?.[0]?.current_period_end; return itemEnd ? new Date(itemEnd * 1000).toISOString() : null; })(),
    }, { onConflict: 'stripe_subscription_id' });
  };

  try {
    if (event.type === 'checkout.session.completed') {
      const session = obj as unknown as Stripe.Checkout.Session;
      if (session.customer && typeof session.customer === 'string') {
        // Link by client_reference_id if the profile was created by email sign-up first:
        // the webhook cannot invent a profile row for a brand-new email, so
        // profiles are created by the signup trigger; this only updates a
        // profile that already has this Stripe customer ID, or by user ID
        // passed as client_reference_id when the profile row exists.
        if (session.client_reference_id) {
          await supabase.from('profiles').update({ subscription_status: 'trialing', stripe_customer_id: session.customer }).eq('id', session.client_reference_id);
        }
      }
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const sub = obj as unknown as Stripe.Subscription;
      await upsertSubscription(sub);
      if (typeof sub.customer === 'string') await setProfile(sub.customer, sub.status);
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = obj as unknown as Stripe.Subscription;
      await upsertSubscription(sub);
      if (typeof sub.customer === 'string') await setProfile(sub.customer, 'canceled');
    }
  } catch (e) {
    console.error('Stripe webhook handler failed:', e);
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
