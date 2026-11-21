// Slice 134 — SMS helpers (BYOK). One shared home for everything
// SMS text handling so no component invents its own escaping,
// opt-out check, or Edge Function error handling.
//
// Rules:
//   * Message bodies render as React text ({body} as children) —
//     NEVER raw HTML injection. escapeSmsText
//     exists only for the rare case a body must be placed inside
//     an HTML string; it is NEVER applied before sending (that
//     would corrupt the message) and NEVER a substitute for
//     rendering as text.
//   * The browser NEVER writes to public.sms_messages — every
//     send is logged server-side by the dispatcher. These helpers
//     only read the caller's own rows.
//   * No send is ever reported unless the dispatcher says it
//     happened. A missing (not yet deployed) function or an
//     unconnected provider is reported honestly, never as a sent
//     message.
//   * No fictional-range numbers anywhere: these helpers route
//     through lib/phone, which rejects the reserved fictional
//     range, and no example number is invented here.

import { supabase, supabaseConfigured } from './supabase';
import { checkPhone, normalizePhones } from './phone';
import { extractEdgeFunctionError } from './ai-copilot';

// Re-exported so blasters use the one phone implementation:
// checkPhone answers "could this be a real number, and what is
// its standard +1 form?" (format only — never active/owner), and
// normalizePhones validates a list, returning valid numbers in
// E.164 form and a count of invalid entries.
export { checkPhone, normalizePhones } from './phone';

