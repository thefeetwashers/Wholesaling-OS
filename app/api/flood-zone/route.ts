// Slice 132 — FEMA flood zone route (public; the deal detail
// page is public). Server-side only, no key. Source: FEMA
// National Flood Hazard Layer (NFHL), layer 28 "Flood Hazard
// Zones" — VERIFIED LIVE Nov 17, 2026 via the /arcgis/ path:
//   https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
// The /gis/nfhl/ path is dead (WebSEAL "Not Found") and is never
// used. Same guards as /api/property-lookup: 30-second timeout,
// short cache, service errors quoted verbatim. A point with no
// mapped zone returns {mode: 'no_data'} — the UI reads "not
// checked", never a guessed zone. A zone letter is FEMA's
// effective-map information, not a Standard Flood Hazard
// Determination, not a flood prediction, and not an insurance
// quote.

import { fetchFloodZone } from '../../../lib/flood-zone';

export const dynamic = 'force-dynamic';

interface CacheEntry { at: number; body: unknown }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json({ error: 'Give a valid latitude and longitude for the flood zone.' }, { status: 400 });
  }
  const key = `flood:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.body);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const result = await fetchFloodZone(lat, lng, ctl.signal);
    cache.set(key, { at: Date.now(), body: result });
    return Response.json(result);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return Response.json({ error: 'FEMA NFHL took too long to answer. Try again shortly.' }, { status: 504 });
    }
    return Response.json({ error: (e as Error)?.message || 'FEMA NFHL could not be reached.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
