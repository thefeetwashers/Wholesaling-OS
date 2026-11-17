// Slice 132 — match-and-email Edge Function.
//
// What this function is: when a deal is PUBLISHED, match it
// against PUBLISHED buy boxes whose owners opted in to email
// alerts (wholesaler_buy_boxes.email_alerts_opt_in = true), and
// email each match ONE plain-text notice via Resend. The recipient
// address comes from joining public.profiles (the account email)
// for the buy-box owner's user_id.
//
// FILE ONLY — NOT DEPLOYED, NOT LIVE, NOT_CONFIGURED. Do not claim
// otherwise. Deployment (owner steps, NOT done by this file):
//   1. Founder creates a Resend account and verifies a sending
//      domain (FOUNDER task for later — no account exists, no
//      domain is verified, and the founder is still researching
//      providers; no setup was attempted by this file).
//   2. supabase secrets set RESEND_API_KEY=re_... \
//        RESEND_FROM="WholesalingOS <deals@<verified-domain>>"
//      (RESEND_FROM must be an address on the verified domain.
//      There is NO placeholder domain anywhere in this file — a
//      placeholder sender would fail Resend verification and
//      misrepresent the sender.)
//   3. supabase functions deploy match-and-email --no-verify-jwt
//      (NOT DONE). The function verifies the caller's JWT itself
//      and only the operator may invoke it (see below).
// Until then every call answers {success:false,
// mode:'not_configured'} and sends NOTHING.
//
// NOT_CONFIGURED GUARDS (non-negotiable, checked first, in order):
//   * RESEND_API_KEY unset -> not_configured (no Resend account /
//     key exists — the founder has none).
//   * RESEND_FROM unset -> not_configured with reason 'no verified
//     sender domain' (no domain is verified yet).
//   * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY unset -> 500, not
//     configured on this project.
// No guard is ever skipped, and no email is ever attempted while
// any guard trips.
//
// HARD GATES (enforced after the config guards):
//   * Caller must be the OPERATOR: the function verifies the
//     caller's Supabase JWT itself, then calls the is_operator()
//     database function as that caller. Anyone else gets 403 and
//     nothing is sent. There is NO client-side passcode, secret,
//     or string comparison anywhere — the paste's
//     ADMIN_PASSCODE = "ChangeMe2026!" pattern is rejected: a
//     secret in client code ships in the page source for anyone
//     to read. Deal publishing stays behind Supabase Auth + RLS.
//   * Only PUBLISHED deals trigger: the deal row is read back and
//     its published flag must be true, or the call answers
//     {success:false, error:'Deal is not published.'} and sends
//     nothing. Drafts never trigger.
//   * Only OPTED-IN buyers are emailed: the query is
//     wholesaler_buy_boxes WHERE published = true AND
//     email_alerts_opt_in = true. A buyer who never opted in is
//     never emailed, full stop.
//   * The PRIVATE cash_buyers list is NEVER emailed by this
//     function. Those buyers belong to one wholesaler's sealed
//     office; their owner emails them via the mailto deal blast
//     (components/CashBuyersDealBlast.tsx). This function never
//     reads public.cash_buyers at all. (For the record, OUR
//     cash_buyers columns are name, email, target_counties,
//     max_budget, min_beds, property_types, pof_verified, notes —
//     the paste's entity_name / acquisitions_email /
//     target_states / max_price do not exist on that table and are
//     never referenced here.)
//
// MATCHING (same rules as lib/match-buy-box.ts, implemented inline
// here because a Deno Edge Function cannot import the Next.js lib
// — see that file for the pinned contract): geography = deal county
// overlaps box markets OR deal ZIP overlaps box zip_codes (both
// empty on the box = no constraint); state = box.states empty or
// deal state (uppercase 2-letter) listed; property type = box list
// empty or deal type in it; price = min null or asking >= min, max
// null or asking <= max (null asking passes); rehab tolerance =
// any/null/empty passes all, light passes Turnkey + Light rehab,
// moderate adds Moderate rehab, heavy passes all, null condition
// passes. Deal condition values are exactly 'Turnkey',
// 'Light rehab', 'Moderate rehab', 'Heavy rehab', 'Gut rehab'.
// LIMIT: this function's DealRow does not select the deal county
// (the app lib lib/match-buy-box.ts DOES carry county in
// DealSummary and matches county OR ZIP), so geography here uses
// the deal ZIP only. A box whose markets are set but zip_codes
// are empty will not match here unless the deal ZIP is also set.
//
// RESEND (verified endpoint): POST https://api.resend.com/emails
// with Authorization: Bearer <RESEND_API_KEY>. The paste's
// "https://resend.com" is the homepage — a POST there fails.
// Per-recipient failures are reported, never fatal to the batch.
//
// NO public.deals table is created or referenced anywhere here —
// published deals live in public.published_deals (another worker).
// No email or SMS provider is connected today; matching is shown
// IN THE APP ONLY until the founder wires a provider. Nothing in
// this file says matching buyers "are being emailed automatically"
// or will "receive matching deals automatically" — that message is
// false while this function is not_configured, and it stays out.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://wholesalingos.thefeetwashers.com";
const RESEND_URL = "https://api.resend.com/emails";

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
    error: `Email alerts are not set up yet — ${detail} Nothing was sent.`,
  });
}

