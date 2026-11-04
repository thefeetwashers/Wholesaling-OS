import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { normalizePhones } from '../../../../lib/phone';
import { alertLeadOwner } from '../../../../lib/lead-alert';

// Lead-ingestion webhook — SERVER ONLY, service-role key required.
// Slice 31. A wholesaler's OWN sources (their form backend, a
// Zapier/Make webhook action, a licensed feed on their own key) POST
// leads here with a per-user key ("wos_..."). Only the key's SHA-256
// hash is stored (schema v4.2), so the lookup is by hash and the full
// key never touches the database.
//
// Contract (see production/feed-schema.md): provenance is mandatory —
// every record carries a source name (its own `source`/`list_source`,
// else the key's label) and it is stamped on the lead. Address is
// required; rows without one are skipped and reported. Duplicates
// (same normalized address + ZIP/city as an existing lead of the same
// owner, or repeated inside the payload) are skipped and reported.
// Feed-only fields (parcel, assessed value, opening bid, auction date)
// land in the lead's notes, exactly like the Slice 30 import inbox.
// Phones/emails are stored ONLY when the payload itself contains them.
// Consent starts 'unknown', upgraded to 'requested_contact' only when
// the record itself says so (e.g. the wholesaler's own seller form,
// where the person asked to be contacted). A webhook can never set
// 'express_consent' — that is recorded by the wholesaler in the comms
// center. Nothing here sends, dials, or scrapes anything.

const MAX_RECORDS = 100;

function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function normAddr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

type Raw = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean);
  const s = str(v);
  return s ? [s] : [];
}

function numStr(v: unknown): string {
  return typeof v === 'number' ? String(v) : str(v);
}

