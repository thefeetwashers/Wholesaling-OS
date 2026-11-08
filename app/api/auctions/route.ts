// Slice 53 — the live government auction feed (BidProwl API).
//
// What this is: a READ-ONLY discovery feed of live government
// auction lots (real estate category), shown inside the dashboard
// with a link back to the official source on every lot — the
// wholesaler bids on the source site, never here. WholesalingOS
// stores NONE of this data, takes no cut, and never re-sells it:
// that matches BidProwl's published rules of the road ("Link back
// to the listing wherever you display one. Don't resell the dataset
// or rebuild a competing index... apps that add something are
// exactly what it's for." — bidprowl.com/developers, read Nov 8,
// 2026; their Terms allow personal or commercial use to discover
// government surplus auctions).
//
// The platform's OWN free-tier key lives only in the server env
// (BIDPROWL_API_KEY — 1,000 calls/month, no card). Responses are
// cached in memory for 30 minutes so one key serves every
// wholesaler without burning the quota. Until the key is set, the
// route honestly reports { configured: false } and the panel says
// so — the same dark-until-lit pattern as Slice 44.
//
// Auth: the caller must be a signed-in WholesalingOS user (session
// verified against Supabase Auth, same pattern as /api/send). The
// feed is a subscriber feature, not a public endpoint.

export const dynamic = 'force-dynamic';

const BIDPROWL_KEY = process.env.BIDPROWL_API_KEY || '';

async function verifyUserId(req: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !url || !anon) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string };
    return u.id || null;
  } catch {
    return null;
  }
}

export interface AuctionLot {
  id: string;
  title: string;
  city: string;
  state: string;
  currentBid: number | null; // dollars
  numBids: number | null;
  endDate: string | null;
  sourceName: string;
  url: string; // link back to the listing (source_url preferred)
}

interface CacheEntry { at: number; lots: AuctionLot[] }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 30 * 60 * 1000;

function toLot(raw: Record<string, unknown>): AuctionLot | null {
  const title = typeof raw.title === 'string' ? raw.title : '';
  if (!title) return null;
  const cents = typeof raw.current_bid_cents === 'number' ? raw.current_bid_cents : null;
  const url = (typeof raw.source_url === 'string' && raw.source_url) || (typeof raw.bidprowl_url === 'string' && raw.bidprowl_url) || '';
  if (!url) return null; // a lot we cannot link back to is not displayed — BidProwl's rule
  return {
    id: String(raw.id ?? url),
    title,
    city: typeof raw.city === 'string' ? raw.city : '',
    state: typeof raw.state === 'string' ? raw.state : '',
    currentBid: cents !== null ? cents / 100 : null,
    numBids: typeof raw.num_bids === 'number' ? raw.num_bids : null,
    endDate: typeof raw.end_date === 'string' ? raw.end_date : null,
    sourceName: typeof raw.source_name === 'string' ? raw.source_name : (typeof raw.source === 'string' ? raw.source : 'Government auction'),
    url,
  };
}

export async function GET(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  if (!BIDPROWL_KEY) return Response.json({ configured: false, lots: [] });

  const { searchParams } = new URL(req.url);
  const stateParam = (searchParams.get('state') || 'FL').toUpperCase();
  const state = /^[A-Z]{2}$/.test(stateParam) ? stateParam : 'ALL';

  const hit = cache.get(state);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return Response.json({ configured: true, lots: hit.lots, cached: true });
  }

  const qs = new URLSearchParams({ category: 'real-estate' });
  if (state !== 'ALL') qs.set('state', state);
  let res: Response;
  try {
    res = await fetch(`https://bidprowl.com/api/v1/listings?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${BIDPROWL_KEY}` },
    });
  } catch {
    return Response.json({ configured: true, lots: [], error: 'The auction feed could not be reached just now. Try again in a few minutes.' });
  }
  if (!res.ok) {
    return Response.json({ configured: true, lots: [], error: `The auction feed refused the request (HTTP ${res.status}). If this persists, the platform key may have hit its monthly limit.` });
  }
  const body = (await res.json().catch(() => null)) as unknown;
  const rows: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray((body as { data?: unknown[] })?.data)
      ? (body as { data: unknown[] }).data
      : Array.isArray((body as { listings?: unknown[] })?.listings)
        ? (body as { listings: unknown[] }).listings
        : [];
  const lots: AuctionLot[] = [];
  for (const r of rows) {
    if (r && typeof r === 'object') {
      const lot = toLot(r as Record<string, unknown>);
      if (lot) lots.push(lot);
    }
    if (lots.length >= 24) break;
  }
  cache.set(state, { at: Date.now(), lots });
  return Response.json({ configured: true, lots, cached: false });
}