const norm = (v: string | null | undefined): string => (v || "").trim().toLowerCase();
const normList = (xs: string[] | null | undefined): string[] =>
  (xs || []).map((x) => norm(x)).filter(Boolean);

// Rehab tolerance, same mapping as lib/match-buy-box.ts. Deal
// condition values are exactly these five — do not vary them.
const LIGHT_OK = ["turnkey", "light rehab"];
const MODERATE_OK = ["turnkey", "light rehab", "moderate rehab"];

function rehabPasses(condition: string | null, tolerance: string | null): boolean {
  if (condition == null || norm(condition) === "") return true;
  const t = norm(tolerance);
  if (t === "" || t === "any" || t === "heavy") return true;
  if (t === "light") return LIGHT_OK.includes(norm(condition));
  if (t === "moderate") return MODERATE_OK.includes(norm(condition));
  return true;
}

interface BoxRow {
  user_id: string;
  markets: string[];
  zip_codes: string[];
  states: string[];
  property_types: string[];
  min_price: number | null;
  max_price: number | null;
  rehab_tolerance: string | null;
}

interface DealRow {
  id: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  asking_price: number | null;
  condition: string | null;
  published: boolean;
}

function dealMatchesBox(deal: DealRow, box: BoxRow): boolean {
  const markets = normList(box.markets);
  const zips = normList(box.zip_codes);
  if (markets.length > 0 || zips.length > 0) {
    // County is unavailable here (see header LIMIT) — geography
    // matches on the deal ZIP only in this function.
    const zipHit = zips.length > 0 && zips.includes(norm(deal.zip));
    if (!zipHit) return false;
  }
  const states = (box.states || []).map((s) => (s || "").trim().toUpperCase()).filter(Boolean);
  if (states.length > 0) {
    const dealState = (deal.state || "").trim().toUpperCase();
    if (!dealState || !states.includes(dealState)) return false;
  }
  const types = normList(box.property_types);
  if (types.length > 0 && !types.includes(norm(deal.property_type))) return false;
  if (deal.asking_price != null) {
    if (box.min_price != null && deal.asking_price < box.min_price) return false;
    if (box.max_price != null && deal.asking_price > box.max_price) return false;
  }
  return rehabPasses(deal.condition, box.rehab_tolerance);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const resendFrom = Deno.env.get("RESEND_FROM") ?? "";

    // Config guards first: nothing below runs while any trips.
    if (!resendKey) {
      return notConfigured("no Resend API key is set — the founder has no Resend account yet.");
    }
    if (!resendFrom) {
      return notConfigured("no verified sender domain is set (RESEND_FROM is unset).");
    }
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ success: false, error: "Email service is not configured on this project." }, 500);
    }

    // Operator-only invocation: verify the caller's JWT, then ask
    // the database (as that caller) whether they are the operator.
    // No client-side passcode, no shared secret in code.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ success: false, error: "Sign in required." }, 401);
    }
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData?.user) {
      return json({ success: false, error: "Sign in required." }, 401);
    }
    const { data: isOp, error: opError } = await authed.rpc("is_operator");
    if (opError || isOp !== true) {
      return json({ success: false, error: "Only the operator may send match emails." }, 403);
    }

    const body = (await req.json().catch(() => null)) as { deal_id?: unknown } | null;
    const dealId = typeof body?.deal_id === "string" ? body.deal_id : "";
    if (!dealId) {
      return json({ success: false, error: "Pass { deal_id } for a published deal." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // HARD GATE: only published deals trigger. A draft (or a
    // missing row) sends nothing.
    const { data: dealData, error: dealError } = await admin
      .from("published_deals")
      .select("id, city, state, zip, property_type, asking_price, condition, published")
      .eq("id", dealId)
      .maybeSingle();
    if (dealError || !dealData) {
      return json({ success: false, error: "That deal was not found." }, 404);
    }
    const deal = dealData as DealRow;
    if (deal.published !== true) {
      return json({ success: false, error: "Deal is not published." }, 400);
    }

    // HARD GATE: only published buy boxes whose owners opted in.
    // The private cash_buyers list is never read here.
    const { data: boxData, error: boxError } = await admin
      .from("wholesaler_buy_boxes")
      .select("user_id, markets, zip_codes, states, property_types, min_price, max_price, rehab_tolerance")
      .eq("published", true)
      .eq("email_alerts_opt_in", true);
    if (boxError) {
      return json({ success: false, error: boxError.message || "Could not read buy boxes." }, 500);
    }
    const boxes = (boxData || []) as BoxRow[];
    const matched = boxes.filter((b) => dealMatchesBox(deal, b));
    if (matched.length === 0) {
      return json({ success: true, mode: "sent", matched: 0, emailed: 0, failed: [] });
    }

    // Recipient addresses come from profiles (account email) for
    // the matched owners — never from cash_buyers.
    const ownerIds = [...new Set(matched.map((b) => b.user_id))];
    const { data: profileData, error: profileError } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", ownerIds);
    if (profileError) {
      return json({ success: false, error: profileError.message || "Could not read buyer emails." }, 500);
    }
    const emailById = new Map<string, string>();
    ((profileData || []) as { id: string; email: string | null }[]).forEach((p) => {
      if (p.email) emailById.set(p.id, p.email);
    });

    const place = [deal.city, deal.state].filter(Boolean).join(", ") || "a property";
    const dealUrl = `${SITE_URL}/?deal=${deal.id}`;
    const subject = `New published deal matching your buy box — ${place}`;
    const text = [
      "A new deal was published on WholesalingOS and matches the buy box you published.",
      "",
      `Where: ${place}${deal.zip ? ` ${deal.zip}` : ""}`,
      deal.property_type ? `Property type: ${deal.property_type}` : "",
      deal.asking_price != null ? `Asking price: $${Number(deal.asking_price).toLocaleString()}` : "",
      deal.condition ? `Condition: ${deal.condition}` : "",
      "",
      `See it in the app: ${dealUrl}`,
      "",
      "You are receiving this because you opted in to email alerts on your buy box. Turn the opt-in off in your buy box settings to stop these emails. Matching deals are also shown in the app.",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const failed: { email: string; error: string }[] = [];
    let emailed = 0;
    for (const box of matched) {
      const to = emailById.get(box.user_id);
      if (!to) {
        failed.push({ email: box.user_id, error: "No account email on file for this buyer." });
        continue;
      }
      try {
        const res = await fetch(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: resendFrom, to: [to], subject, text }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          failed.push({ email: to, error: `Resend answered ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}` });
        } else {
          emailed += 1;
        }
      } catch (e) {
        failed.push({ email: to, error: e instanceof Error ? e.message : "Send failed." });
      }
    }
    return json({ success: true, mode: "sent", matched: matched.length, emailed, failed });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Match email failed." }, 500);
  }
});
