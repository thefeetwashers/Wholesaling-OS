// Slice 137 (part A) — ai-wholesale-copilot Edge Function.
//
// FILE ONLY, NOT DEPLOYED, NOT LIVE. Deploying is an OWNER step,
// never done by this file:
//   supabase functions deploy ai-wholesale-copilot
// Until then this file is written, NOT deployed, and NOT live.
// Do not claim otherwise, and never fake a test response.
//
// BYOK ONLY — NO SHARED KEY. Each wholesaler brings their OWN
// Gemini or Groq API key, stored in their own row of
// public.wholesaler_provider_settings (migration
// 20261117160000_slice137_provider_settings.sql). The function
// reads that caller's key server-side with the service-role
// client and NEVER reads a global GEMINI_API_KEY / GROQ_API_KEY
// secret — no such secret exists, and no fallback to one is
// wired anywhere. There is no shared operator key, no fallback,
// and no key is ever taken from a request param or logged.
//
// AUTH (non-negotiable): verify_jwt is ON — Supabase verifies the
// caller's JWT on every invoke, so unauthenticated callers never
// reach this code. The code additionally resolves the caller with
// supabase.auth.getUser(token) and never trusts a user_id from
// the request body (the body carries only { question,
// deal_context? } — there is no user_id field to trust).
//
// WHAT IT ANSWERS: an expert acquisitions Copilot for
// wholesaling — MAO = ARV x 0.70 - repairs - wholesale fee;
// seller objection handling; SMS/email pitches to cash buyers
// and Realtors; creative finance (Subject-To, Seller Finance,
// Novations) and Florida assignment contracts explained plainly.
// Concise, practical, copy-paste ready. It never invents prices,
// people, or legal advice beyond general information, and never
// asks for or repeats sensitive personal data (no SSNs, no seller
// phone numbers).
//
// PROVIDERS (per the caller's own ai_provider choice):
//   'gemini' (default) — POST
//     https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
//     with the key as ?key=, body { system_instruction,
//     contents, generationConfig { temperature 0.4,
//     maxOutputTokens 800 } }. Answer parsed from
//     data.candidates[0].content.parts[0].text — candidates and
//     parts are ARRAYS.
//   'groq' — POST https://api.groq.com/openai/v1/chat/completions
//     with Authorization: Bearer <key>, body { model
//     'llama-3.3-70b-versatile', messages [system, user],
//     temperature 0.4, max_tokens 800 }. Answer parsed from
//     data.choices[0].message.content.
//
// HONEST ERRORS, NO RETRIES: no key configured -> 400 "AI not
// connected — add your own free Gemini or Groq key in My
// Providers" (never a fake answer); a provider 429 -> 429
// "free-tier limit reached — check your quota in AI Studio /
// Groq console and try again later" (never retried in a loop);
// any other provider error is quoted verbatim in the message.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT =
  "You are an expert acquisitions Copilot for a real estate wholesaler in Florida. " +
  "Help with: MAO (maximum allowable offer) = ARV x 0.70 - repairs - wholesale fee; " +
  "seller objection handling; short SMS and email pitches to cash buyers and Realtors; " +
  "creative finance (Subject-To, Seller Finance, Novations) and Florida assignment contracts explained plainly. " +
  "Be concise, practical, and copy-paste ready. " +
  "Never invent prices, people, or legal advice beyond general information. " +
  "Never ask for or repeat sensitive personal data (no SSNs, no seller phone numbers). " +
  "If you do not know something, say so — never guess a price, a person, or a legal outcome.";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const NOT_CONNECTED_ERROR =
  "AI not connected — add your own free Gemini or Groq key in My Providers";
const RATE_LIMIT_ERROR =
  "free-tier limit reached — check your quota in AI Studio / Groq console and try again later";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// BYOK key lookup (founder decision, Nov 16, 2026): the AI key
// resolves PER CALLING WHOLESALER, from that wholesaler's own
// settings row — never from one global secret shared across
// offices. Only ai_provider plus the ONE key column that matches
// it is ever selected; the other provider's key is never read.
// A failed read (including "table does not exist") is a null,
// not a crash — the caller then gets the honest 400 below. The
// key is never logged and never leaves this function except
// inside the provider request itself.
async function getProviderSettings(
  admin: ReturnType<typeof createClient>,
  callerUserId: string,
): Promise<{ aiProvider: string; apiKey: string | null }> {
  try {
    const { data, error } = await admin
      .from("wholesaler_provider_settings")
      .select("ai_provider")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (error || !data) return { aiProvider: "gemini", apiKey: null };
    const aiProvider = (data as { ai_provider?: unknown }).ai_provider === "groq" ? "groq" : "gemini";
    const keyColumn = aiProvider === "groq" ? "groq_api_key" : "gemini_api_key";
    const { data: keyData, error: keyError } = await admin
      .from("wholesaler_provider_settings")
      .select(keyColumn)
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (keyError || !keyData) return { aiProvider, apiKey: null };
    const rawKey = (keyData as Record<string, unknown>)[keyColumn];
    const apiKey = typeof rawKey === "string" && rawKey.trim() ? rawKey.trim() : null;
    return { aiProvider, apiKey };
  } catch {
    return { aiProvider: "gemini", apiKey: null };
  }
}

