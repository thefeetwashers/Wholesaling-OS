// Slice 141 — DEPLOY-ORDER FIX (audit #10): the authenticated
// routes below no longer select is_founder_exempt as part of the
// subscription row. The flag is read separately through
// isExemptByUserId() (the same fail-closed helper the webhook
// branches use): when the column does not exist yet the helper
// logs and returns true instead of the whole row select erroring
// and the function hard-500ing every authenticated billing call.
// Webhook branches are untouched — their fail-closed behavior is
// unchanged.
//
// Slice 140 — FOUNDER EXEMPTION: public.saas_subscriptions
// is_founder_exempt (boolean, NOT NULL DEFAULT false; migration
// 20261117190000) marks the founder's own account, which does NOT
// pay the $150/mo fee and must never be charged or status-changed
// by Stripe. (a) create_checkout refuses for an exempt caller —
// no Stripe customer or Checkout session is ever created for the
// founder. (b) The webhook branch skips plan_status writes for
// exempt rows in every event branch and logs the skip with the
// subscription id, so a future Stripe event cannot undo the
// exemption. The flag column is the only test; no operator email
// is hardcoded anywhere here. Non-exempt rows behave exactly as
// before. This file is still NOT deployed and NOT live — see the
// deployment note below.
//
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
//     statuses onto plan_status; updates the wholesaler's
//     saas_subscriptions row by user_id (client_reference_id on
//     checkout, metadata.supabase_user_id on subscription events).
//     An event with no determinable user id is logged and skipped
//     (Slice 136) — it never writes a user-less row. A webhook with
//     an unverifiable signature is rejected (400) and changes nothing.

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

// Maps a Stripe subscription status onto the saas_subscriptions
// plan_status CHECK (trialing/active/past_due/canceled). Returns
// null for any status the CHECK does not allow (unpaid,
// incomplete, incomplete_expired, paused, unknown) — callers log
// and leave plan_status untouched instead of silently relabeling
// it. Aligned with the /api/stripe/webhook route (Slice 136).
function mapSubscriptionStatus(status: string): string | null {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}

// Slice 140 — founder exemption checks. The is_founder_exempt
// flag column is the only test; no operator email is hardcoded.
// On a read error the check fails CLOSED to exempt (skip the
// write, log it): a skipped write is recoverable — Stripe retries
// webhooks and the next event corrects a normal row — while a
// write landing on the founder's row is the exact harm the
// exemption exists to prevent. `admin` is the service-role client
// passed in by the caller.
async function isExemptByUserId(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("saas_subscriptions")
    .select("is_founder_exempt")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.log("[stripe-billing webhook] is_founder_exempt read by user_id failed — failing closed to exempt, write skipped:", error.message);
    return true;
  }
  return (data as { is_founder_exempt?: unknown } | null)?.is_founder_exempt === true;
}

