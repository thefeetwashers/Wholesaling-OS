// Slice 134 — send-invite-blast Edge Function.
//
// FILE ONLY, NOT DEPLOYED, NOT LIVE. Deploying is an OWNER step,
// never done by this file:
//   supabase functions deploy send-invite-blast
// (deployed with the default JWT verification — verify_jwt is ON.
// Do NOT deploy with --no-verify-jwt: this function sends on a
// wholesaler's own paid provider accounts and must only ever run
// for a signed-in caller.)
// Until then this file is written, NOT deployed, and NOT live.
// Do not claim otherwise, and never report a send that did not
// happen.
//
// WHAT IT IS: the same dispatcher pattern as send-buyer-blast,
// for buyer INVITES (not deal blasts): a wholesaler taps Send in
// the app and each listed buyer gets one invite message carrying
// the app's BuyerInviteLink URL. HUMAN-CLICK ONLY — it is never
// triggered by a signup, a deal insert, or any other event:
// there is no database trigger, no insert hook, and no scheduled
// job that calls it.
//
// BYOK ONLY — NO SHARED KEY. Each wholesaler brings their OWN
// SMS / email provider accounts, stored in their OWN row of
// public.wholesaler_provider_settings (Slice 134 migration
// 20261119140000 adds the SMS / email columns to the store Slice
// 137 created). The function reads the CALLER's own keys
// server-side with the service-role client and NEVER reads a
// global provider secret — no such secret exists, and no fallback
// to one is wired anywhere. No key is ever taken from a request
// param, never logged, and never returned to the caller. Keys in
// that store are plain TEXT — never claimed "encrypted" anywhere.
// There is no user_channel_integrations table and this function
// never references one.
//
// AUTH (non-negotiable): verify_jwt is ON — Supabase verifies the
// caller's JWT on every invoke, so unauthenticated callers never
// reach this code. The code additionally resolves the caller with
// supabase.auth.getUser(token) and never trusts a user_id from
// the request body (the body carries only { channel, to /
// to_number / to_numbers, inviteUrl, message? } — there is no
// user_id field to trust). Only the caller's OWN keys and OWN
// buyers are ever touched.
//
// THE INVITE URL comes from the caller in the body (the app's
// BuyerInviteLink) — it is NEVER invented here. If the caller
// supplies a message that does not already contain the URL, the
// URL is appended on its own line so the invite actually lands;
// if no message is supplied, a short default carrying the URL is
// used. The URL itself is never altered, shortened, or guessed.
//
// PROVIDER CHOICE: the caller picks their provider in My
// Providers — sms_provider ('twilio' | 'telnyx' | 'textbee' |
// 'httpsms') and email_provider ('resend' | 'sendgrid' | 'ses'),
// stored on their own settings row (Slice 134 migration
// 20261119140000). When a preference is set, THAT provider is
// used: if it is not fully keyed the function answers
// NOT_CONFIGURED and sends NOTHING — it never silently sends
// through a different provider than the one the wholesaler
// picked. When no preference is set, the first FULLY KEYED
// provider for the channel is used, in this fixed order — SMS:
// Twilio, Telnyx, TextBee, httpSMS; Email: Resend, SendGrid,
// SES. "Fully keyed" means the key column(s) AND the sender
// column(s) for that provider are all present in the caller's
// own settings row. A provider with a key but no sender is
// skipped, never sent with a guessed sender.
//
// SENDER COLUMNS (verified against migration 20261119140000 —
// these are the columns that actually exist):
//   Twilio: twilio_account_sid, twilio_auth_token,
//     twilio_from_number — ALL EXIST. Twilio can send.
//   TextBee: textbee_api_key, textbee_device_id — BOTH EXIST.
//     TextBee can send.
//   SES: ses_access_key_id, ses_secret_access_key, ses_region,
//     ses_from_email — ALL EXIST. SES can send.
//   Telnyx: telnyx_api_key, telnyx_from_number — BOTH EXIST.
//     Telnyx can send once both are saved in My Providers.
//   httpSMS: httpsms_api_key, httpsms_from_number — BOTH EXIST.
//     httpSMS can send once both are saved in My Providers.
//   Resend: resend_api_key, resend_from_email — BOTH EXIST.
//     Resend can send once both are saved in My Providers.
//   SendGrid: sendgrid_api_key, sendgrid_from_email — BOTH
//     EXIST. SendGrid can send once both are saved.
// Each provider group is selected in its own guarded query, so
// a missing column disables ONLY that provider.
//
// ENDPOINTS (exact — no other provider URL is called):
//   Resend   POST https://api.resend.com/emails
//   SendGrid POST https://api.sendgrid.com/v3/mail/send
//   Twilio   POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
//   Telnyx   POST https://api.telnyx.com/v2/messages
//   TextBee  POST https://api.textbee.dev/api/v1/gateway/send-sms
//            (header x-api-key, body { recipients: [...], message })
//   httpSMS  POST https://api.httpsms.com/v1/messages/send
//            (header x-api-key, body { content, from, to })
//   SES sends via the AWS SES SendEmail API
//     (POST https://email.{region}.amazonaws.com/, SigV4-signed
//     with the caller's ses_access_key_id / secret). The IAM
//     scope for that SES user is ses:SendEmail +
//     ses:SendRawEmail on the verified identity — NOT
//     AmazonSESFullAccess (that policy can send from any identity
//     and is never used here).
//
// SMS OPT-OUT RE-CHECK (non-negotiable, at send time): before
// any SMS is sent, the function re-reads the CALLER's own
// cash_buyers rows (phone, sms_opt_out — Slice 134 migration
// 20261119140000). Any recipient whose phone matches a row of
// THIS caller with sms_opt_out = true is SKIPPED and reported
// as skipped — never sent. Matching is on digits (last 10 for
// NANP numbers) so formatting differences cannot defeat an
// opt-out. If the opt-out lookup itself errors (column/table
// missing), the function FAILS CLOSED and sends nothing —
// an unverified opt-out list is never treated as "nobody opted
// out". Email recipients are not opt-out checked here (email
// opt-out lives on the buy box, not on cash_buyers).
//
// LOGGING: every send AND every skip is logged to
// public.sms_messages (direction 'outbound', provider, status;
// columns per migration 20261119140000: user_id, direction,
// from_number, to_number, body, provider, status — there is NO
// channel column on that table) via the service-role client —
// the browser must NOT double-log. A log insert that fails is
// written to the function log and never changes the reported
// send result: the provider's answer is the truth about whether
// a message went out, and a failed log row must never be
// reported as a failed send (or vice versa).
//
// BODY SHAPES: { channel, to: string[] | string, inviteUrl,
// message? } — `to` may also be given as `to_number` (one
// recipient) or `to_numbers` (a list), the same recipient
// shapes send-buyer-blast accepts.
//
// NO FAKE SUCCESS: a provider HTTP error is reported per
// recipient as failed with the provider's status (and message
// when the provider gives one) — never swallowed, never
// reported as sent. No provider keys exist anywhere in the app
// today, so nothing here can send live yet.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_URL = "https://api.resend.com/emails";
const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";
const TELNYX_URL = "https://api.telnyx.com/v2/messages";
const TEXTBEE_URL = "https://api.textbee.dev/api/v1/gateway/send-sms";
const HTTPSMS_URL = "https://api.httpsms.com/v1/messages/send";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function notConfigured(detail: string) {
  return json(
    {
      success: false,
      mode: "not_configured",
      error: `Sending is not set up yet — ${detail} Nothing was sent.`,
    },
    503,
  );
}

