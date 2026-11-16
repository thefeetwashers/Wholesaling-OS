// Slice 129 — stripe-billing Edge Function.
//
// What this function is: the server-side hop between a wholesaler's
// subscription row (saas_subscriptions, migration
// 20261115170000) and Stripe — create a $150/mo Checkout session
// (trial-aware) and a Billing Portal session, and accept Stripe
// webhooks that move plan_status between trialing / active /
// past_due / canceled. The browser never touches a Stripe secret.
//
// DEPLOYMENT (owner steps, NOT done by this file): after the push,
//   1. Create the $150/mo product + price in Stripe (owner step).
//   2. supabase secrets set STRIPE_SECRET_KEY=sk_... \
//        STRIPE_PRICE_ID_150_MONTHLY=price_... \
//        STRIPE_WEBHOOK_SECRET=whsec_... \
//        STRIPE_PUBLISHABLE_KEY=pk_...
//      (4 secrets — no keys exist yet; the founder is researching
//      providers and has NO Stripe account yet.)
//   3. supabase functions deploy stripe-billing --no-verify-jwt
//      (webhooks arrive without a Supabase JWT; the webhook route
//      verifies the Stripe signature instead. Authenticated routes
//      inside the function verify the caller's JWT themselves.)
//   4. Register the webhook in Stripe:
//      https://<project-ref>.supabase.co/functions/v1/stripe-billing/webhook
//      Events: checkout.session.completed,
//      customer.subscription.created / updated / deleted,
//      invoice.payment_failed.
// Until then this file is written, NOT deployed, NOT live, and
// collects NO money. Do not claim otherwise.
//
// NOT_CONFIGURED GUARD (non-negotiable): when any of
// STRIPE_SECRET_KEY / STRIPE_PRICE_ID_150_MONTHLY /
// STRIPE_WEBHOOK_SECRET is unset, every route returns
// {success:false, mode:'not_configured'} and DOES NOTHING — no
// Stripe call, no row write. The SubscriptionBanner then shows
// "Billing setup pending — the operator is setting up Stripe"
// instead of opening a dead checkout.
//
// BILLING MODEL — open question, founder to decide (Nov 16, 2026):
// the founder wrote "billing (Stripe?)" and asked whether each
// wholesaler gets their OWN Stripe account or pays the $150/mo
// platform subscription. This function implements the PLATFORM
// SUBSCRIPTION model (one Stripe account, $150/mo per wholesaler,
// the platform is the merchant of record) because that is what the
// $150/mo price and the saas_subscriptions table describe. If the
// founder decides per-wholesaler Stripe accounts instead, this
// function is the wrong shape and gets replaced — do not quietly
// rewire it.
//
// ROUTES (POST JSON, {action} in the body):
//   {action:'create_checkout'} — caller JWT verified; reads the
//     caller's saas_subscriptions row; creates/reuses a Stripe
//     customer (stripe_customer_id); trial_period_days = remaining
//     trial days on the row, 0 when expired; success/cancel URLs
//     back to https://wholesalingos.thefeetwashers.com/ (the real
//     dashboard is the site root — there is NO /dashboard route).
//     Returns {success:true, url} — the frontend redirects there.
//   {action:'customer_portal'} — caller JWT verified; creates a
//     Billing Portal session for the caller's Stripe customer;
//     return_url is the site root. Returns {success:true, url}.
//   {action:'webhook'} — POSTed by Stripe at /webhook (no JWT;
//     deploy with --no-verify-jwt). Verifies the Stripe signature
//     with STRIPE_WEBHOOK_SECRET when set; maps subscription
//     statuses onto plan_status; upserts saas_subscriptions by
//     stripe_subscription_id. A webhook with an unverifiable
//     signature is rejected (400) and changes nothing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Stripe import verified from Supabase's own knowledge base
// (supabase.com/kb, "Importing Stripe or other modules from
// esm.sh on Deno Edge Functions", updated Nov 4, 2026).
import Stripe from "https://esm.sh/stripe@11.2.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://wholesalingos.thefeetwashers.com";
const MONTHLY_RATE = 150;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function notConfigured(detail: string) {
  return json({
    success: false,
    mode: "not_configured",
    error: `Billing is not set up yet — ${detail} The operator is setting up Stripe.`,
  });
}

