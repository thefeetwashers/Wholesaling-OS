// Slice 134 — sms-inbound Edge Function.
//
// FILE ONLY, NOT DEPLOYED, NOT LIVE. Deploying is an OWNER step,
// never done by this file:
//   supabase functions deploy sms-inbound --no-verify-jwt
// This is the ONE function where --no-verify-jwt is correct:
// Twilio / Telnyx / TextBee / httpSMS POST here with NO user
// token. Signature validation (below) is the auth instead — a
// request with no valid signature for its provider is rejected
// and stores nothing. The real webhook URL, once deployed, is:
//   https://nabztcwabkqhxyxcxarx.supabase.co/functions/v1/sms-inbound
// Register exactly that URL with each provider. Never
// https://supabase.co (that is the marketing site, not a
// function host). Until then this file is written, NOT deployed,
// and NOT live. Do not claim otherwise.
//
// WHAT IT DOES: receive one inbound SMS from Twilio, Telnyx,
// TextBee, or httpSMS; resolve the OWNING wholesaler from the
// incoming message; verify the provider's signature with THAT
// wholesaler's own key; store the message; and honour STOP
// opt-outs. NOTHING else. There is NO INTERESTED / SEND PHOTOS
// keyword routing — that is not claimed and not built here, so
// no reply is ever sent from this function and no keyword other
// than the STOP set below does anything.
//
// OWNER RESOLUTION (before any signature check, because the
// signature is verified with the OWNER's key):
//   Twilio / Telnyx — match the To number against
//     wholesaler_provider_settings.twilio_from_number (Telnyx
//     tries telnyx_from_number first — that column exists in the
//     Slice 134 store, so the Telnyx lookup matches on the
//     Telnyx number and falls through to twilio_from_number
//     only when no Telnyx number matches). Numbers
//     compare on digits (last 10 for NANP) so formatting cannot
//     defeat the match.
//   TextBee — match the deviceId in the payload against
//     textbee_device_id.
//   httpSMS — match the receiving number against
//     httpsms_from_number (then twilio_from_number as a
//     fallback), and a device lookup against httpsms_device_id
//     when the payload carries a device ID. Both columns exist
//     in the Slice 134 store.
// If no owner resolves, the function answers 404 and stores
// NOTHING — an inbound message for an unknown number/device is
// never written to another office's log.
//
// SIGNATURE VALIDATION (per provider, with the OWNING
// wholesaler's own token/key — never a shared secret):
//   Twilio — X-Twilio-Signature: HMAC-SHA1 over the full webhook
//     URL (WEBHOOK_URL below) + the POST params sorted by key,
//     key + value concatenated, with the owner's
//     twilio_auth_token; base64. Compared in constant time.
//   Telnyx — telnyx-signature-ed25519 + telnyx-signature-
//     timestamp headers: Ed25519 over
//     "<timestamp>|<raw body>" with the owner's
//     telnyx_public_key (base64, 32 bytes — the public key from
//     the Telnyx portal for the messaging profile). The timestamp
//     must be within 5 minutes of now. telnyx_public_key exists
//     in the Slice 134 store; an owner with no public key on file
//     still has every Telnyx message REJECTED — an unverifiable
//     Telnyx message is never accepted.
//   TextBee — X-Textbee-Signature in the form
//     t=<unix seconds>,v1=<signature>: HMAC-SHA256 over the raw
//     body with the owner's textbee_api_key (signature compared
//     as lowercase hex). The timestamp must be within 5 minutes
//     of now.
//   httpSMS — httpSMS sends no documented verifiable signature
//     on its webhook: this function checks for an
//     x-httpsms-signature header and, when one is present,
//     verifies it as HMAC-SHA256 over the raw body with the
//     owner's httpsms_api_key. When NO signature header is
//     present, the message is accepted ONLY because it resolved
//     to a known owner + known receiving number — and that is
//     stated plainly in the function log, never claimed as
//     signature verification. An httpSMS payload that resolves
//     to no owner is rejected (404) either way.
//
// ON A VALID MESSAGE: insert ONE row into public.sms_messages
// (direction 'inbound', provider, from/to/body, status
// 'received') via the service-role client. The insert carries
// the owning wholesaler's user_id so the row is scoped to that
// office and no other.
//
// STOP HANDLING: if the trimmed body starts with STOP,
// UNSUBSCRIBE, CANCEL, END, or QUIT (case-insensitive, first
// word), set sms_opt_out = true on the cash_buyers row(s) of
// THAT wholesaler whose phone matches the sender — scoped to
// that wholesaler's rows only, never another office's. The
// response reports whether the opt-out landed
// (opt_out_applied). Matching is on digits (last 10 for NANP).
// A STOP message is still logged as received before the opt-out
// is applied.
//
// BYOK ONLY — NO SHARED KEY. Every key used here belongs to the
// owning wholesaler's own settings row. Keys are plain TEXT —
// never claimed "encrypted" anywhere. No provider keys exist
// anywhere in the app today, so no inbound message can resolve
// an owner or verify yet.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The exact webhook URL to register with each provider. Twilio
// signs this exact URL — if the project ref ever changes, update
// this constant AND the registered URL at every provider, or
// Twilio signatures will fail.
const WEBHOOK_URL = "https://nabztcwabkqhxyxcxarx.supabase.co/functions/v1/sms-inbound";

