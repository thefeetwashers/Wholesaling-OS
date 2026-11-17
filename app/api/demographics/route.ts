// Slice 132 — demographics route (public; the deal detail page
// is public). Server-side only: the Census API key (when set)
// lives in env CENSUS_API_KEY and never reaches the browser.
// Same guards as /api/property-lookup: 30-second timeout, short
// cache, service errors quoted verbatim. Without a key the route
// returns {mode: 'not_configured'} — the Census data API requires
// a key as of Nov 17, 2026 — and the UI reads "needs a free
// Census API key". No number is ever invented; a ZIP the API has
// nothing for reads "not provided".

import { fetchDemographicsByZip } from '../../../lib/demographics';

export const dynamic = 'force-dynamic';

interface CacheEntry { at: number; body: unknown }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const zip = (searchParams.get('zip') || '').trim();
  if (!/^\d{5}$/.test(zip)) {
    return Response.json({ error: 'Give a 5-digit ZIP code for demographics.' }, { status: 400 });
  }
  const key = `zip:${zip}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.body);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const result = await fetchDemographicsByZip(zip, process.env.CENSUS_API_KEY, ctl.signal);
    cache.set(key, { at: Date.now(), body: result });
    return Response.json(result);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return Response.json({ error: 'The Census API took too long to answer. Try again shortly.' }, { status: 504 });
    }
    return Response.json({ error: (e as Error)?.message || 'The Census API could not be reached.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
