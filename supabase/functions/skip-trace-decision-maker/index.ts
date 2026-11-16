// Slice 127 — skip-trace-decision-maker Edge Function.
//
// What this function is: the single server-side hop between the
// Probate Leads table and a skip-trace provider. The frontend
// never calls a provider directly and never holds the key.
//
// DEPLOYMENT (owner step, NOT done by this file): after the push,
//   supabase functions deploy skip-trace-decision-maker
// Until then this file is written, NOT deployed, and NOT live.
// Do not claim otherwise.
//
// BYOK PROVIDER MODEL (founder decision, Nov 16, 2026): EACH
// wholesaler brings their OWN skip-trace, email, SMS, and billing
// accounts — the platform NEVER shares one provider across
// wholesalers, because each wholesaler manages their own
// storefront. The provider key therefore resolves PER CALLING
// WHOLESALER (getProviderKey below), never from a single global
// secret. The per-wholesaler settings store (table + key
// encryption) is a FOLLOW-UP slice — it does not exist yet, no
// provider is chosen yet, nothing is to be set up yet. Until a
// provider is chosen and the settings store exists, this function
// returns mode 'not_configured' and writes NOTHING. Do NOT wire a
// global BATCHDATA_API_KEY secret: a shared key would violate BYOK.
//
// VERIFICATION STATUS (checked Nov 16, 2026, against BatchData's
// own site, batchdata.io/skip-tracing):
//   VERIFIED — endpoint: POST https://api.batchdata.com/api/v3/property/skip-trace
//   VERIFIED — request body: { "requests": [{ "propertyAddress": { "street", "city", "state", "zip" } }] }
//   VERIFIED — auth: the BatchData API token as an Authorization: Bearer header
//   VERIFIED — semantics: one property address in, up to 3 people
//     out, each with phones (line type, carrier, DNC/TCPA flags),
//     ranked emails, and a mailing address. Billed per matched
//     record; no match costs nothing.
//   NOT VERIFIED — the exact v3 response JSON field names. The
//     official page shows only a truncated example:
//     { "result": { "data": [{ "options": { ... }, "meta": { ... } }] } }
//     The person/phone/email keys inside data[0] are not published
//     there. The v1 shape (results.persons with phones[].dnc) is
//     a different version's envelope and must not be assumed.
//   THEREFORE the live branch below is DISABLED (BATCHDATA_LIVE_ENABLED
//   = false) and returns mode 'unverified' — it sends NO request
//   and writes NOTHING. To enable it, confirm the exact v3
//   response field names at developer.batchdata.com, map them in
//   mapBatchDataPersons(), and flip the flag. Never send a guessed
//   request and never map guessed field names onto real leads.
//
// AUTH (non-negotiable): the caller's JWT is verified on every
// invoke, and the update is allowed ONLY when the lead's user_id
// equals the caller OR the caller is the operator
// (thefeetwashers@gmail.com, the same operator the repo's
// public.is_operator() checks). Anyone else gets 403. There is
// no caller check in the pasted design this replaces — that hole
// is closed here.
//
// NO FAKE DATA, EVER: there is no sandbox/test mode, no invented
// phone, email, or address. When no provider is connected the
// function returns mode 'not_configured' and writes nothing; the
// frontend then offers manual entry instead.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPERATOR_EMAIL = "thefeetwashers@gmail.com";

// BatchData skip trace — see the verification status above.
// Endpoint + request body verified from BatchData's own docs;
// the v3 response field names are NOT verified, so the live
// branch stays disabled until they are confirmed.
const BATCHDATA_SKIP_TRACE_URL = "https://api.batchdata.com/api/v3/property/skip-trace";
const BATCHDATA_LIVE_ENABLED = false;

// BYOK key lookup (founder decision, Nov 16, 2026): the provider
// key resolves PER WHOLESALER, from that wholesaler's own settings
// — never from one global secret shared across offices. The
// settings store (wholesaler_provider_settings table + key
// encryption) is a FOLLOW-UP slice and does not exist yet, so this
// returns null until it does. A failed read (including "table does
// not exist") is a null, not a crash — the caller then gets
// mode 'not_configured' and nothing is written. The key belongs to
// the LEAD'S owner (the wholesaler whose account pays for the
// lookup), not to whoever invoked the function.
async function getProviderKey(
  admin: ReturnType<typeof createClient>,
  ownerUserId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("wholesaler_provider_settings")
      .select("batchdata_api_key")
      .eq("user_id", ownerUserId)
      .maybeSingle();
    if (error || !data) return null;
    const key = (data as { batchdata_api_key?: unknown }).batchdata_api_key;
    return typeof key === "string" && key.trim() ? key.trim() : null;
  } catch {
    return null;
  }
}

interface DecisionMaker {
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  mailing_address: string | null;
  skip_trace_status: string;
  alt_phones?: string[];
  alt_emails?: string[];
  skip_traced_at?: string | null;
}

