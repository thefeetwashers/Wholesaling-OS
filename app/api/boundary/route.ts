// Slice 132 — Census TIGERweb boundary route (public; the deal
// detail map is public). Server-side only, no key. Source:
// tigerweb.geo.census.gov — State_County layer 1 (Counties,
// January 1, 2026 vintage) for ?countyFips=, and
// PUMA_TAD_TAZ_UGA_ZCTA layer 1 (2020 Census ZIP Code Tabulation
// Areas) for ?zip=. Both verified live Nov 17, 2026 (service
// metadata + field lists; supported formats include geoJSON).
// Same guards as /api/property-lookup: 30-second timeout, short
// cache, service errors quoted verbatim. A county or ZIP with no
// boundary returns { geojson: null } — the map then shows a
// marker only, never a guessed boundary.

import { fetchCountyBoundary, fetchZctaBoundary } from '../../../lib/boundary';

export const dynamic = 'force-dynamic';

interface CacheEntry { at: number; body: unknown }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const countyFips = (searchParams.get('countyFips') || '').trim();
  const zip = (searchParams.get('zip') || '').trim();
  if (!countyFips && !zip) {
    return Response.json({ error: 'Give a county FIPS code or a ZIP code for the boundary.' }, { status: 400 });
  }
  const key = countyFips ? `county:${countyFips}` : `zcta:${zip}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.body);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const result = countyFips
      ? await fetchCountyBoundary(countyFips, ctl.signal)
      : await fetchZctaBoundary(zip, ctl.signal);
    cache.set(key, { at: Date.now(), body: result });
    return Response.json(result);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return Response.json({ error: 'Census TIGERweb took too long to answer. Try again shortly.' }, { status: 504 });
    }
    return Response.json({ error: (e as Error)?.message || 'Census TIGERweb could not be reached.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
