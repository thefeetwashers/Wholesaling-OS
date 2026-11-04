import { createClient } from '@supabase/supabase-js';
import { checkPhone } from '../../../lib/phone';
import { sha256Hex } from '../../../lib/outreach';

// Slice 44 — in-app sending, through the WHOLESALER'S OWN provider
// accounts, configured with server env vars (never in code, never in
// the browser):
//   Texts:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
//           (the wholesaler's Twilio account + their registered
//           A2P 10DLC number — business texting in the US requires it)
//   Email:  RESEND_API_KEY, optional SEND_FROM_EMAIL
//           (the wholesaler's Resend account; default From is the
//           verified wholesalingos.thefeetwashers.com domain)
// Until those are set, GET reports the channels as not connected and
// the Comms Center keeps its click-out channels — nothing pretends
// to send.
//
// Sending is HUMAN-TAP ONLY: this route sends exactly one message
// per authenticated request, for one lead, after re-checking every
// gate on the server (the client is never trusted):
//   * the caller is a signed-in user and the lead belongs to them;
//   * the lead is not do-not-contact / opted out;
//   * consent on file is express_consent or requested_contact —
//     in-app sending never runs on 'unknown' consent;
//   * the lead's phone/email + address are not on the platform
//     blocklist (fail-closed);
//   * a text's number passes the Slice 32 format check.
// A successful send returns the provider's message id. There is no
// batch mode, no scheduling, no drip — by design, permanently.

export const dynamic = 'force-dynamic';

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const SEND_FROM = process.env.SEND_FROM_EMAIL || 'WholesalingOS <noreply@wholesalingos.thefeetwashers.com>';

function smsConfigured() { return !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM); }
function emailConfigured() { return !!RESEND_KEY; }

export async function GET() {
  return Response.json({ sms: smsConfigured(), email: emailConfigured() });
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
  if (!channel || !leadId || !text) {
    return Response.json({ error: 'Channel, lead, and message are required.' }, { status: 400 });
  }
  if (channel === 'sms' && !smsConfigured()) {
    return Response.json({ error: 'Text sending is not connected — the Twilio keys are not in the hosting environment.' }, { status: 503 });
  }
  if (channel === 'email' && !emailConfigured()) {
    return Response.json({ error: 'Email sending is not connected — the Resend key is not in the hosting environment.' }, { status: 503 });
  }

  const sb = serviceClient();
  if (!sb) return Response.json({ error: 'Sending is not configured on the server.' }, { status: 500 });

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
    const form = new URLSearchParams({ From: TWILIO_FROM, To: check.e164, Body: text });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const j = (await r.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!r.ok) return Response.json({ error: `Twilio refused the send: ${j.message || `HTTP ${r.status}`}` }, { status: 502 });
    return Response.json({ ok: true, provider_id: j.sid || null });
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: SEND_FROM,
      to: [target],
      subject: subject || `About ${lead.property_address}`,
      text,
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!r.ok) return Response.json({ error: `Resend refused the send: ${j.message || `HTTP ${r.status}`}` }, { status: 502 });
  return Response.json({ ok: true, provider_id: j.id || null });
}
