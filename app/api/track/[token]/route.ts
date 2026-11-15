import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Slice 125 — public seller tracker lookup. The seller opens
// /track/<token> with no login; this route is the only reader of
// the token. It returns ONLY what the seller is allowed to see:
// the property address, the seller-facing status, the offer
// receipt numbers (when an offer exists), the closing date the
// seller picked, and the company name. Never contact details,
// never the wholesaler's notes, never other leads. A token that
// matches nothing returns 404 with no detail.

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Tracker is not configured.' }, { status: 503 });
  }
  const { token } = await ctx.params;
  const t = (token || '').trim();
  if (!t) return NextResponse.json({ error: 'Missing tracking link.' }, { status: 400 });

  const service = createClient(supabaseUrl, serviceKey);
  const { data: lead } = await service
    .from('leads')
    .select('property_address, city, state, seller_status, preferred_closing_date, offer_amount, offer_comp_low, offer_comp_high, offer_repairs, offer_resale_costs, offer_note, asking_price, owner_id')
    .eq('tracker_token', t)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Tracking link not found.' }, { status: 404 });

  let company = '';
  let slug = '';
  const { data: profile } = await service
    .from('storefront_profiles')
    .select('company_name, public_slug')
    .eq('wholesaler_id', lead.owner_id as string)
    .maybeSingle();
  if (profile) {
    company = (profile.company_name as string) || '';
    slug = (profile.public_slug as string) || '';
  }
  if (!company) {
    const { data: page } = await service
      .from('profiles')
      .select('company, public_slug')
      .eq('id', lead.owner_id as string)
      .maybeSingle();
    company = (page?.company as string) || '';
    slug = (page?.public_slug as string) || '';
  }

  return NextResponse.json({
    lead: {
      property_address: lead.property_address,
      city: lead.city,
      state: lead.state,
      seller_status: lead.seller_status || 'received',
      preferred_closing_date: lead.preferred_closing_date,
      offer_amount: lead.offer_amount,
      offer_comp_low: lead.offer_comp_low,
      offer_comp_high: lead.offer_comp_high,
      offer_repairs: lead.offer_repairs,
      offer_resale_costs: lead.offer_resale_costs,
      offer_note: lead.offer_note,
      asking_price: lead.asking_price,
      company,
      slug,
    },
  });
}