// Escape a message body for the rare case it must sit inside an
// HTML string. Rendering as React text is the default path and
// needs no escaping at all.
export function escapeSmsText(body: string): string {
  return (body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// STOP keywords (CTIA): a message whose trimmed body starts with
// one of these, case-insensitive, is an opt-out. "STOP please"
// counts; "please STOP" does not.
export const STOP_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'] as const;

export function isStopKeyword(body: string): boolean {
  const text = (body || '').trim().toUpperCase();
  if (!text) return false;
  return STOP_KEYWORDS.some((k) => text.startsWith(k));
}

// Split pasted numbers (one per line, commas or newlines) into
// individual entries, dropping blanks.
export function parsePastedNumbers(text: string): string[] {
  return (text || '')
    .split(/[\n\r,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Normalize a pasted list: valid numbers come back in E.164 form,
// deduplicated in first-seen order; invalid entries are kept
// exactly as entered so the caller can report how many were
// dropped. Nothing invalid is ever sent.
export function normalizeSmsPhones(list: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const seen = new Set<string>();
  const invalid: string[] = [];
  for (const entry of list) {
    const c = checkPhone(entry);
    if (c.valid && c.e164) {
      if (!seen.has(c.e164)) {
        seen.add(c.e164);
        valid.push(c.e164);
      }
    } else {
      invalid.push(entry);
    }
  }
  return { valid, invalid };
}

// One sms_messages row — the caller's own texts, both directions.
// Columns are the Slice 134 contract (migration in parallel):
// id, user_id (owning wholesaler), direction, from_number,
// to_number, body, provider, status, created_at.
export interface SmsMessage {
  id: string;
  user_id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  body: string;
  provider: string | null;
  status: string | null;
  created_at: string;
}

// Explicit column list — never a star select on this table.
export const SMS_MESSAGE_SELECT =
  'id, user_id, direction, from_number, to_number, body, provider, status, created_at';

export async function loadMySmsMessages(userId: string, limit = 200): Promise<SmsMessage[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('sms_messages')
    .select(SMS_MESSAGE_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as SmsMessage[];
}

// The other party in a message: the sender for inbound, the
// recipient for outbound. Conversations group on this number.
export function smsCounterpart(m: SmsMessage): string {
  return m.direction === 'inbound' ? m.from_number : m.to_number;
}

// Opt-out lookup for the caller's OWN cash buyers. Returns the
// opted-out phones as a set holding both the E.164 form and the
// digits-only form, so a provider-formatted number still matches.
// optOutUnknown is true when the sms_opt_out column is not applied
// yet (Slice 134 migration pending) — callers must say so instead
// of claiming no one opted out.
export async function loadBuyerOptOutPhones(
  userId: string,
): Promise<{ optedOut: Set<string>; optOutUnknown: boolean }> {
  const empty = { optedOut: new Set<string>(), optOutUnknown: false };
  if (!supabaseConfigured || !supabase) return { ...empty, optOutUnknown: true };
  const collect = (rows: unknown[]): Set<string> => {
    const set = new Set<string>();
    for (const row of rows as { phone?: unknown; sms_opt_out?: unknown }[]) {
      if (row.sms_opt_out !== true) continue;
      const phone = typeof row.phone === 'string' ? row.phone.trim() : '';
      if (!phone) continue;
      const c = checkPhone(phone);
      if (c.valid && c.e164) set.add(c.e164);
      set.add(phone.replace(/\D/g, ''));
      set.add(phone);
    }
    return set;
  };
  const { data, error } = await supabase
    .from('cash_buyers')
    .select('phone, sms_opt_out')
    .eq('user_id', userId);
  if (error) {
    // Defensive read: before the Slice 134 migration applies, the
    // sms_opt_out column does not exist and this select errors.
    // Retry on phone alone — opt-out state is then unknown, not
    // "nobody opted out".
    if (/sms_opt_out/.test(error.message || '')) {
      const fallback = await supabase
        .from('cash_buyers')
        .select('phone')
        .eq('user_id', userId);
      if (fallback.error) throw fallback.error;
      return { optedOut: new Set<string>(), optOutUnknown: true };
    }
    throw error;
  }
  return { optedOut: collect((data || []) as unknown[]), optOutUnknown: false };
}

// True when this phone matches an opted-out buyer (E.164 or
// digits-only comparison).
export function isOptedOutPhone(phone: string, optedOut: Set<string>): boolean {
  const raw = (phone || '').trim();
  if (!raw) return false;
  const c = checkPhone(raw);
  if (c.valid && c.e164 && optedOut.has(c.e164)) return true;
  if (optedOut.has(raw.replace(/\D/g, ''))) return true;
  return optedOut.has(raw);
}

// --- send-buyer-blast Edge Function (file only, NOT deployed) ---

export const NOT_DEPLOYED_MESSAGE =
  'The send function is not deployed yet — the owner deploys it from Supabase first. Nothing was sent.';

export const NOT_CONFIGURED_MESSAGE =
  'Sending is not connected for your account — connect your own SMS provider in My Providers first. Nothing was sent.';

function isNotDeployedMessage(msg: string): boolean {
  return /not deployed|not found|failed to send|failed to fetch|fetch failed|404/i.test(msg);
}

function isNotConfiguredMessage(msg: string): boolean {
  return /not[- ]connected|not configured|no .*key|no .*provider/i.test(msg);
}

export interface BlastResult {
  // True only when the dispatcher positively reported a send (or
  // per-recipient counts). Anything else is not a send.
  ok: boolean;
  sent?: number;
  skipped?: number;
  failed?: number;
  // Human-readable honest outcome — never a fake success.
  error: string | null;
  notDeployed: boolean;
  notConfigured: boolean;
  data: unknown;
}

// One invoke of the dispatcher. The dispatcher resolves the
// from-number from the caller's own provider settings, re-checks
// opt-out at send time, and logs the send server-side — the
// browser never writes to sms_messages. Payload shapes the
// dispatcher accepts: { channel: 'sms', body } plus either
// to / to_number for one recipient, or to_numbers (and
// audience: 'my-buyers') for a broadcast to the caller's own
// buyers.
export async function invokeSendBuyerBlast(
  payload: Record<string, unknown>,
): Promise<BlastResult> {
  const fail = (error: string, notDeployed = false, notConfigured = false): BlastResult => ({
    ok: false,
    error,
    notDeployed,
    notConfigured,
    data: null,
  });
  if (!supabaseConfigured || !supabase) {
    return fail('Supabase is not configured on this deployment — nothing was sent.');
  }
  let data: unknown = null;
  try {
    const res = await supabase.functions.invoke('send-buyer-blast', { body: payload });
    data = res.data;
    if (res.error) {
      const { message } = await extractEdgeFunctionError(res.error);
      if (isNotDeployedMessage(message)) return fail(NOT_DEPLOYED_MESSAGE, true, false);
      if (isNotConfiguredMessage(message)) return fail(NOT_CONFIGURED_MESSAGE, false, true);
      return fail(`Not sent: ${message}`);
    }
  } catch {
    return fail('Not sent: the request did not complete.');
  }
  const d = (data && typeof data === 'object' ? data : {}) as {
    error?: unknown;
    ok?: unknown;
    success?: unknown;
    sent?: unknown;
    skipped?: unknown;
    failed?: unknown;
  };
  if (typeof d.error === 'string' && d.error) {
    if (isNotDeployedMessage(d.error)) return { ...fail(NOT_DEPLOYED_MESSAGE, true, false), data };
    if (isNotConfiguredMessage(d.error)) return { ...fail(NOT_CONFIGURED_MESSAGE, false, true), data };
    return { ...fail(`Not sent: ${d.error}`), data };
  }
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const sent = num(d.sent);
  const skipped = num(d.skipped);
  const failed = num(d.failed);
  const ok = d.ok === true || d.success === true || sent !== undefined;
  if (!ok) return { ...fail('Not sent: the dispatcher did not confirm a send.'), data };
  return { ok: true, sent, skipped, failed, error: null, notDeployed: false, notConfigured: false, data };
}