function mapSubscriptionStatus(status: string): string {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return "trialing";
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const url = new URL(req.url);
  const isWebhook = url.pathname.endsWith("/webhook");
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const stripePriceId = Deno.env.get("STRIPE_PRICE_ID_150_MONTHLY") ?? "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ success: false, error: "Billing service is not configured on this project." }, 500);
    }

    // Stripe is not configured (no account yet — founder is
    // researching providers). Every route answers not_configured
    // and does nothing: no Stripe call, no row write.
    if (!stripeSecret || !stripePriceId || !webhookSecret) {
      return notConfigured(
        "the Stripe account, the $150/mo price, and the webhook secret are not set yet.",
      );
    }
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });
    const admin = createClient(supabaseUrl, serviceKey);

    if (isWebhook) {
      // Stripe posts here with NO Supabase JWT (deploy with
      // --no-verify-jwt). The Stripe signature IS the auth.
      const rawBody = await req.text();
      const signature = req.headers.get("stripe-signature") || "";
      let event: Stripe.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
      } catch {
        return json({ success: false, error: "Webhook signature verification failed." }, 400);
      }
      const data = event.data.object as Record<string, unknown>;
      // The session / subscription carries the wholesaler's
      // Supabase user id in metadata (set at checkout creation),
      // so the webhook updates THAT wholesaler's row — it never
      // creates a user-less row.
      const sessionUserId =
        typeof (data as { client_reference_id?: unknown }).client_reference_id === "string"
          ? (data as { client_reference_id: string }).client_reference_id
          : null;
      if (event.type === "checkout.session.completed") {
        const subscriptionId = typeof data.subscription === "string" ? data.subscription : null;
        const customerId = typeof data.customer === "string" ? data.customer : null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const patch = {
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            plan_status: mapSubscriptionStatus(sub.status),
            trial_ends_at:
              sub.trial_end != null ? new Date(sub.trial_end * 1000).toISOString() : null,
          };
          if (sessionUserId) {
            await admin.from("saas_subscriptions").update(patch).eq("user_id", sessionUserId);
          } else {
            await admin.from("saas_subscriptions").upsert(patch, {
              onConflict: "stripe_subscription_id",
            });
          }
        }
      } else if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const sub = data as unknown as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        const metaUserId =
          sub.metadata && typeof sub.metadata.supabase_user_id === "string"
            ? sub.metadata.supabase_user_id
            : null;
        const patch = {
          stripe_subscription_id: sub.id,
          stripe_customer_id: customerId,
          plan_status: mapSubscriptionStatus(sub.status),
          trial_ends_at:
            sub.trial_end != null ? new Date(sub.trial_end * 1000).toISOString() : null,
        };
        if (metaUserId) {
          await admin.from("saas_subscriptions").update(patch).eq("user_id", metaUserId);
        } else {
          await admin.from("saas_subscriptions").upsert(patch, {
            onConflict: "stripe_subscription_id",
          });
        }
      } else if (event.type === "invoice.payment_failed") {
        const invoice = data as unknown as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subscriptionId) {
          await admin
            .from("saas_subscriptions")
            .update({ plan_status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId);
        }
      }
      return json({ success: true, received: true });
    }

    // Authenticated routes: verify the caller's JWT, then act on
    // THEIR OWN subscription row only.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ success: false, error: "Sign in required." }, 401);
    }
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authed.auth.getUser();
    const caller = userData?.user;
    if (userError || !caller) {
      return json({ success: false, error: "Sign in required." }, 401);
    }

    const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
    const action = typeof body?.action === "string" ? body.action : "";

    const { data: subRow, error: subError } = await admin
      .from("saas_subscriptions")
      .select("id, email, company_name, plan_status, trial_ends_at, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (subError) {
      return json({ success: false, error: subError.message || "Could not read your subscription." }, 500);
    }
    if (!subRow) {
      return json({ success: false, error: "No subscription row exists for this account yet." }, 404);
    }
    const row = subRow as {
      id: string;
      email: string | null;
      company_name: string | null;
      plan_status: string;
      trial_ends_at: string | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    };

    // Trial days left on the row (0 when expired) — the checkout
    // carries the remainder of the 90-day trial, not a fresh one.
    let remainingTrialDays = 0;
    if (row.trial_ends_at) {
      remainingTrialDays = Math.max(
        0,
        Math.ceil((new Date(row.trial_ends_at).getTime() - Date.now()) / 86_400_000),
      );
    }

    if (action === "create_checkout") {
      let customerId = row.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: row.email || caller.email || undefined,
          name: row.company_name || undefined,
          metadata: { supabase_user_id: caller.id },
        });
        customerId = customer.id;
        await admin
          .from("saas_subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("id", row.id);
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: caller.id,
        line_items: [{ price: stripePriceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: remainingTrialDays,
          metadata: { supabase_user_id: caller.id },
        },
        success_url: `${SITE_URL}/?billing=success`,
        cancel_url: `${SITE_URL}/?billing=cancelled`,
        metadata: { supabase_user_id: caller.id },
      });
      return json({ success: true, url: session.url, monthlyRate: MONTHLY_RATE });
    }

    if (action === "customer_portal") {
      if (!row.stripe_customer_id) {
        return json({ success: false, error: "No Stripe customer exists for this account yet — activate the plan first." }, 400);
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: row.stripe_customer_id,
        return_url: SITE_URL,
      });
      return json({ success: true, url: session.url });
    }

    return json({ success: false, error: `Unknown action "${action}".` }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Billing failed." }, 500);
  }
});