// Provider error text, quoted verbatim when the provider gives
// one; otherwise the HTTP status. Never invented, never a retry.
function providerErrorText(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) return err.trim();
    if (err && typeof err === "object") {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
    }
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return `The provider refused the request (HTTP ${status}).`;
}

async function callGemini(apiKey: string, userPrompt: string): Promise<Response> {
  return await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
    }),
  });
}

async function callGroq(apiKey: string, userPrompt: string): Promise<Response> {
  return await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 800,
    }),
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
      return json({ success: false, error: "AI Copilot service is not configured on this project." }, 500);
    }

    // Caller check: verify the JWT Supabase passes on invoke.
    // The token is resolved with getUser(token) — never a
    // user_id from the request body (there is no such field).
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ success: false, error: "Sign in required." }, 401);
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return json({ success: false, error: "Sign in required." }, 401);
    }
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authed.auth.getUser(token);
    const caller = userData?.user;
    if (userError || !caller) {
      return json({ success: false, error: "Sign in required." }, 401);
    }

    const body = (await req.json().catch(() => null)) as {
      question?: unknown;
      deal_context?: unknown;
    } | null;
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      return json({ success: false, error: "question is required." }, 400);
    }
    const dealContext = typeof body?.deal_context === "string" ? body.deal_context.trim() : "";
    const userPrompt = dealContext ? `Deal context:\n${dealContext}\n\nQuestion:\n${question}` : question;

    // BYOK: resolve the AI key for THIS caller. No global secret
    // exists — until the caller adds their own free Gemini or
    // Groq key in My Providers, this is null and the function
    // answers 400 and writes NOTHING. Never a fake answer.
    const admin = createClient(supabaseUrl, serviceKey);
    const { aiProvider, apiKey } = await getProviderSettings(admin, caller.id);
    if (!apiKey) {
      return json({ success: false, error: NOT_CONNECTED_ERROR }, 400);
    }

    // One provider call, no retries. A 429 is returned as-is;
    // any other provider error is quoted verbatim.
    const res = aiProvider === "groq"
      ? await callGroq(apiKey, userPrompt)
      : await callGemini(apiKey, userPrompt);
    const data = (await res.json().catch(() => null)) as unknown;
    if (res.status === 429) {
      return json({ success: false, error: RATE_LIMIT_ERROR }, 429);
    }
    if (!res.ok) {
      const providerName = aiProvider === "groq" ? "Groq" : "Gemini";
      return json(
        { success: false, error: `${providerName}: ${providerErrorText(data, res.status)}` },
        502,
      );
    }

    // Parse the answer. candidates and parts are ARRAYS (Gemini);
    // choices is an ARRAY (Groq). An empty or missing answer is
    // a provider-side failure, reported honestly — never filled
    // in with invented text.
    let answer = "";
    if (aiProvider === "groq") {
      const choice = (data as { choices?: unknown })?.choices;
      const first = Array.isArray(choice) ? choice[0] : undefined;
      const content = (first as { message?: { content?: unknown } } | undefined)?.message?.content;
      answer = typeof content === "string" ? content.trim() : "";
    } else {
      const candidates = (data as { candidates?: unknown })?.candidates;
      const first = Array.isArray(candidates) ? candidates[0] : undefined;
      const parts = (first as { content?: { parts?: unknown } } | undefined)?.content?.parts;
      const firstPart = Array.isArray(parts) ? parts[0] : undefined;
      const text = (firstPart as { text?: unknown } | undefined)?.text;
      answer = typeof text === "string" ? text.trim() : "";
    }
    if (!answer) {
      const providerName = aiProvider === "groq" ? "Groq" : "Gemini";
      return json({ success: false, error: `${providerName} returned no answer — try again.` }, 502);
    }

    return json({ success: true, answer, provider: aiProvider });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "AI Copilot failed." }, 500);
  }
});