// "SCHOEPP, BARBARA SUE (1948)" -> { first: "Barbara", last: "Schoepp" }.
// Birth years are stripped; the raw name is never sent to the provider.
export function parseCourtName(name: string): { first: string; last: string } {
  const cleaned = name.replace(/\s*\(\d{4}\)\s*$/, "").trim();
  const [lastRaw = "", firstRaw = ""] = cleaned.split(",");
  const title = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  return { first: title(firstRaw), last: title(lastRaw) };
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ success: false, error: "Skip-trace service is not configured on this project." }, 500);
    }

    // Caller check: verify the JWT Supabase passes on invoke.
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

    const body = (await req.json().catch(() => null)) as {
      leadId?: unknown;
      decisionMakerIndex?: unknown;
      propertyAddress?: unknown;
      city?: unknown;
      state?: unknown;
      zip?: unknown;
    } | null;
    const leadId = typeof body?.leadId === "string" ? body.leadId.trim() : "";
    const dmIndex = typeof body?.decisionMakerIndex === "number" ? body.decisionMakerIndex : -1;
    if (!leadId) return json({ success: false, error: "leadId is required." }, 400);
    if (!Number.isInteger(dmIndex) || dmIndex < 0) {
      return json({ success: false, error: "decisionMakerIndex is required." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: lead, error: leadError } = await admin
      .from("probate_leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();
    if (leadError) return json({ success: false, error: leadError.message || "Could not read this lead." }, 500);
    if (!lead) return json({ success: false, error: "Lead not found." }, 404);

    // Ownership: the lead's owner, or the operator. Anyone else: 403.
    // (public.is_operator() cannot run here — it reads auth.uid(),
    // which the service-role client does not carry — so the same
    // operator email is checked against the caller's profile row.)
    let isOperator = false;
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", caller.id)
      .maybeSingle();
    if ((profile as { email?: string } | null)?.email === OPERATOR_EMAIL) isOperator = true;
    if (lead.user_id !== caller.id && !isOperator) {
      return json({ success: false, error: "This lead belongs to another office." }, 403);
    }

    const dms = (Array.isArray(lead.decision_makers) ? lead.decision_makers : []) as DecisionMaker[];
    const dm = dms[dmIndex];
    if (!dm) return json({ success: false, error: "That decision-maker is no longer on this lead." }, 400);

    // BYOK: resolve the provider key for the LEAD'S owner. No
    // global secret exists — until the founder picks providers and
    // the per-wholesaler settings store is built, this is null and
    // the function answers 'not_configured' and writes NOTHING.
    // The frontend then offers manual entry with this exact message.
    const apiKey = await getProviderKey(admin, lead.user_id as string);
    if (!apiKey) {
      return json({
        success: false,
        mode: "not_configured",
        error: "No skip-trace provider connected yet — enter contact details manually.",
      });
    }

    if (!BATCHDATA_LIVE_ENABLED) {
      // Key set, but the v3 response field names are unverified
      // (see the header). Disabled on purpose: write NOTHING, send
      // NOTHING. The frontend opens manual entry with this message.
      return json({
        success: false,
        mode: "unverified",
        error:
          "Skip-trace provider endpoint not verified — confirm the exact BatchData v3 response field names at developer.batchdata.com, then enable the live branch.",
      });
    }

    // --- LIVE BRANCH (disabled above until the response shape is
    // confirmed). Kept as a template so the owner can see exactly
    // what will run: the verified endpoint + verified request
    // body, Bearer auth, one property address. City/state/zip are
    // sent ONLY when actually known — never defaulted (the pasted
    // design defaulted city to "Port St. Lucie"; a decision-maker
    // may live anywhere).
    const propertyAddress = typeof body?.propertyAddress === "string" ? body.propertyAddress.trim() : "";
    if (!propertyAddress) {
      return json({ success: false, error: "This lead has no property address to skip trace yet — add it first, or enter contact details manually." }, 400);
    }
    const addressParts: Record<string, string> = { street: propertyAddress };
    for (const k of ["city", "state", "zip"] as const) {
      const v = typeof body?.[k] === "string" ? (body[k] as string).trim() : "";
      if (v) addressParts[k] = v;
    }
    const res = await fetch(BATCHDATA_SKIP_TRACE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ requests: [{ propertyAddress: addressParts }] }),
    });
    if (!res.ok) {
      return json({ success: false, error: `The skip-trace provider refused the request (HTTP ${res.status}).` }, 502);
    }
    // TODO (owner): map the verified v3 response here once the
    // field names are confirmed. Only fields the provider actually
    // returns may be written: up to 3 phones, 2 emails, mailing
    // address. Set skip_trace_status 'found' when any phone/email
    // came back, else 'not_found', stamp skip_traced_at, and move
    // outreach_status to 'Skip Traced' only when it is 'New'.
    // Until this mapping is written, the branch above returns
    // 'unverified' and this code is unreachable.
    return json({ success: false, error: "Live skip trace is not mapped yet — see the function header." }, 501);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Skip trace failed." }, 500);
  }
});
