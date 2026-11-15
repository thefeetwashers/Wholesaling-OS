import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Slice 125 — hand the private tracking token to a seller who
// just submitted. The thank-you screen calls this once with the
// lead id and page slug; the token is returned only when the
// lead belongs to that page's owner, carries the 'Seller landing
// page' source, and was created within the last 2 hours — the
// same freshness window as the seller-photo route. Anything else
// returns 404 with no detail, so a token can never be guessed
// out of an old lead.

const FRESH_MS = 2 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Tracker is not configured.' }, { status: 503 });
  }
  let body: { lead_id?: unknown; slug?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }
  const leadId = String(body.lead_id || '').trim();
  const slug = String(body.slug || '').toLowerCase().trim();
  if (!leadId || !slug) return NextResponse.json({ error: 'Missing lead or page.' }, { status: 400 });

  const service = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await service
    .from('profiles')
    .select('id')
    .eq('public_slug', slug)
    .eq('seller_page_enabled', true)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const { data: lead } = await service
    .from('leads')
    .select('owner_id, list_source, created_at, tracker_token')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead || lead.owner_id !== profile.id) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (lead.list_source !== 'Seller landing page') return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (Date.now() - Date.parse(lead.created_at as string) > FRESH_MS) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  if (!lead.tracker_token) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ token: lead.tracker_token });
}
