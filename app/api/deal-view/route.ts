import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Slice 133 — Deal attention stats API (GET + POST).
//
// Real counts only, counted server-side with the service-role
// key — the same pattern as app/api/track/[token]/route.ts:
//   * Views: rows in public.deal_views for the deal. POST
//     records one view, then returns the stats; GET returns the
//     stats without recording. The client dedupes per browser
//     session (sessionStorage), so one visit counts once. The
//     number is counted page loads, not unique visitors, and the
//     component says so. There is NO anon INSERT policy on
//     deal_views — the client never writes to the table directly.
//   * Responses: counted live from the real
//     public.deal_responses rows for the deal. The count is
//     public (how many buyers responded); who responded and what
//     they wrote stays behind the deal_responses RLS policies.
//   * Price history: the real public.deal_price_history rows for
//     the deal, oldest first. A drop is derived from these rows
//     by the component — never invented.
//   * Days on market is computed in the component from
//     published_deals.created_at; this route does not return it.
//
// Only published deals are counted: an unpublished or unknown
// id returns 404 with no detail.
//
// Slice 141 (audit #17) — SERVER-SIDE view dedupe. The client
// dedupes per browser session (sessionStorage), but that never
// stopped a repeat POST from counting again. This route now keeps
// a small in-memory map of caller IP + dealId → last counted
// time, and skips the insert when the same caller re-posts the
// same deal inside the window. Honest limits, stated plainly:
//   * the key is the request IP from x-forwarded-for (the
//     platform sets it) — there is NO fingerprinting, no cookie,
//     and no new table column (no migration in this slice);
//   * the map lives per server instance and resets on restart,
//     so it is a rate guard, not a unique-visitor count — the
//     component already says the number counts page loads;
//   * when no IP header is present the view is counted (the
//     route cannot dedupe what it cannot see).
// A skipped insert still returns the live stats.
const VIEW_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const recentViews = new Map<string, number>();

function callerIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim() || '';
  if (first) return first;
  return req.headers.get('x-real-ip')?.trim() || null;
}

function alreadyCountedRecently(ip: string, dealId: string): boolean {
  const key = `${ip}|${dealId}`;
  const now = Date.now();
  const last = recentViews.get(key);
  if (last !== undefined && now - last < VIEW_DEDUPE_WINDOW_MS) return true;
  recentViews.set(key, now);
  // Prune stale entries so the map cannot grow without bound.
  if (recentViews.size > 5000) {
    for (const [k, t] of recentViews) {
      if (now - t >= VIEW_DEDUPE_WINDOW_MS) recentViews.delete(k);
    }
  }
  return false;
}

interface PriceHistoryRow {
  old_price: number | null;
  new_price: number | null;
  changed_at: string;
}

function serviceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
}

async function statsForDeal(dealId: string) {
  const service = serviceClient();
  if (!service) {
    return NextResponse.json({ error: 'Deal stats are not configured.' }, { status: 503 });
  }
  const { data: deal } = await service
    .from('published_deals')
    .select('id')
    .eq('id', dealId)
    .eq('published', true)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });

  const { count: views } = await service
    .from('deal_views')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId);
  const { count: responses } = await service
    .from('deal_responses')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId);
  const { data: history } = await service
    .from('deal_price_history')
    .select('old_price, new_price, changed_at')
    .eq('deal_id', dealId)
    .order('changed_at', { ascending: true });

  return NextResponse.json({
    dealId,
    views: views ?? 0,
    responses: responses ?? 0,
    priceHistory: ((history || []) as PriceHistoryRow[]).map((r) => ({
      old_price: typeof r.old_price === 'number' ? r.old_price : null,
      new_price: typeof r.new_price === 'number' ? r.new_price : null,
      changed_at: r.changed_at,
    })),
  });
}

export async function GET(req: NextRequest) {
  const dealId = (req.nextUrl.searchParams.get('dealId') || '').trim();
  if (!dealId) return NextResponse.json({ error: 'Missing dealId.' }, { status: 400 });
  return statsForDeal(dealId);
}

export async function POST(req: NextRequest) {
  let dealId = '';
  try {
    const body = await req.json();
    dealId = typeof body?.dealId === 'string' ? body.dealId.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!dealId) return NextResponse.json({ error: 'Missing dealId.' }, { status: 400 });

  const service = serviceClient();
  if (!service) {
    return NextResponse.json({ error: 'Deal stats are not configured.' }, { status: 503 });
  }
  // Only a published deal gets a counted view.
  const { data: deal } = await service
    .from('published_deals')
    .select('id')
    .eq('id', dealId)
    .eq('published', true)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });

  // A failed insert must not hide the stats: the view is
  // secondary, the counts are the answer. Slice 141 (audit #17):
  // skip the insert when this caller already counted this deal
  // inside the dedupe window — the stats below are still live.
  const ip = callerIp(req);
  if (!ip || !alreadyCountedRecently(ip, dealId)) {
    await service.from('deal_views').insert({ deal_id: dealId });
  }
  return statsForDeal(dealId);
}