// Accept both the flat lead shape (property_address, ...) and the
// feed-schema nested shape (location.address, source.name, ...).
function normalize(rec: Raw) {
  const loc = (rec.location || {}) as Raw;
  const src = (rec.source || {}) as Raw;
  const auction = (rec.auction || {}) as Raw;
  const property = (rec.property || {}) as Raw;
  return {
    property_address: str(rec.property_address) || str(loc.address),
    city: str(rec.city) || str(loc.city),
    state: str(rec.state) || str(loc.state),
    zip: str(rec.zip) || str(loc.zip),
    county: str(rec.county) || str(loc.county),
    owner_name: str(rec.owner_name),
    mailing_address: str(rec.mailing_address),
    phones: strList(rec.phones || rec.phone),
    emails: strList(rec.emails || rec.email),
    sourceName:
      str(src.name) || (typeof rec.source === 'string' ? str(rec.source) : '') || str(rec.list_source),
    parcel: str(rec.parcel_id) || str(rec.parcel),
    assessed: numStr(rec.assessed_value) || numStr(property.assessed_value),
    bid: numStr(rec.opening_bid) || numStr(auction.opening_bid) || numStr(auction.liability_amount),
    auctionDate: str(rec.auction_date) || str(auction.date),
    requestedContact: str(rec.consent_status) === 'requested_contact',
  };
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Lead ingestion is not configured on the server.' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') || '';
  const presented = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : (req.headers.get('x-api-key') || '').trim();
  if (!presented) {
    return NextResponse.json({ error: 'Missing key — send Authorization: Bearer <key> or an x-api-key header.' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: keys, error: keyError } = await supabase
    .from('ingest_keys')
    .select('id, user_id, label')
    .eq('key_hash', sha256Hex(presented))
    .is('revoked_at', null)
    .limit(1);
  if (keyError) return NextResponse.json({ error: 'Key check failed.' }, { status: 500 });
  const key = (keys || [])[0];
  if (!key) return NextResponse.json({ error: 'Invalid or revoked key.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as unknown;
  let records: Raw[] = [];
  if (Array.isArray(body)) records = body as Raw[];
  else if (body && typeof body === 'object') {
    const b = body as Raw;
    if (Array.isArray(b.leads)) records = b.leads as Raw[];
    else if (Array.isArray(b.records)) records = b.records as Raw[];
    else records = [b];
  }
  if (records.length === 0) {
    return NextResponse.json({ error: 'No lead records in the payload.' }, { status: 400 });
  }
  if (records.length > MAX_RECORDS) {
    return NextResponse.json({ error: `Too many records — at most ${MAX_RECORDS} per request.` }, { status: 400 });
  }

  const userId = key.user_id as string;
  const { data: existing, error: loadError } = await supabase
    .from('leads')
    .select('property_address, zip, city')
    .eq('owner_id', userId);
  if (loadError) return NextResponse.json({ error: 'Could not read existing leads for dedupe.' }, { status: 500 });

  const seen = new Set<string>();
  for (const l of existing || []) {
    seen.add(`${normAddr(String(l.property_address || ''))}|${normAddr(String(l.zip || l.city || ''))}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows: Record<string, unknown>[] = [];
  let duplicates = 0;
  let noAddress = 0;
  let invalidPhones = 0;
  for (const rec of records) {
    const n = normalize(rec && typeof rec === 'object' ? rec : {});
    if (!n.property_address) { noAddress++; continue; }
    // Slice 32 — format-check any phones the payload itself carries:
    // valid numbers are stored in standard +1 (E.164) form; invalid
    // ones are kept as sent and counted in the response summary.
    const checked = normalizePhones(n.phones);
    n.phones = checked.phones;
    invalidPhones += checked.invalid;
    const dedupeKey = `${normAddr(n.property_address)}|${normAddr(n.zip || n.city)}`;
    if (seen.has(dedupeKey)) { duplicates++; continue; }
    seen.add(dedupeKey);
    const sourceName = n.sourceName || (key.label as string);
    const extra: string[] = [];
    if (n.parcel) extra.push(`Parcel: ${n.parcel}`);
    if (n.assessed) extra.push(`Assessed: ${n.assessed}`);
    if (n.bid) extra.push(`Opening bid / owed: ${n.bid}`);
    if (n.auctionDate) extra.push(`Auction: ${n.auctionDate}`);
    const stamp = `Via webhook ${today} — source: ${sourceName}`;
    // Uniform key set on EVERY row (PostgREST rejects heterogeneous
    // bulk payloads), and [] — never null — for the NOT NULL array
    // columns (Slice 30 lessons, applied on the server).
    rows.push({
      owner_id: userId,
      property_address: n.property_address,
      city: n.city || null,
      state: n.state || null,
      zip: n.zip || null,
      county: n.county || null,
      owner_name: n.owner_name || null,
      mailing_address: n.mailing_address || null,
      phones: n.phones,
      emails: n.emails,
      status: 'new',
      list_source: `Webhook: ${sourceName}`.slice(0, 120),
      notes: extra.length ? `${stamp} · ${extra.join(' · ')}` : stamp,
      consent_status: n.requestedContact ? 'requested_contact' : 'unknown',
    });
  }

  let added = 0;
  let insertError: string | undefined;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from('leads').insert(chunk);
    if (!error) { added += chunk.length; continue; }
    if (!insertError) insertError = error.message || 'database insert failed';
    for (const row of chunk) {
      const single = await supabase.from('leads').insert(row);
      if (single.error) { if (!insertError) insertError = single.error.message || insertError; }
      else added += 1;
    }
  }

  await supabase.from('ingest_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);

  // Slice 45 — one digest alert per batch (never one per row),
  // best-effort and dark until the owner's Resend key is connected.
  if (added > 0 && rows.length > 0) {
    await alertLeadOwner(supabase, userId, {
      address: added === 1 ? String(rows[0].property_address || 'New lead') : `${added} new leads`,
      source: `Webhook: ${key.label}`,
      detail: added === 1 ? undefined : `First: ${String(rows[0].property_address || '')}`,
    });
  }

  return NextResponse.json({
    added,
    duplicates_skipped: duplicates,
    skipped_no_address: noAddress,
    ...(invalidPhones ? { invalid_phones: invalidPhones } : {}),
    ...(insertError && added < rows.length ? { error: insertError } : {}),
  });
}
