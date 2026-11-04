import { createClient } from '@supabase/supabase-js';
import { checkPhone } from '../../../lib/phone';
import { alertLeadOwner } from '../../../lib/lead-alert';

// Slice 41 — seller-page voice intake completion route.
// PUBLIC and unauthenticated by design (it serves the public seller
// page), so it is deliberately narrow:
//   * it can do exactly one thing — create ONE seller lead for the
//     wholesaler whose public slug is named in the request, and only
//     when that page is enabled and the account is not suspended
//     (the same guards as the submit_seller_lead database function);
//   * a honeypot field silently refuses bots, like the form;
//   * name and property address are required; a phone, when given,
//     must pass the Slice 32 format check or the request is refused
//     with the reason (the widget re-asks before it ever gets here);
//   * completions are rate-limited per (IP, slug) in memory —
//     best-effort on a serverless runtime, stated as such;
//   * the lead lands with list_source 'Seller page voice intake' and
//     consent 'requested_contact': the visitor initiated the
//     conversation and asked to be reached, exactly like submitting
//     the form. The spoken transcript is never sent here and never
//     stored — only the collected fields.
// The AI gateway is NOT used: the intake's questions are fixed, the
// widget speaks scripted lines, and nothing here pretends otherwise.

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Per-(IP, slug) completion timestamps, pruned on each call.
const completions = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(req: Request, slug: string): boolean {
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const key = `${ip}|${slug}`;
  const now = Date.now();
  const kept = (completions.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (kept.length >= MAX_PER_WINDOW) { completions.set(key, kept); return true; }
  kept.push(now);
  completions.set(key, kept);
  return false;
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }

  // Honeypot: real visitors never see or fill this field.
  if (clean(body.website, 10) !== '') return Response.json({ ok: true });

  const slug = clean(body.slug, 120).toLowerCase();
  const ownerName = clean(body.owner_name, 200);
  const address = clean(body.property_address, 300);
  if (!slug || !ownerName || !address) {
    return Response.json({ error: 'Name, property address, and page are required.' }, { status: 400 });
  }
  if (rateLimited(req, slug)) {
    return Response.json({ error: 'Too many submissions from this connection — please use the form below instead.' }, { status: 429 });
  }

  const rawPhone = clean(body.phone, 50);
  let phone: string | null = null;
  if (rawPhone) {
    const check = checkPhone(rawPhone);
    if (!check.valid || !check.e164) {
      return Response.json({ error: `That phone number could not be accepted: ${check.reason}.` }, { status: 400 });
    }
    phone = check.e164;
  }

  const sb = serviceClient();
  if (!sb) return Response.json({ error: 'Intake is not configured on the server.' }, { status: 500 });

  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('id')
    .eq('public_slug', slug)
    .eq('seller_page_enabled', true)
    .eq('admin_suspended', false)
    .maybeSingle();
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 });
  if (!profile) return Response.json({ error: 'This seller page is not available.' }, { status: 404 });

  const callerType = clean(body.caller_type, 20);
  const price = clean(body.asking_price, 60);
  const extra = clean(body.notes, 1000);
  const bits: string[] = [`Via seller page voice intake ${new Date().toISOString().slice(0, 10)}.`];
  if (callerType === 'buyer') bits.push(price ? `Caller is a BUYER. Budget: ${price}.` : 'Caller is a BUYER.');
  else if (callerType === 'seller') bits.push(price ? `Caller is the seller. Asking price: ${price}.` : 'Caller is the seller.');
  else if (price) bits.push(`Asking price / budget: ${price}.`);
  if (extra) bits.push(extra);

  const { error } = await sb.from('leads').insert({
    owner_id: profile.id as string,
    property_address: address,
    city: clean(body.city, 100) || null,
    state: clean(body.state, 100) || null,
    zip: clean(body.zip, 20) || null,
    owner_name: ownerName,
    phones: phone ? [phone] : [],
    emails: [],
    list_source: 'Seller page voice intake',
    status: 'new',
    consent_status: 'requested_contact',
    consent_at: new Date().toISOString(),
    consent_source: 'Seller page voice intake',
    notes: bits.join(' '),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // Slice 45 — tell the wholesaler a lead just landed (best-effort,
  // dark until their Resend key is connected; never blocks intake).
  await alertLeadOwner(sb, profile.id as string, {
    address,
    source: 'Seller page voice intake',
    detail: bits.join(' '),
  });
  return Response.json({ ok: true });
}