// Phone rules, same as lib/phone.ts (a Deno Edge Function cannot
// import the Next.js lib, so the rules are implemented inline
// here — do not vary them): US 10 digits, or 11 starting with 1,
// normalised to +1 E.164; international 8-15 digits to +<digits>.
// 555-01xx is the reserved fictional range and is rejected.
function normalizePhone(raw: string): { valid: boolean; e164: string | null; reason: string } {
  const input = (raw || "").trim();
  if (!input) return { valid: false, e164: null, reason: "empty" };
  const base = input.replace(/\s*(ext\.?|x)\s*\d+\s*$/i, "");
  const digits = base.replace(/\D/g, "");
  const hasPlus = base.trim().startsWith("+");
  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
      return { valid: false, e164: null, reason: "international number with an implausible length or country code" };
    }
    return { valid: true, e164: `+${digits}`, reason: "international format" };
  }
  let nanp = digits;
  if (digits.length === 11 && digits.startsWith("1")) nanp = digits.slice(1);
  if (nanp.length !== 10) {
    return { valid: false, e164: null, reason: `${digits.length} digits — a US number is 10 digits (or 11 starting with 1)` };
  }
  const area = nanp.slice(0, 3);
  const exchange = nanp.slice(3, 6);
  const line = nanp.slice(6);
  if (!/^[2-9]/.test(area)) return { valid: false, e164: null, reason: "area code cannot start with 0 or 1" };
  if (/^[2-9]11$/.test(area)) return { valid: false, e164: null, reason: `${area} is a service code (N11), not an area code` };
  if (!/^[2-9]/.test(exchange)) return { valid: false, e164: null, reason: "exchange cannot start with 0 or 1" };
  if (exchange === "555" && line >= "0100" && line <= "0199") {
    return { valid: false, e164: null, reason: "555-01xx numbers are the reserved fictional range (movies/ads)" };
  }
  return { valid: true, e164: `+1${nanp}`, reason: "US number, standard format" };
}

