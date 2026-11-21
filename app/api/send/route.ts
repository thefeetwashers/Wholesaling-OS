import { createClient } from '@supabase/supabase-js';
import { checkPhone } from '../../../lib/phone';
import { sha256Hex } from '../../../lib/outreach';

// Slice 136 — in-app sending, BYOK ONLY (founder decision, Nov 16, 2026).
//
// Each wholesaler sends through THEIR OWN provider accounts —
// never through one shared operator account. The per-wholesaler
// provider store (wholesaler_provider_settings) EXISTS since Slice 137
// (migration 20261117160000, applied Nov 17, 2026) — and the SMS /
// email key columns this route selects now exist too, added by
// Slice 134 migration 20261119140000. So resolveProvider below
// reads REAL columns, and a caller who has entered keys reports
// configured. But there is still no transport: the per-wholesaler
// dispatcher Edge Functions (send-buyer-blast / send-invite-blast)
// are FILE ONLY and NOT deployed, so this route still FAILS
// CLOSED: GET reports the caller's key state honestly, POST
// answers 503 "not connected", and NOTHING is ever sent.
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
// up real sending in this slice: the dispatcher Edge Functions are
// file-only and NOT deployed, and this route must not send through
// any other path.
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
// never from a shared env var. The SMS / email key columns exist
// since Slice 134 (migration 20261119140000), so a lookup now
// reads the caller's real key state: a caller with no keys gets
// "not configured" — that is the honest answer, not a bug.
//
// Slice 134 contract (the column names below are the store
// migration's, not guesses): wholesaler_provider_settings keyed
// by user_id, with twilio_account_sid / twilio_auth_token /
// twilio_from_number, telnyx_api_key / telnyx_from_number,
// textbee_api_key, httpsms_api_key / httpsms_from_number for
// texts, and resend_api_key / resend_from_email /
// sendgrid_api_key / sendgrid_from_email / ses_access_key_id /
// ses_secret_access_key / ses_from_email for email. "Configured"
// means ANY one provider for the channel is fully keyed — a key
// WITHOUT its sender identity does not count: Twilio needs all
// three of its columns; Telnyx needs key + from number; TextBee
// needs its key; httpSMS needs key + from number; Resend and
// SendGrid need key + from email; SES needs both its key columns
// + from email. A mismatch fails closed (lookup error -> not
// configured); it never falls back to a shared account. Only a
// boolean is returned — credentials are never handed to the
// caller or logged; the Slice 134 dispatcher Edge Functions
// resolve them server-side again when they send.
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
        ? 'twilio_account_sid, twilio_auth_token, twilio_from_number, telnyx_api_key, telnyx_from_number, textbee_api_key, httpsms_api_key, httpsms_from_number'
        : 'resend_api_key, resend_from_email, sendgrid_api_key, sendgrid_from_email, ses_access_key_id, ses_secret_access_key, ses_region, ses_from_email';
    const { data, error } = await sb
      .from('wholesaler_provider_settings')
      .select(columns)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return { configured: false };
    const row = data as Record<string, unknown>;
    const has = (k: string) => typeof row[k] === 'string' && (row[k] as string).trim() !== '';
    if (channel === 'sms') {
      const twilioOk = has('twilio_account_sid') && has('twilio_auth_token') && has('twilio_from_number');
      const telnyxOk = has('telnyx_api_key') && has('telnyx_from_number');
      const textbeeOk = has('textbee_api_key');
      const httpsmsOk = has('httpsms_api_key') && has('httpsms_from_number');
      return { configured: twilioOk || telnyxOk || textbeeOk || httpsmsOk };
    }
    const sesOk = has('ses_access_key_id') && has('ses_secret_access_key') && has('ses_region') && has('ses_from_email');
    const resendOk = has('resend_api_key') && has('resend_from_email');
    const sendgridOk = has('sendgrid_api_key') && has('sendgrid_from_email');
    return { configured: sesOk || resendOk || sendgridOk };
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
  'Sending runs on your own provider accounts — none are connected for this account yet. The provider store exists (Slice 134), but the per-wholesaler transport (the dispatcher Edge Function) is file-only and NOT deployed, so nothing sends from inside the app yet.';

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

  // Slice 134 — NO TRANSPORT YET. Even with a provider configured
  // for this caller, there is no per-wholesaler send implementation
  // deployed in this slice: the dispatcher Edge Functions
  // (send-buyer-blast / send-invite-blast) are file-only and NOT
  // deployed, so nothing sends from inside the app yet. This is
  // the terminal fail-closed answer: nothing is sent, and no
  // shared operator account is ever used as a fallback. That is
  // deliberate, not a bug — deploying the dispatcher is an owner
  // step that has not happened.
  return Response.json({ error: 'Sending from inside the app is not wired up yet — the provider store exists (Slice 134), but the per-wholesaler dispatcher Edge Function is file-only and NOT deployed. Until it is deployed, use the tap-to-open channels.' }, { status: 503 });
}
