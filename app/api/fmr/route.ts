// Slice 132 — HUD Fair Market Rent route (public; the deal
// detail page and the Deal Analyzer are public / signed-in
// respectively, and HUD data is public). Server-side only: the
// free HUD token lives in env HUD_API_TOKEN and never reaches the
// browser. Same guards as /api/property-lookup: 30-second timeout,
// short cache, service errors quoted verbatim. Without a token
// the route returns {mode: 'not_configured'} and the UI reads
// "needs a free HUD token". No rent is ever invented.
// This product uses the HUD User Data API but is not endorsed or
// certified by HUD User.

import { fetchFmrByCountyFips } from '../../../lib/fmr';

export const dynamic = 'force-dynamic';

interface CacheEntry { at: number; body: unknown }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const countyFips = (searchParams.get('countyFips') || '').trim();
  if (!/^\d{5}$/.test(countyFips)) {
    return Response.json({ error: 'Give a 5-digit county FIPS code for Fair Market Rent.' }, { status: 400 });
  }
  const key = `fmr:${countyFips}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.body);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const result = await fetchFmrByCountyFips(countyFips, process.env.HUD_API_TOKEN, ctl.signal);
    cache.set(key, { at: Date.now(), body: result });
    return Response.json(result);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return Response.json({ error: 'The HUD API took too long to answer. Try again shortly.' }, { status: 504 });
    }
    return Response.json({ error: (e as Error)?.message || 'The HUD API could not be reached.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