// Digits key for opt-out matching: NANP numbers compare on
// their last 10 digits, so "(772) 971-6129" and "+17729716129"
// are the same number. Non-NANP numbers compare on all digits.
function digitsKey(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

// One narrow select per provider group, each in its own
// try/catch: a column that does not exist yet (migration not
// applied) disables ONLY that provider — it never breaks the
// lookup for the others, and never falls back to a shared key.
async function pickCols(
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

interface CallerSettings {
  smsProviderPref: string | null;
  emailProviderPref: string | null;
  twilio: { sid: string; token: string; from: string } | null;
  telnyx: { apiKey: string; from: string } | null;
  textbee: { apiKey: string; deviceId: string | null } | null;
  httpsms: { apiKey: string; from: string } | null;
  resend: { apiKey: string; from: string } | null;
  sendgrid: { apiKey: string; from: string } | null;
  ses: { accessKeyId: string; secret: string; region: string; from: string } | null;
}

const SMS_PROVIDERS = ["twilio", "telnyx", "textbee", "httpsms"] as const;
const EMAIL_PROVIDERS = ["resend", "sendgrid", "ses"] as const;

// The provider the caller picked in My Providers wins. When a
// preference is set but that provider is not fully keyed, the
// answer is NOT_CONFIGURED — never a silent switch to another
// provider. With no preference, the first fully keyed provider
// in the fixed order is used.
function chooseProvider(
  pref: string | null,
  fullyKeyedInOrder: string[],
): string | null {
  if (pref) return fullyKeyedInOrder.includes(pref) ? pref : null;
  return fullyKeyedInOrder[0] ?? null;
}

// Why a picked provider cannot send — names the missing piece
// so the caller can fix it instead of guessing.
function providerMissingDetail(provider: string): string {
  switch (provider) {
    case "twilio":
      return "Twilio needs an account SID, auth token, and from number in My Providers.";
    case "telnyx":
      return "Telnyx needs an API key and a sender number in My Providers.";
    case "textbee":
      return "TextBee needs an API key in My Providers (a device ID is optional — it pins which phone sends).";
    case "httpsms":
      return "httpSMS needs an API key and a sender number in My Providers.";
    case "resend":
      return "Resend needs an API key and a verified sender address in My Providers.";
    case "sendgrid":
      return "SendGrid needs an API key and a verified sender address in My Providers.";
    case "ses":
      return "SES needs an access key ID, secret, region, and from email in My Providers.";
    default:
      return "That provider is not fully keyed in My Providers.";
  }
}

async function getCallerSettings(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<CallerSettings> {
  const prefs = await pickCols(admin, userId, "sms_provider, email_provider");
  const smsPref = prefs?.sms_provider && (SMS_PROVIDERS as readonly string[]).includes(prefs.sms_provider) ? prefs.sms_provider : null;
  const emailPref = prefs?.email_provider && (EMAIL_PROVIDERS as readonly string[]).includes(prefs.email_provider) ? prefs.email_provider : null;
  const twilio = await pickCols(admin, userId, "twilio_account_sid, twilio_auth_token, twilio_from_number");
  const telnyx = await pickCols(admin, userId, "telnyx_api_key, telnyx_from_number");
  const textbee = await pickCols(admin, userId, "textbee_api_key, textbee_device_id");
  const httpsms = await pickCols(admin, userId, "httpsms_api_key, httpsms_from_number");
  const resend = await pickCols(admin, userId, "resend_api_key, resend_from_email");
  const sendgrid = await pickCols(admin, userId, "sendgrid_api_key, sendgrid_from_email");
  const ses = await pickCols(admin, userId, "ses_access_key_id, ses_secret_access_key, ses_region, ses_from_email");
  return {
    smsProviderPref: smsPref,
    emailProviderPref: emailPref,
    twilio: twilio?.twilio_account_sid && twilio?.twilio_auth_token && twilio?.twilio_from_number
      ? { sid: twilio.twilio_account_sid, token: twilio.twilio_auth_token, from: twilio.twilio_from_number }
      : null,
    telnyx: telnyx?.telnyx_api_key && telnyx?.telnyx_from_number
      ? { apiKey: telnyx.telnyx_api_key, from: telnyx.telnyx_from_number }
      : null,
    textbee: textbee?.textbee_api_key
      ? { apiKey: textbee.textbee_api_key, deviceId: textbee.textbee_device_id || null }
      : null,
    httpsms: httpsms?.httpsms_api_key && httpsms?.httpsms_from_number
      ? { apiKey: httpsms.httpsms_api_key, from: httpsms.httpsms_from_number }
      : null,
    resend: resend?.resend_api_key && resend?.resend_from_email
      ? { apiKey: resend.resend_api_key, from: resend.resend_from_email }
      : null,
    sendgrid: sendgrid?.sendgrid_api_key && sendgrid?.sendgrid_from_email
      ? { apiKey: sendgrid.sendgrid_api_key, from: sendgrid.sendgrid_from_email }
      : null,
    ses: ses?.ses_access_key_id && ses?.ses_secret_access_key && ses?.ses_region && ses?.ses_from_email
      ? { accessKeyId: ses.ses_access_key_id, secret: ses.ses_secret_access_key, region: ses.ses_region, from: ses.ses_from_email }
      : null,
  };
}

// SMS opt-out re-check at send time, on the CALLER's rows only.
// Returns the set of opted-out digit keys, or { error: true }
// when the lookup itself failed — callers fail closed on error.
async function getOptedOutPhones(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ optedOut: Set<string>; error: boolean }> {
  try {
    const { data, error } = await admin
      .from("cash_buyers")
      .select("phone, sms_opt_out")
      .eq("user_id", userId);
    if (error) return { optedOut: new Set(), error: true };
    const optedOut = new Set<string>();
    for (const row of (data || []) as { phone?: unknown; sms_opt_out?: unknown }[]) {
      if (row.sms_opt_out === true && typeof row.phone === "string" && row.phone.trim()) {
        optedOut.add(digitsKey(row.phone));
      }
    }
    return { optedOut, error: false };
  } catch {
    return { optedOut: new Set(), error: true };
  }
}

// Log one outbound send/skip to public.sms_messages. The
// browser must NOT double-log. Columns are exactly the
// migration 20261119140000 set — user_id, direction, provider,
// to_number, from_number, body, status (there is NO channel
// column on sms_messages). A failed insert is written to the
// function log only — it never changes the reported result.
async function logMessage(
  admin: ReturnType<typeof createClient>,
  row: {
    user_id: string;
    provider: string;
    to_number: string;
    from_number: string | null;
    body: string;
    status: string;
  },
): Promise<void> {
  try {
    const { error } = await admin.from("sms_messages").insert({
      user_id: row.user_id,
      direction: "outbound",
      provider: row.provider,
      to_number: row.to_number,
      from_number: row.from_number,
      body: row.body,
      status: row.status,
    });
    if (error) console.log("[send-invite-blast] sms_messages insert failed — send result stands, log row lost:", error.message);
  } catch (e) {
    console.log("[send-invite-blast] sms_messages insert threw — send result stands, log row lost:", e instanceof Error ? e.message : "unknown");
  }
}

// Send one channel's recipients through one provider: SMS
// opt-out re-check first (fail closed on lookup error), then
// one provider call per recipient with per-recipient results.
// Returns a fatal error string when nothing may be sent at all
// (opt-out list unreadable) instead of results.
async function sendChannel(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  settings: CallerSettings,
  provider: string,
  channel: "sms" | "email",
  recipients: string[],
  text: string,
  subject: string,
): Promise<
  | { fatal: string }
  | { results: RecipientResult[]; sent: number; skipped: number; failed: number }
> {
  let optedOut = new Set<string>();
  if (channel === "sms") {
    const check = await getOptedOutPhones(admin, callerId);
    if (check.error) {
      return { fatal: "Could not verify SMS opt-outs, so nothing was sent — try again once the opt-out list reads cleanly." };
    }
    optedOut = check.optedOut;
  }

  const results: RecipientResult[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const fromNumber =
    provider === "twilio"
      ? (settings.twilio as NonNullable<CallerSettings["twilio"]>).from
      : provider === "telnyx"
        ? (settings.telnyx as NonNullable<CallerSettings["telnyx"]>).from
        : provider === "httpsms"
          ? (settings.httpsms as NonNullable<CallerSettings["httpsms"]>).from
          : provider === "textbee"
            ? (settings.textbee as NonNullable<CallerSettings["textbee"]>).deviceId ?? null
            : provider === "resend"
              ? (settings.resend as NonNullable<CallerSettings["resend"]>).from
              : provider === "sendgrid"
                ? (settings.sendgrid as NonNullable<CallerSettings["sendgrid"]>).from
                : (settings.ses as NonNullable<CallerSettings["ses"]>).from;

  for (const recipient of recipients) {
    if (channel === "sms") {
      const check = normalizePhone(recipient);
      if (!check.valid || !check.e164) {
        results.push({ to: recipient, status: "failed", reason: `That phone number fails the format check: ${check.reason}.` });
        failed += 1;
        await logMessage(admin, { user_id: callerId, provider, to_number: recipient, from_number: fromNumber, body: text, status: "failed" });
        continue;
      }
      const e164 = check.e164;
      if (optedOut.has(digitsKey(e164))) {
        results.push({ to: recipient, status: "skipped", reason: "This buyer opted out of texts (STOP) — skipped, never sent." });
        skipped += 1;
        await logMessage(admin, { user_id: callerId, provider, to_number: e164, from_number: fromNumber, body: text, status: "skipped" });
        continue;
      }
      const sendResult =
        provider === "twilio"
          ? await sendViaTwilio(settings.twilio as NonNullable<CallerSettings["twilio"]>, e164, text)
          : provider === "telnyx"
            ? await sendViaTelnyx(settings.telnyx as NonNullable<CallerSettings["telnyx"]>, e164, text)
            : provider === "textbee"
              ? await sendViaTextBee(settings.textbee as NonNullable<CallerSettings["textbee"]>, e164, text)
              : await sendViaHttpSms(settings.httpsms as NonNullable<CallerSettings["httpsms"]>, e164, text);
      if (sendResult.ok) {
        results.push({ to: recipient, status: "sent" });
        sent += 1;
        await logMessage(admin, { user_id: callerId, provider, to_number: e164, from_number: fromNumber, body: text, status: "sent" });
      } else {
        results.push({ to: recipient, status: "failed", reason: sendResult.error || "Send failed." });
        failed += 1;
        await logMessage(admin, { user_id: callerId, provider, to_number: e164, from_number: fromNumber, body: text, status: "failed" });
      }
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        results.push({ to: recipient, status: "failed", reason: "That is not a valid email address." });
        failed += 1;
        await logMessage(admin, { user_id: callerId, provider, to_number: recipient, from_number: fromNumber, body: text, status: "failed" });
        continue;
      }
      const sendResult =
        provider === "resend"
          ? await sendViaResend(settings.resend as NonNullable<CallerSettings["resend"]>, recipient, subject, text)
          : provider === "sendgrid"
            ? await sendViaSendGrid(settings.sendgrid as NonNullable<CallerSettings["sendgrid"]>, recipient, subject, text)
            : await sendViaSes(settings.ses as NonNullable<CallerSettings["ses"]>, recipient, subject, text);
      if (sendResult.ok) {
        results.push({ to: recipient, status: "sent" });
        sent += 1;
        await logMessage(admin, { user_id: callerId, provider, to_number: recipient, from_number: fromNumber, body: text, status: "sent" });
      } else {
        results.push({ to: recipient, status: "failed", reason: sendResult.error || "Send failed." });
        failed += 1;
        await logMessage(admin, { user_id: callerId, provider, to_number: recipient, from_number: fromNumber, body: text, status: "failed" });
      }
    }
  }
  return { results, sent, skipped, failed };
}

// Provider error text, quoted when the provider gives one;
// otherwise the HTTP status. Never invented.
async function providerErrorText(res: Response): Promise<string> {
  const detail = await res.text().catch(() => "");
  let msg = "";
  if (detail) {
    try {
      const parsed = JSON.parse(detail) as unknown;
      if (parsed && typeof parsed === "object") {
        const err = (parsed as { error?: unknown }).error;
        if (typeof err === "string" && err.trim()) msg = err.trim();
        else if (err && typeof err === "object") {
          const m = (err as { message?: unknown }).message;
          if (typeof m === "string" && m.trim()) msg = m.trim();
        }
        if (!msg) {
          const m = (parsed as { message?: unknown }).message;
          if (typeof m === "string" && m.trim()) msg = m.trim();
        }
      }
    } catch {
      msg = detail.slice(0, 200);
    }
  }
  return `The provider refused the request (HTTP ${res.status})${msg ? `: ${msg.slice(0, 200)}` : ""}.`;
}

async function sendViaTwilio(
  s: NonNullable<CallerSettings["twilio"]>,
  to: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(s.sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${s.sid}:${s.token}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: s.from, To: to, Body: body }).toString(),
      },
    );
    if (!res.ok) return { ok: false, error: await providerErrorText(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Twilio request failed." };
  }
}

async function sendViaTelnyx(
  s: NonNullable<CallerSettings["telnyx"]>,
  to: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(TELNYX_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: s.from, to, text: body }),
    });
    if (!res.ok) return { ok: false, error: await providerErrorText(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Telnyx request failed." };
  }
}

