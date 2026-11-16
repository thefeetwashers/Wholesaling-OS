// Slice 129 — google-skip-trace Edge Function.
//
// What this function is: the in-app (Method 2) hop between a lead
// row and Google's Custom Search JSON API. The frontend never calls
// Google directly and never holds the key. The zero-cost Method 1
// path — the "Open in Google Search" link in the modal — works
// without this function and without any key.
//
// DEPLOYMENT (owner step, NOT done by this file): after the push,
//   supabase functions deploy google-skip-trace
// Until then this file is written, NOT deployed, and NOT live.
// Do not claim otherwise.
//
// BYOK PROVIDER MODEL (founder decision, Nov 16, 2026): EACH
// wholesaler brings their OWN skip-trace, email, SMS, and billing
// accounts — the platform NEVER shares one provider across
// wholesalers. The Google API key + Programmable Search Engine ID
// therefore resolve PER CALLING WHOLESALER (getGoogleKeys below,
// reading that wholesaler's own settings), never from a single
// global GOOGLE_SEARCH_API_KEY / GOOGLE_CSE_ID secret. The
// per-wholesaler settings store (wholesaler_provider_settings
// table + key encryption) is a FOLLOW-UP slice — it does not exist
// yet, no provider is chosen yet, nothing is to be set up yet.
// Until a provider is chosen and the settings store exists, this
// function returns mode 'not_configured' and writes NOTHING.
//
// VERIFICATION STATUS (checked Nov 16, 2026, against Google's own
// docs, developers.google.com/custom-search/v1):
//   VERIFIED — endpoint: GET https://customsearch.googleapis.com/customsearch/v1
//     (the reference page states this exact URL; the older
//     www.googleapis.com/customsearch/v1 base is the same API).
//   VERIFIED — required params: key (API key), cx (Programmable
//     Search Engine ID), q (query), num (1–10 results).
//   VERIFIED — response: a Search object; results in items[] with
//     title, link, snippet per item.
//   VERIFIED — pricing: 100 free queries/day, $5 per 1,000 after.
//   VERIFIED — and this is the deciding fact: the API "is not
//     available for new customers" and is discontinued January 1,
//     2027 (overview page, Nov 16, 2026). A NEW Google Custom
//     Search API key cannot be provisioned. THEREFORE the live
//     branch below is DISABLED (GOOGLE_LIVE_ENABLED = false) and
//     returns mode 'unverified' — it sends NO request and writes
//     NOTHING. Method 1 (the google.com link) is the working path;
//     do not present Method 2 as provisionable.
//
// AUTH (non-negotiable): the caller's JWT is verified on every
// invoke, and the search is allowed ONLY when the lead belongs to
// the caller OR the caller is the operator
// (thefeetwashers@gmail.com, the same operator the repo's
// public.is_operator() checks). Anyone else gets 403. The key
// resolved is the LEAD OWNER'S key (the wholesaler whose account
// pays for the lookup), not the caller's.
//
// NO FAKE DATA, EVER: there is no sandbox/test mode, no invented
// phone, email, or address. Phones/emails are extracted ONLY by
// regex from the title + snippet Google actually returned. When no
// provider is connected the function returns mode 'not_configured'
// and writes nothing; the frontend then offers the Google link and
// manual entry instead. City/state are passed only when known —
// never defaulted to "Port St. Lucie".

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPERATOR_EMAIL = "thefeetwashers@gmail.com";

// Google Custom Search JSON API — see the verification status
// above. Endpoint + params verified from Google's own reference;
// the live branch stays disabled (API closed to new customers,
// discontinued Jan 1, 2027).
const GOOGLE_CUSTOM_SEARCH_URL = "https://customsearch.googleapis.com/customsearch/v1";
const GOOGLE_LIVE_ENABLED = false;