async function isExemptByStripeSubscriptionId(
  admin: ReturnType<typeof createClient>,
  stripeSubscriptionId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("saas_subscriptions")
    .select("is_founder_exempt")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error) {
    console.log("[stripe-billing webhook] is_founder_exempt read by stripe_subscription_id failed — failing closed to exempt, write skipped:", error.message);
    return true;
  }
  return (data as { is_founder_exempt?: unknown } | null)?.is_founder_exempt === true;
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
      // Supabase user id — client_reference_id on the Checkout
      // Session, metadata.supabase_user_id on the subscription
      // (both set at checkout creation). When NEITHER is present
      // the user cannot be determined, so the event is LOGGED and
      // SKIPPED: saas_subscriptions.user_id is NOT NULL, and no
      // write happens without a user id — a user-less row can
      // never be created. (Slice 136: the previous code upserted
      // the patch without user_id in that case, which the NOT
      // NULL constraint would reject.)
      //
      // Slice 136 label: this webhook branch is implemented but
      // NOT live-tested — there is no Stripe account, product, or
      // price ID, so no real event has ever reached it.
      const sessionUserId =
        typeof (data as { client_reference_id?: unknown }).client_reference_id === "string"
          ? (data as { client_reference_id: string }).client_reference_id
          : null;
      if (event.type === "checkout.session.completed") {
        const subscriptionId = typeof data.subscription === "string" ? data.subscription : null;
        const customerId = typeof data.customer === "string" ? data.customer : null;
        if (subscriptionId) {
          // Slice 136 — no user id, no write. The old else-branch
          // upserted this patch without user_id; user_id is NOT
          // NULL, so that write could never land — and a user-less
          // row must never exist. Log and return: Stripe treats
          // the 200 as received, so it will not retry a dead end.
          if (!sessionUserId) {
            console.log(
              "[stripe-billing webhook] checkout.session.completed with no client_reference_id — skipped, no user-less row written.",
              { subscriptionId, customerId },
            );
            return json({ success: true, received: true, skipped: "no_supabase_user_id" });
          }
          // Slice 140 — founder-exempt row: skip the patch (and
          // the Stripe retrieve it would need) and log the skip
          // with the subscription id. No write happens for this
          // subscription.
          if (await isExemptByUserId(admin, sessionUserId)) {
            console.log(
              "[stripe-billing webhook] checkout.session.completed for a founder-exempt subscription — skipped, no saas_subscriptions write.",
              { subscriptionId, customerId },
            );
            return json({ success: true, received: true, skipped: "founder_exempt" });
          }
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const mappedStatus = mapSubscriptionStatus(sub.status);
          const patch: Record<string, unknown> = {
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
          };
          if (mappedStatus !== null) {
            patch.plan_status = mappedStatus;
          } else {
            // Slice 136 — unmapped Stripe status: log and leave
            // plan_status untouched, never silently relabel it.
            console.log(
              "[stripe-billing webhook] subscription status not mapped to a plan_status — leaving it untouched.",
              { subscriptionId, status: sub.status },
            );
          }
          // trial_ends_at is NOT NULL: only set it when Stripe
          // reports a trial end — never write null into it.
          if (sub.trial_end != null) {
            patch.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
          }
          await admin.from("saas_subscriptions").update(patch).eq("user_id", sessionUserId);
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
        // Slice 136 — no user id, no write (same rule as the
        // checkout branch above): log and return, never upsert
        // without user_id.
        if (!metaUserId) {
          console.log(
            "[stripe-billing webhook] subscription event with no metadata.supabase_user_id — skipped, no user-less row written.",
            { subscriptionId: sub.id, status: sub.status },
          );
          return json({ success: true, received: true, skipped: "no_supabase_user_id" });
        }
        // Slice 140 — founder-exempt row: skip the patch and log
        // the skip with the subscription id. No write happens for
        // this subscription.
        if (await isExemptByUserId(admin, metaUserId)) {
          console.log(
            "[stripe-billing webhook] subscription event for a founder-exempt subscription — skipped, no saas_subscriptions write.",
            { subscriptionId: sub.id, status: sub.status },
          );
          return json({ success: true, received: true, skipped: "founder_exempt" });
        }
        const mappedStatus = mapSubscriptionStatus(sub.status);
        const patch: Record<string, unknown> = {
          stripe_subscription_id: sub.id,
          stripe_customer_id: customerId,
        };
        if (mappedStatus !== null) {
          patch.plan_status = mappedStatus;
        } else {
          // Slice 136 — unmapped Stripe status: log and leave
          // plan_status untouched, never silently relabel it.
          console.log(
            "[stripe-billing webhook] subscription status not mapped to a plan_status — leaving it untouched.",
            { subscriptionId: sub.id, status: sub.status },
          );
        }
        // trial_ends_at is NOT NULL: only set it when Stripe
        // reports a trial end — never write null into it.
        if (sub.trial_end != null) {
          patch.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
        }
        await admin.from("saas_subscriptions").update(patch).eq("user_id", metaUserId);
      } else if (event.type === "invoice.payment_failed") {
        // Read the subscription id off the raw event object, not the
        // typed Invoice: the installed stripe-node Invoice type has
        // no `subscription` property, and newer Stripe API versions
        // moved it to parent.subscription_details.subscription —
        // both shapes are handled (same fix as the Next.js webhook
        // route, Slice 136 integration).
        const rawInvoice = data as Record<string, unknown>;
        const parent = rawInvoice.parent as Record<string, unknown> | undefined;
        const subDetails = parent?.subscription_details as Record<string, unknown> | undefined;
        const subscriptionId =
          typeof rawInvoice.subscription === "string"
            ? rawInvoice.subscription
            : typeof subDetails?.subscription === "string"
              ? subDetails.subscription
              : null;
        if (subscriptionId) {
          // Slice 140 — founder-exempt row: skip the past_due
          // write and log the skip with the subscription id.
          if (await isExemptByStripeSubscriptionId(admin, subscriptionId)) {
            console.log(
              "[stripe-billing webhook] invoice.payment_failed for a founder-exempt subscription — skipped, no past_due write.",
              { subscriptionId },
            );
          } else {
            await admin
              .from("saas_subscriptions")
              .update({ plan_status: "past_due" })
              .eq("stripe_subscription_id", subscriptionId);
          }
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

    // Slice 141 — founder exemption flag, read through the
    // fail-closed helper (audit #10): a flag-read error (e.g.
    // the is_founder_exempt column does not exist yet) treats
    // the caller as exempt, logs, and refuses billing below —
    // it never hard-500s the authenticated routes.
    const isFounderExempt = await isExemptByUserId(admin, caller.id);

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
      // Slice 140 — founder-exempt caller: refuse BEFORE any
      // Stripe call. No Stripe customer and no Checkout session
      // are ever created for the founder; the account does not
      // pay the $150/mo fee.
      if (isFounderExempt) {
        return json(
          {
            success: false,
            error: "This account is exempt from billing — no payment is required and no checkout will be created.",
          },
          403,
        );
      }
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
      // Slice 141 (audit #8) — same founder-exempt refusal as
      // create_checkout, BEFORE any Stripe call: an exempt
      // account never opens a billing portal session.
      if (isFounderExempt) {
        return json(
          {
            success: false,
            error: "This account is exempt from billing — no payment is required and no checkout will be created.",
          },
          403,
        );
      }
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
