// Slice 132 — parcel boundary route (subscriber feature, same
// auth pattern as /api/property-lookup). Server-side only: the
// Florida Statewide Cadastral roll is queried here, never from
// the browser. Same guards: 30-second timeout, 10-minute cache,
// service errors quoted verbatim. Returns the parcel's polygon
// rings in WGS84 (outSR=4326) — or rings: null when the live
// response carries no geometry. The map draws the polygon ONLY
// when rings come back; a boundary is never faked.

import { fetchParcelBoundary } from '../../../lib/parcel-geometry';

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
  const parcelId = (searchParams.get('parcelId') || '').trim();
  const countyCode = Number((searchParams.get('countyCode') || '').trim());
  if (parcelId.length < 3) {
    return Response.json({ error: 'Give a parcel ID for the boundary.' }, { status: 400 });
  }
  if (!Number.isInteger(countyCode) || countyCode < 1 || countyCode > 67) {
    return Response.json({ error: 'Pick a Florida county (DOR code 1–67) for the boundary.' }, { status: 400 });
  }
  const key = `boundary:${countyCode}:${parcelId.toUpperCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.body);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const result = await fetchParcelBoundary(parcelId, countyCode, ctl.signal);
    cache.set(key, { at: Date.now(), body: result });
    return Response.json(result);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return Response.json({ error: 'The Florida cadastral service took too long to answer. Try a narrower search.' }, { status: 504 });
    }
    return Response.json({ error: (e as Error)?.message || 'The Florida cadastral service could not be reached.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