const STOP_WORDS = ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Digits key for phone matching: NANP numbers compare on their
// last 10 digits, so "(772) 971-6129" and "+17729716129" are the
// same number. Non-NANP numbers compare on all digits.
function digitsKey(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

// Constant-time string comparison, so a signature guess leaks
// nothing through timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function hmac(key: string | ArrayBuffer, data: string, hash: "SHA-1" | "SHA-256"): Promise<ArrayBuffer> {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash }, false, ["sign"]);
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

// Decode a base64 (or hex, as a fallback) key/signature into
// bytes. Returns null when the string decodes to nothing.
function decodeKeyBytes(s: string): Uint8Array | null {
  const trimmed = (s || "").trim();
  if (!trimmed) return null;
  try {
    const bin = atob(trimmed.replace(/[\r\n\s]/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    if (out.length > 0) return out;
  } catch {
    // Not base64 — try hex below.
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    const out = new Uint8Array(trimmed.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  return null;
}

// Resolve the owning wholesaler by a receiving phone number:
// read every settings row's number column and compare on
// digits in code (stored formats vary). Each lookup is in its
// own try/catch — a column that does not exist yet resolves to
// no owner (404), never to another office.
async function findOwnerByNumber(
  admin: ReturnType<typeof createClient>,
  numberColumn: string,
  toNumber: string,
): Promise<{ userId: string; row: Record<string, string | null> } | null> {
  try {
    const { data, error } = await admin
      .from("wholesaler_provider_settings")
      .select(`user_id, ${numberColumn}`)
      .not(numberColumn, "is", null);
    if (error || !data) return null;
    const want = digitsKey(toNumber);
    if (!want) return null;
    for (const r of data as Record<string, unknown>[]) {
      const stored = r[numberColumn];
      if (typeof stored === "string" && stored.trim() && digitsKey(stored) === want) {
        return { userId: String(r.user_id), row: { [numberColumn]: stored } };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function findOwnerByDevice(
  admin: ReturnType<typeof createClient>,
  deviceColumn: string,
  deviceId: string,
): Promise<{ userId: string } | null> {
  try {
    const { data, error } = await admin
      .from("wholesaler_provider_settings")
      .select("user_id")
      .eq(deviceColumn, deviceId.trim())
      .maybeSingle();
    if (error || !data) return null;
    return { userId: String((data as { user_id: unknown }).user_id) };
  } catch {
    return null;
  }
}

// Read the owning wholesaler's key columns (narrow select, own
// row only). A missing column returns nulls — callers then fail
// closed instead of verifying with a wrong key.
async function getOwnerKeys(
  admin: ReturnType<typeof createClient>,
  userId: string,
  columns: string,
): Promise<Record<string, string | null> | null> {
  try {
    const { data, error } = await admin
      .from("wholesaler_provider_settings")
      .select(columns)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    const out: Record<string, string | null> = {};
    for (const col of columns.split(",").map((c) => c.trim())) {
      const v = row[col];
      out[col] = typeof v === "string" && v.trim() ? v.trim() : null;
    }
    return out;
  } catch {
    return null;
  }
}

// Twilio request signature: HMAC-SHA1 over the webhook URL +
// the POST params sorted by key, key + value concatenated,
// with the owner's auth token; base64. Returns the EXPECTED
// signature — the caller compares it in constant time.
async function expectedTwilioSignature(
  authToken: string,
  params: URLSearchParams,
): Promise<string> {
  const sortedKeys = [...params.keys()].sort();
  let data = WEBHOOK_URL;
  for (const k of sortedKeys) data += k + (params.get(k) ?? "");
  const sig = base64Encode(await hmac(authToken, data, "SHA-1"));
  return sig;
}

// Telnyx signature: Ed25519 over "<timestamp>|<raw body>"
// with the owner's public key. Timestamp must be within 5
// minutes. Any failure — missing key, bad format, stale
// timestamp, runtime without Ed25519 — is a rejection.
async function verifyTelnyxSignature(
  publicKey: string,
  timestamp: string,
  signature: string,
  rawBody: string,
): Promise<boolean> {
  try {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
    const pubBytes = decodeKeyBytes(publicKey);
    const sigBytes = decodeKeyBytes(signature);
    if (!pubBytes || pubBytes.length !== 32 || !sigBytes || sigBytes.length !== 64) return false;
    const key = await crypto.subtle.importKey("raw", pubBytes, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      sigBytes,
      new TextEncoder().encode(`${timestamp}|${rawBody}`),
    );
  } catch {
    return false;
  }
}

// TextBee signature header: "t=<unix seconds>,v1=<signature>".
// HMAC-SHA256 over the raw body with the owner's TextBee key,
// signature as lowercase hex. Timestamp must be within 5 min.
async function verifyTextBeeSignature(
  apiKey: string,
  header: string,
  rawBody: string,
): Promise<boolean> {
  const m = header.match(/t=(\d+)\s*,\s*v1=([0-9a-fA-F]+)/);
  if (!m) return false;
  const ts = Number(m[1]);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = hex(await hmac(apiKey, rawBody, "SHA-256"));
  return safeEqual(expected.toLowerCase(), m[2].toLowerCase());
}

// httpSMS: check for an x-httpsms-signature header and, when
// one is present, verify it as HMAC-SHA256 over the raw body
// with the owner's httpsms_api_key. Returns 'verified' when a
// header was present and valid, 'rejected' when a header was
// present and invalid, and 'none' when no signature header was
// sent at all — in that case the message is accepted ONLY
// because it resolved to a known owner + known receiving
// number, and that is logged, never claimed as verification.
async function verifyHttpSmsSignature(
  apiKey: string,
  header: string,
  rawBody: string,
): Promise<"verified" | "rejected" | "none"> {
  if (!header) return "none";
  const expected = hex(await hmac(apiKey, rawBody, "SHA-256"));
  return safeEqual(expected.toLowerCase(), header.trim().toLowerCase()) ? "verified" : "rejected";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return json({ success: false, error: "Inbound SMS service is not configured on this project." }, 500);
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    const contentType = req.headers.get("content-type") || "";

    // --- Provider detection -----------------------------------
    // Twilio posts form-encoded; the other three post JSON.
    let provider: "twilio" | "telnyx" | "textbee" | "httpsms" | null = null;
    let from = "";
    let to = "";
    let text = "";
    let deviceId = "";
    let twilioParams: URLSearchParams | null = null;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      provider = "twilio";
      twilioParams = new URLSearchParams(rawBody);
      from = twilioParams.get("From") || "";
      to = twilioParams.get("To") || "";
      text = twilioParams.get("Body") || "";
    } else {
      const payload = JSON.parse(rawBody) as unknown;
      const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
      const data = (p.data && typeof p.data === "object" ? p.data : {}) as Record<string, unknown>;
      const dataPayload = (data.payload && typeof data.payload === "object" ? data.payload : {}) as Record<string, unknown>;
      // Telnyx: { data: { event_type: "message.received",
      //   payload: { from: { phone_number }, to: [{ phone_number }],
      //   text } } }
      if (data.event_type === "message.received" || (dataPayload.from && dataPayload.to)) {
        provider = "telnyx";
        const fromObj = dataPayload.from as Record<string, unknown>;
        const toArr = Array.isArray(dataPayload.to) ? dataPayload.to : [];
        const firstTo = (toArr[0] && typeof toArr[0] === "object" ? toArr[0] : {}) as Record<string, unknown>;
        from = typeof fromObj.phone_number === "string" ? fromObj.phone_number : "";
        to = typeof firstTo.phone_number === "string" ? firstTo.phone_number : "";
        text = typeof dataPayload.text === "string" ? dataPayload.text : "";
      } else if (req.headers.get("x-textbee-signature") || p.deviceId || p.device_id) {
        // TextBee: { deviceId, sender, message } (field names
        // as the gateway posts them; sender/message fall back
        // to from/text when named that way).
        provider = "textbee";
        deviceId = typeof p.deviceId === "string" ? p.deviceId : typeof p.device_id === "string" ? p.device_id : "";
        from = typeof p.sender === "string" ? p.sender : typeof p.from === "string" ? p.from : "";
        to = typeof p.to === "string" ? p.to : typeof p.recipient === "string" ? p.recipient : "";
        text = typeof p.message === "string" ? p.message : typeof p.text === "string" ? p.text : typeof p.body === "string" ? p.body : "";
      } else if (
        p.event === "message.phone.received" || p.type === "message.phone.received" ||
        (p.data && typeof p.data === "object" && ((data as Record<string, unknown>).from || (data as Record<string, unknown>).content))
      ) {
        // httpSMS: { event: "message.phone.received",
        //   data: { from, to, content } } — field names as the
        //   gateway posts them; content falls back to message.
        provider = "httpsms";
        from = typeof data.from === "string" ? data.from : typeof p.from === "string" ? p.from : "";
        to = typeof data.to === "string" ? data.to : typeof p.to === "string" ? p.to : "";
        text = typeof data.content === "string" ? data.content : typeof data.message === "string" ? data.message : typeof p.message === "string" ? p.message : "";
        deviceId = typeof data.device_id === "string" ? data.device_id : typeof p.device_id === "string" ? p.device_id : "";
      }
    }

    if (!provider) {
      console.log("[sms-inbound] could not identify the sending provider — stored nothing.");
      return json({ success: false, error: "Could not identify the sending provider." }, 400);
    }
    if (!from || !text) {
      return json({ success: false, error: "Inbound message is missing a sender or a body." }, 400);
    }

    // --- Owner resolution (before signature checks: the
    // signature is verified with the OWNER's key) -------------
    let ownerUserId: string | null = null;
    if (provider === "twilio") {
      const found = await findOwnerByNumber(admin, "twilio_from_number", to);
      ownerUserId = found?.userId ?? null;
    } else if (provider === "telnyx") {
      const byTelnyx = await findOwnerByNumber(admin, "telnyx_from_number", to);
      const byTwilio = byTelnyx ? null : await findOwnerByNumber(admin, "twilio_from_number", to);
      ownerUserId = byTelnyx?.userId ?? byTwilio?.userId ?? null;
    } else if (provider === "textbee") {
      if (!deviceId) {
        return json({ success: false, error: "TextBee message carries no deviceId — owner cannot be resolved." }, 400);
      }
      const found = await findOwnerByDevice(admin, "textbee_device_id", deviceId);
      ownerUserId = found?.userId ?? null;
    } else {
      // httpSMS: receiving number first, then device when the
      // payload carries one.
      const byNumber = to ? await findOwnerByNumber(admin, "httpsms_from_number", to) : null;
      const byTwilio = byNumber ? null : to ? await findOwnerByNumber(admin, "twilio_from_number", to) : null;
      const byDevice = !byNumber && !byTwilio && deviceId ? await findOwnerByDevice(admin, "httpsms_device_id", deviceId) : null;
      ownerUserId = byNumber?.userId ?? byTwilio?.userId ?? byDevice?.userId ?? null;
    }
    if (!ownerUserId) {
      console.log(`[sms-inbound] no owning wholesaler resolved for ${provider} message to ${to || deviceId} — stored nothing.`);
      return json({ success: false, error: "No wholesaler owns this receiving number or device." }, 404);
    }

    // --- Signature validation with the OWNER's key ------------
    if (provider === "twilio") {
      const keys = await getOwnerKeys(admin, ownerUserId, "twilio_auth_token");
      const token = keys?.twilio_auth_token ?? null;
      const signature = req.headers.get("x-twilio-signature") || "";
      if (!token || !signature || !twilioParams) {
        return json({ success: false, error: "Twilio signature verification failed." }, 400);
      }
      const expected = await expectedTwilioSignature(token, twilioParams);
      if (!safeEqual(expected, signature)) {
        return json({ success: false, error: "Twilio signature verification failed." }, 400);
      }
    } else if (provider === "telnyx") {
      const keys = await getOwnerKeys(admin, ownerUserId, "telnyx_public_key");
      const publicKey = keys?.telnyx_public_key ?? null;
      const signature = req.headers.get("telnyx-signature-ed25519") || "";
      const timestamp = req.headers.get("telnyx-signature-timestamp") || "";
      if (!publicKey || !signature || !timestamp) {
        return json({ success: false, error: "Telnyx signature verification failed — no public key on file for this account." }, 400);
      }
      if (!(await verifyTelnyxSignature(publicKey, timestamp, signature, rawBody))) {
        return json({ success: false, error: "Telnyx signature verification failed." }, 400);
      }
    } else if (provider === "textbee") {
      const keys = await getOwnerKeys(admin, ownerUserId, "textbee_api_key");
      const apiKey = keys?.textbee_api_key ?? null;
      const signature = req.headers.get("x-textbee-signature") || "";
      if (!apiKey || !signature) {
        return json({ success: false, error: "TextBee signature verification failed." }, 400);
      }
      if (!(await verifyTextBeeSignature(apiKey, signature, rawBody))) {
        return json({ success: false, error: "TextBee signature verification failed." }, 400);
      }
    } else {
      // httpSMS — see the header: httpSMS sends no documented
      // verifiable signature. A header, when present, IS
      // verified; when absent the message is accepted ONLY on
      // known owner + known receiving number, and that is logged
      // as NOT signature-verified — never claimed otherwise.
      const keys = await getOwnerKeys(admin, ownerUserId, "httpsms_api_key");
      const apiKey = keys?.httpsms_api_key ?? null;
      const header = req.headers.get("x-httpsms-signature") || "";
      const result = apiKey ? await verifyHttpSmsSignature(apiKey, header, rawBody) : "none";
      if (result === "rejected") {
        return json({ success: false, error: "httpSMS signature verification failed." }, 400);
      }
      if (result === "none") {
        console.log("[sms-inbound] httpSMS message accepted WITHOUT signature verification (no signature header sent) — owner + receiving number resolved to a known account only.");
      }
    }

    // --- Store the inbound message ----------------------------
    // Columns are exactly the migration 20261119140000 set —
    // user_id, direction, provider, to_number, from_number,
    // body, status (there is NO channel column on sms_messages).
    const { error: insertError } = await admin.from("sms_messages").insert({
      user_id: ownerUserId,
      direction: "inbound",
      provider,
      to_number: to || deviceId,
      from_number: from,
      body: text,
      status: "received",
    });
    if (insertError) {
      console.log("[sms-inbound] sms_messages insert failed:", insertError.message);
      return json({ success: false, error: "Inbound message could not be stored." }, 500);
    }

    // --- STOP handling ----------------------------------------
    // First word of the trimmed body, case-insensitive. Scoped
    // to THIS wholesaler's cash_buyers rows only — never another
    // office's.
    const firstWord = text.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
    let optOutApplied: boolean | null = null;
    if (STOP_WORDS.includes(firstWord)) {
      optOutApplied = false;
      const senderKey = digitsKey(from);
      try {
        const { data: buyers, error: buyersError } = await admin
          .from("cash_buyers")
          .select("id, phone")
          .eq("user_id", ownerUserId);
        if (!buyersError && buyers) {
          const matchingIds = (buyers as { id: string; phone?: unknown }[])
            .filter((b) => typeof b.phone === "string" && b.phone.trim() && digitsKey(b.phone) === senderKey)
            .map((b) => b.id);
          if (matchingIds.length > 0) {
            const { error: updateError } = await admin
              .from("cash_buyers")
              .update({ sms_opt_out: true })
              .eq("user_id", ownerUserId)
              .in("id", matchingIds);
            if (!updateError) optOutApplied = true;
            else console.log("[sms-inbound] STOP opt-out update failed:", updateError.message);
          } else {
            // Sender is not one of this wholesaler's cash
            // buyers — nothing to opt out; the message is still
            // logged as received above.
            optOutApplied = false;
          }
        } else if (buyersError) {
          console.log("[sms-inbound] STOP opt-out lookup failed:", buyersError.message);
        }
      } catch (e) {
        console.log("[sms-inbound] STOP opt-out handling threw:", e instanceof Error ? e.message : "unknown");
      }
    }

    return json({
      success: true,
      received: true,
      provider,
      ...(optOutApplied !== null ? { opt_out_applied: optOutApplied } : {}),
    });
  } catch (e) {
    // A malformed body (bad JSON) lands here: nothing is stored.
    return json({ success: false, error: e instanceof Error ? e.message : "Inbound SMS failed." }, 400);
  }
});