async function sendViaTextBee(
  s: NonNullable<CallerSettings["textbee"]>,
  to: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(TEXTBEE_URL, {
      method: "POST",
      headers: { "x-api-key": s.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: [to],
        message: body,
        ...(s.deviceId ? { deviceId: s.deviceId } : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: await providerErrorText(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "TextBee request failed." };
  }
}

async function sendViaHttpSms(
  s: NonNullable<CallerSettings["httpsms"]>,
  to: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(HTTPSMS_URL, {
      method: "POST",
      headers: { "x-api-key": s.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ content: body, from: s.from, to }),
    });
    if (!res.ok) return { ok: false, error: await providerErrorText(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "httpSMS request failed." };
  }
}

async function sendViaResend(
  s: NonNullable<CallerSettings["resend"]>,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: s.from, to: [to], subject, text: body }),
    });
    if (!res.ok) return { ok: false, error: await providerErrorText(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Resend request failed." };
  }
}

async function sendViaSendGrid(
  s: NonNullable<CallerSettings["sendgrid"]>,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(SENDGRID_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: s.from },
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    });
    if (!res.ok) return { ok: false, error: await providerErrorText(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SendGrid request failed." };
  }
}

// --- AWS SES SendEmail (SigV4) ---------------------------------
// The caller's ses_access_key_id / secret sign the request with
// HMAC-SHA256 (WebCrypto). No AWS SDK is imported. The IAM scope
// for the SES user is ses:SendEmail + ses:SendRawEmail on the
// verified identity — NOT AmazonSESFullAccess.

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return hex(digest);
}

