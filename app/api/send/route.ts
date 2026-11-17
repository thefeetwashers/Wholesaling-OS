import { createClient } from '@supabase/supabase-js';
import { checkPhone } from '../../../lib/phone';
import { sha256Hex } from '../../../lib/outreach';

// Slice 136 — in-app sending, BYOK ONLY (founder decision, Nov 16, 2026).
//
// Each wholesaler sends through THEIR OWN provider accounts —
// never through one shared operator account. The per-wholesaler
// provider store (wholesaler_provider_settings, Slice 134) DOES NOT
// EXIST YET: no table, no keys, no transport. So this route FAILS
// CLOSED: GET reports both channels not connected, POST answers
// 503 "not connected", and NOTHING is ever sent.
//
// The previous version sent through ONE shared operator Twilio /
// SES / Resend account from hosting env vars. That violated BYOK
// and is REMOVED: no shared credential is read here any more, there
// is no fallback to a shared account, and no credential is invented.
// (lib/server-mail.ts still exists for lib/lead-alert.ts, a separate
// pre-existing concern — this route no longer imports it.)
//
// The gates below are kept intact on purpose — sign-in, lead
// ownership, do-not-contact, consent on file, blocklist re-check,
// phone format — so Slice 134 only has to land the store + the
// per-wholesaler transport, not rebuild the whole flow. Do NOT wire
// up real sending in this slice.
//
// Sending is HUMAN-TAP ONLY: this route sends exactly one message
// per authenticated request, for one lead, after re-checking every
// gate on the server (the client is never trusted). There is no
// batch mode, no scheduling, no drip — by design, permanently.

export const dynamic = 'force-dynamic';

type Channel = 'sms' | 'email';

// BYOK provider resolution — mirrors the skip-trace /
// google-skip-trace Edge Functions (getProviderKey): the credential
// resolves PER CALLING WHOLESALER from their own settings row,
// never from a shared env var. The store does not exist yet, so
// every lookup errors today and returns "not configured" — that is
// the honest answer, not a bug: no provider is configured for this
// caller.
//
// PROPOSED Slice 134 contract (confirm against the store migration
// when it lands — the column names below are the contract this route
// expects, not existing schema): wholesaler_provider_settings keyed
// by user_id, with twilio_account_sid / twilio_auth_token /
// twilio_from_number for texts and ses_access_key_id /
// ses_secret_access_key / resend_api_key for email. A mismatch fails
// closed (lookup error -> not configured); it never falls back to a
// shared account. Only a boolean is returned — credentials are never
// handed to the caller or logged; the Slice 134 transport resolves
// them server-side again when it sends.
async function resolveProvider(
  // Same client type serviceClient() returns (its inferred
  // SupabaseClient<any, "public", ...>); ReturnType<typeof
  // createClient> resolves to incompatible never-generics and the
  // build rejects the call sites (Slice 136 integration fix).
  sb: NonNullable<ReturnType<typeof serviceClient>>,
  userId: string,
  channel: Channel,
): Promise<{ configured: boolean }> {
  try {
    const columns =
      channel === 'sms'
        ? 'twilio_account_sid, twilio_auth_token, twilio_from_number'
        : 'ses_access_key_id, ses_secret_access_key, resend_api_key';
    const { data, error } = await sb
      .from('wholesaler_provider_settings')
      .select(columns)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return { configured: false };
    const row = data as Record<string, unknown>;
    const has = (k: string) => typeof row[k] === 'string' && (row[k] as string).trim() !== '';
    if (channel === 'sms') {
      return { configured: has('twilio_account_sid') && has('twilio_auth_token') && has('twilio_from_number') };
    }
    const sesOk = has('ses_access_key_id') && has('ses_secret_access_key');
    const resendOk = has('resend_api_key');
    return { configured: sesOk || resendOk };
  } catch {
    return { configured: false };
  }
}

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function verifyUserId(req: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !url || !anon) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } });
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string };
    return j.id || null;
  } catch { return null; }
}

const NOT_CONNECTED_REASON =
  'Sending runs on your own provider accounts — none are connected for this account yet. The provider settings store is not built yet (Slice 134).';

export async function GET(req: Request) {
  // Per-caller BYOK state: without a signed-in caller there is no
  // provider to resolve, so both channels report not connected.
  const userId = await verifyUserId(req);
  if (!userId) {
    return Response.json({ sms: false, email: false, mode: 'not_configured', reason: NOT_CONNECTED_REASON });
  }
  const sb = serviceClient();
  if (!sb) {
    return Response.json({ sms: false, email: false, mode: 'not_configured', reason: 'Sending is not configured on the server.' }, { status: 500 });
  }
  const sms = await resolveProvider(sb, userId, 'sms');
  const email = await resolveProvider(sb, userId, 'email');
  const both = sms.configured && email.configured;
  return Response.json({
    sms: sms.configured,
    email: email.configured,
    mode: both ? 'byok' : 'not_configured',
    ...(both ? {} : { reason: NOT_CONNECTED_REASON }),
  });
}