// BYOK key lookup (founder decision, Nov 16, 2026): the Google API
// key + CSE ID resolve PER WHOLESALER, from that wholesaler's own
// settings — never from one global secret shared across offices.
// The settings store is a FOLLOW-UP slice and does not exist yet,
// so this returns null until it does. A failed read (including
// "table does not exist") is a null, not a crash — the caller then
// gets mode 'not_configured' and nothing is written. The keys
// belong to the LEAD'S owner (the wholesaler whose account pays for
// the lookup), not to whoever invoked the function.
async function getGoogleKeys(
  admin: ReturnType<typeof createClient>,
  ownerUserId: string,
): Promise<{ apiKey: string; cseId: string } | null> {
  try {
    const { data, error } = await admin
      .from("wholesaler_provider_settings")
      .select("google_api_key, google_cse_id")
      .eq("user_id", ownerUserId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { google_api_key?: unknown; google_cse_id?: unknown };
    const apiKey = typeof row.google_api_key === "string" ? row.google_api_key.trim() : "";
    const cseId = typeof row.google_cse_id === "string" ? row.google_cse_id.trim() : "";
    if (!apiKey || !cseId) return null;
    return { apiKey, cseId };
  } catch {
    return null;
  }
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// US phone numbers and email addresses, extracted ONLY from text
// Google actually returned (title + snippet). Nothing is invented.
const PHONE_REGEX = /\(?\b[2-9][0-9]{2}\)?[-.\s]?[2-9][0-9]{2}[-.\s]?[0-9]{4}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ success: false, error: "Google lookup service is not configured on this project." }, 500);
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
      kind?: unknown;
      leadId?: unknown;
      decisionMakerIndex?: unknown;
      ownerName?: unknown;
      propertyAddress?: unknown;
      cityState?: unknown;
    } | null;
    const kind = body?.kind === "lead" ? "lead" : "probate";
    const leadId = typeof body?.leadId === "string" ? body.leadId.trim() : "";
    const ownerName = typeof body?.ownerName === "string" ? body.ownerName.trim() : "";
    const propertyAddress = typeof body?.propertyAddress === "string" ? body.propertyAddress.trim() : "";
    const cityState = typeof body?.cityState === "string" ? body.cityState.trim() : "";
    if (!leadId) return json({ success: false, error: "leadId is required." }, 400);
    if (!ownerName) return json({ success: false, error: "ownerName is required." }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    // Ownership: the lead's owner, or the operator. Anyone else: 403.
    const table = kind === "lead" ? "leads" : "probate_leads";
    const ownerCol = kind === "lead" ? "owner_id" : "user_id";
    const { data: lead, error: leadError } = await admin
      .from(table)
      .select("id, " + ownerCol)
      .eq("id", leadId)
      .maybeSingle();
    if (leadError) return json({ success: false, error: leadError.message || "Could not read this lead." }, 500);
    if (!lead) return json({ success: false, error: "Lead not found." }, 404);

    let isOperator = false;
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", caller.id)
      .maybeSingle();
    if ((profile as { email?: string } | null)?.email === OPERATOR_EMAIL) isOperator = true;
    if ((lead as Record<string, unknown>)[ownerCol] !== caller.id && !isOperator) {
      return json({ success: false, error: "This lead belongs to another office." }, 403);
    }

    // BYOK: resolve the Google keys for the LEAD'S owner. No
    // global secret exists — until the founder picks providers and
    // the per-wholesaler settings store is built, this is null and
    // the function answers 'not_configured' and writes NOTHING.
    // The frontend then offers the Google link + manual entry.
    const keys = await getGoogleKeys(admin, (lead as Record<string, unknown>)[ownerCol] as string);
    if (!keys) {
      return json({
        success: false,
        mode: "not_configured",
        error: "No Google search provider connected yet — use the Open in Google Search link.",
      });
    }

    if (!GOOGLE_LIVE_ENABLED) {
      // Keys set, but the API is closed to new customers and
      // discontinued Jan 1, 2027 (see the header). Disabled on
      // purpose: send NOTHING, write NOTHING. The frontend opens
      // the Google link with this message.
      return json({
        success: false,
        mode: "unverified",
        error:
          "Google Custom Search JSON API is closed to new customers and discontinued Jan 1, 2027 — it cannot be newly provisioned. Use the Open in Google Search link instead.",
      });
    }

    // --- LIVE BRANCH (disabled above). Kept as a template so the
    // owner can see exactly what would run: the verified endpoint
    // + verified params (key, cx, q, num), GET, no body. The query
    // is the same targeted query the Method 1 link builds: the
    // formatted name + the property address (or city/state when
    // there is no address) + phone/email keywords. City/state are
    // sent ONLY when actually known — never defaulted.
    const locationPart = propertyAddress || cityState;
    const query = locationPart
      ? `"${ownerName}" "${locationPart}" (phone OR cell OR email OR "@")`
      : `"${ownerName}" (phone OR cell OR email OR "@")`;
    const endpoint =
      `${GOOGLE_CUSTOM_SEARCH_URL}?key=${encodeURIComponent(keys.apiKey)}` +
      `&cx=${encodeURIComponent(keys.cseId)}` +
      `&q=${encodeURIComponent(query)}&num=8`;
    const res = await fetch(endpoint);
    const data = (await res.json().catch(() => null)) as {
      items?: { title?: string; link?: string; snippet?: string }[];
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      return json({ success: false, error: data?.error?.message || `Google Custom Search refused the request (HTTP ${res.status}).` }, 502);
    }
    const items = Array.isArray(data?.items) ? data!.items! : [];
    const phones = new Set<string>();
    const emails = new Set<string>();
    const sources: { title: string; link: string; snippet: string }[] = [];
    for (const item of items) {
      const textBlock = `${item.title || ""} ${item.snippet || ""}`;
      for (const p of textBlock.match(PHONE_REGEX) || []) phones.add(p.trim());
      for (const e of textBlock.match(EMAIL_REGEX) || []) emails.add(e.toLowerCase().trim());
      sources.push({ title: item.title || "", link: item.link || "", snippet: item.snippet || "" });
    }
    return json({
      success: true,
      searchedName: ownerName,
      searchedLocation: locationPart,
      phones: Array.from(phones),
      emails: Array.from(emails),
      sources: sources.slice(0, 5),
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Google lookup failed." }, 500);
  }
});