async function sendViaSes(
  s: NonNullable<CallerSettings["ses"]>,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const host = `email.${s.region}.amazonaws.com`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const dateStamp = amzDate.slice(0, 8);
    const params = new URLSearchParams();
    params.set("Action", "SendEmail");
    params.set("Version", "2010-12-01");
    params.set("Source", s.from);
    params.set("Destination.ToAddresses.member.1", to);
    params.set("Message.Subject.Data", subject);
    params.set("Message.Body.Text.Data", body);
    const payload = params.toString();
    const payloadHash = await sha256Hex(payload);
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-date";
    const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${s.region}/ses/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
    const kDate = await hmacSha256(`AWS4${s.secret}`, dateStamp);
    const kRegion = await hmacSha256(kDate, s.region);
    const kService = await hmacSha256(kRegion, "ses");
    const kSigning = await hmacSha256(kService, "aws4_request");
    const signature = hex(await hmacSha256(kSigning, stringToSign));
    const res = await fetch(`https://${host}/`, {
      method: "POST",
      headers: {
        Authorization: `AWS4-HMAC-SHA256 Credential=${s.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        "X-Amz-Date": amzDate,
      },
      body: payload,
    });
    if (!res.ok) return { ok: false, error: await providerErrorText(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SES request failed." };
  }
}

type RecipientResult = { to: string; status: "sent" | "skipped" | "failed"; reason?: string };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ success: false, error: "Invite blast service is not configured on this project." }, 500);
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
      channel?: unknown;
      to?: unknown;
      to_number?: unknown;
      to_numbers?: unknown;
      inviteUrl?: unknown;
      message?: unknown;
    } | null;
    const channel = body?.channel === "email" ? "email" : body?.channel === "sms" ? "sms" : "";
    // Same recipient shapes as send-buyer-blast: `to` as one
    // string or a list, `to_number` for one recipient,
    // `to_numbers` for a list.
    const rawTo: unknown[] = [];
    if (typeof body?.to === "string") rawTo.push(body.to);
    else if (Array.isArray(body?.to)) rawTo.push(...body.to);
    if (typeof body?.to_number === "string") rawTo.push(body.to_number);
    if (Array.isArray(body?.to_numbers)) rawTo.push(...body.to_numbers);
    const toList = [...new Set(rawTo.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim()))];
    const inviteUrl = typeof body?.inviteUrl === "string" ? body.inviteUrl.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!channel) return json({ success: false, error: "channel must be 'sms' or 'email'." }, 400);
    if (toList.length === 0) return json({ success: false, error: "to must be a non-empty list of recipients." }, 400);
    if (!inviteUrl) return json({ success: false, error: "inviteUrl is required — the app's BuyerInviteLink." }, 400);

    // The message text. The invite URL is never invented here:
    // it comes from the caller. When the caller supplies a
    // message that does not already carry the URL, the URL is
    // appended on its own line so the invite actually lands.
    // With no message at all, a short default carrying the URL
    // is used. The URL itself is never altered or shortened.
    const text = message
      ? (message.includes(inviteUrl) ? message : `${message}\n\n${inviteUrl}`)
      : `You're invited to join as a cash buyer on WholesalingOS — see deals matched to your buy box here:\n\n${inviteUrl}`;
    const subject = "You're invited to join WholesalingOS as a cash buyer";

    const admin = createClient(supabaseUrl, serviceKey);

    // BYOK: resolve the CALLER's own provider keys. No global
    // secret exists — until the caller adds their own provider
    // keys in My Providers, every provider is null and the
    // function answers NOT_CONFIGURED and sends NOTHING.
    const settings = await getCallerSettings(admin, caller.id);
    const smsKeyed = [
      settings.twilio ? "twilio" : null,
      settings.telnyx ? "telnyx" : null,
      settings.textbee ? "textbee" : null,
      settings.httpsms ? "httpsms" : null,
    ].filter((x): x is string => x !== null);
    const emailKeyed = [
      settings.resend ? "resend" : null,
      settings.sendgrid ? "sendgrid" : null,
      settings.ses ? "ses" : null,
    ].filter((x): x is string => x !== null);
    const pref = channel === "sms" ? settings.smsProviderPref : settings.emailProviderPref;
    const keyed = channel === "sms" ? smsKeyed : emailKeyed;
    const provider = chooseProvider(pref, keyed);
    if (!provider) {
      if (pref) {
        return notConfigured(`You picked ${pref} for ${channel}, but it is not fully keyed — ${providerMissingDetail(pref)}`);
      }
      return notConfigured(
        channel === "sms"
          ? "No SMS provider is fully keyed for this account — Twilio, Telnyx, TextBee, or httpSMS can send once fully keyed in My Providers."
          : "No email provider is fully keyed for this account — Resend, SendGrid, or SES can send once fully keyed in My Providers.",
      );
    }

    const outcome = await sendChannel(admin, caller.id, settings, provider, channel, toList, text, subject);
    if ("fatal" in outcome) {
      return json({ success: false, error: outcome.fatal }, 503);
    }

    return json({
      success: true,
      mode: "sent",
      provider,
      channel,
      inviteUrl,
      sent: outcome.sent,
      skipped: outcome.skipped,
      failed: outcome.failed,
      results: outcome.results,
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Invite blast failed." }, 500);
  }
});