export async function POST(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return Response.json({ error: 'Sign in required.' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }

  const channel = body.channel === 'email' ? 'email' : body.channel === 'sms' ? 'sms' : '';
  const leadId = typeof body.lead_id === 'string' ? body.lead_id : '';
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1600) : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
  void subject; // Kept in the request contract for the Slice 134 transport; no send exists yet to use it.
  if (!channel || !leadId || !text) {
    return Response.json({ error: 'Channel, lead, and message are required.' }, { status: 400 });
  }

  const sb = serviceClient();
  if (!sb) return Response.json({ error: 'Sending is not configured on the server.' }, { status: 500 });

  // BYOK, fail closed: no provider configured for THIS caller means
  // no send — never a shared operator account, never a guess.
  const provider = await resolveProvider(sb, userId, channel as Channel);
  if (!provider.configured) {
    return Response.json({ error: channel === 'sms'
      ? 'Text sending is not connected for your account — connect your own Twilio account in your provider settings first.'
      : 'Email sending is not connected for your account — connect your own email provider in your provider settings first.' }, { status: 503 });
  }

  const { data: lead, error: lErr } = await sb
    .from('leads')
    .select('id, owner_id, property_address, phones, emails, consent_status, do_not_contact')
    .eq('id', leadId)
    .maybeSingle();
  if (lErr) return Response.json({ error: lErr.message }, { status: 500 });
  if (!lead || lead.owner_id !== userId) {
    return Response.json({ error: 'That lead is not in your office.' }, { status: 404 });
  }
  if (lead.do_not_contact || lead.consent_status === 'opted_out') {
    return Response.json({ error: 'This lead is marked Do Not Contact. Sending is closed.' }, { status: 403 });
  }
  if (lead.consent_status !== 'express_consent' && lead.consent_status !== 'requested_contact') {
    return Response.json({ error: 'In-app sending needs consent on file (express consent or requested contact). This lead has none recorded — record consent first, or use the tap-to-open channels.' }, { status: 403 });
  }

  const phones = (lead.phones || []) as string[];
  const emails = (lead.emails || []) as string[];
  const target = channel === 'sms' ? (phones[0] || '') : (emails[0] || '');
  if (!target) {
    return Response.json({ error: channel === 'sms' ? 'No phone number on this lead.' : 'No email address on this lead.' }, { status: 400 });
  }

  // Fail-closed blocklist re-check on the server — same hashes and
  // columns as /api/check-blocklist (address: lowercase, trimmed,
  // spaces collapsed; phone: digits only).
  const hashedAddress = await sha256Hex(String(lead.property_address || '').toLowerCase().trim().replace(/\s+/g, ' '));
  const addrHit = await sb.from('privacy_blocklist').select('id').eq('hashed_address', hashedAddress).limit(1);
  if (addrHit.error) {
    return Response.json({ error: 'The blocklist check did not complete, so nothing was sent.' }, { status: 500 });
  }
  let phoneBlocked = false;
  if (phones[0]) {
    const hashedPhone = await sha256Hex(phones[0].replace(/\D/g, ''));
    const phoneHit = await sb.from('privacy_blocklist').select('id').eq('hashed_phone', hashedPhone).limit(1);
    if (phoneHit.error) {
      return Response.json({ error: 'The blocklist check did not complete, so nothing was sent.' }, { status: 500 });
    }
    phoneBlocked = !!(phoneHit.data && phoneHit.data.length > 0);
  }
  if ((addrHit.data && addrHit.data.length > 0) || phoneBlocked) {
    return Response.json({ error: 'This contact is on the do-not-contact blocklist. Nothing was sent.' }, { status: 403 });
  }

  if (channel === 'sms') {
    const check = checkPhone(target);
    if (!check.valid || !check.e164) {
      return Response.json({ error: `That phone number fails the format check: ${check.reason}.` }, { status: 400 });
    }
  }

  // Slice 136 — NO TRANSPORT YET. Even with a provider configured
  // for this caller, there is no per-wholesaler send implementation
  // wired in this slice (Slice 134 lands the store + transport).
  // This is the terminal fail-closed answer: nothing is sent, and
  // no shared operator account is ever used as a fallback.
  return Response.json({ error: 'Sending from inside the app is not wired up yet — the per-wholesaler provider transport lands with the provider settings store (Slice 134). Until then, use the tap-to-open channels.' }, { status: 503 });
}
