// Slice 132 — Broward County appraiser record route (subscriber
// feature, same auth pattern as /api/property-lookup).
// Server-side only: the BCPA GIS REST service is queried here,
// never from the browser. Same guards: 30-second timeout,
// 10-minute cache, service errors quoted verbatim. Returns the
// BCPA owner profile (table 36 BCPA_INFO) and the sale history
// (table 37 BCPA_SALES) for one folio — deed history + owner
// profile ONLY from fields the live service returns. A folio
// with no record returns { info: null, sales: [] }, never an
// invented owner or sale. Broward County only (DOR code 6).

import { fetchBrowardRecord } from '../../../lib/broward-record';

export const dynamic = 'force-dynamic';

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

interface CacheEntry { at: number; body: unknown }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return Response.json({ error: 'Sign in required.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folio = (searchParams.get('folio') || '').trim();
  if (folio.length < 3) {
    return Response.json({ error: 'Give a folio (parcel) number for the Broward record.' }, { status: 400 });
  }
  const key = `broward:${folio.toUpperCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.body);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const result = await fetchBrowardRecord(folio, ctl.signal);
    cache.set(key, { at: Date.now(), body: result });
    return Response.json(result);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return Response.json({ error: 'The Broward County appraiser took too long to answer. Try again shortly.' }, { status: 504 });
    }
    return Response.json({ error: (e as Error)?.message || 'The Broward County appraiser could not be reached.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
