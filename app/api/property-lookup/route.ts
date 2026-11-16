// Slice 123 — Property lookup route. Two modes, both server-side:
//   Mode A ?address= — the U.S. Census geocoder (free, no key).
//   It sends NO CORS headers, so the browser must never call it
//   directly; this route is the only caller.
//   Mode B ?parcelId=&countyCode= — the Florida Statewide
//   Cadastral roll (FDOR Property Tax Oversight), the same official
//   service the State Records panel queries, narrowed to one parcel
//   in one county (countyCode is the DOR county code, 1–67 — see
//   lib/property-lookup.ts; Charlotte is 8, not 17). The roll's
//   own CO_NO field is the DOR code + 10 (Slice 126), and
//   lookupFlParcel translates it — the route never sends the DOR
//   code to the roll directly.
// Florida only. A state joins this route only when its real service
// URL is verified live; no other state's service is claimed here.
// The platform stores nothing from either source: a record becomes
// a lead only when the wholesaler taps "Save to My Sealed Leads"
// (see components/PropertyLookup.tsx).
//
// Terms (same gate as the State Records panel): the cadastral roll
// is public records under Ch. 119, Fla. Stat., published by FDOR
// Property Tax Oversight for public use; the Census geocoder is a
// free public service. Design honors the limits: live per-search
// queries of at most 25 rows, a 10-minute cache, no bulk copying,
// no resale, no export of the dataset. The roll is a yearly
// snapshot published each August — the panel says the county
// appraiser is the live record, and no roll year is invented for
// a record whose fields do not carry one.
//
// Auth: session-verified against Supabase Auth, same pattern as
// /api/state-records — a subscriber feature, not a public endpoint.

import {
  geocodeAddress,
  lookupFlParcel,
  countyByCode,
  type PropertyLookupResult,
} from '../../../lib/property-lookup';

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

interface CacheEntry { at: number; results: PropertyLookupResult[] }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return Response.json({ error: 'Sign in required.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const address = (searchParams.get('address') || '').trim();
  const parcelId = (searchParams.get('parcelId') || '').trim();
  const countyCodeRaw = (searchParams.get('countyCode') || '').trim();

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    if (parcelId) {
      // Mode B — Florida parcel, one county.
      const countyCode = Number(countyCodeRaw);
      if (!Number.isInteger(countyCode) || countyCode < 1 || countyCode > 67) {
        return Response.json({ results: [], error: 'Pick a Florida county (DOR code 1–67) for the parcel lookup.' });
      }
      const county = countyByCode(countyCode);
      if (!county) {
        return Response.json({ results: [], error: 'That county code is not a Florida county.' });
      }
      if (parcelId.length < 3) {
        return Response.json({ results: [], error: 'Type at least 3 characters of the parcel ID.' });
      }
      const key = `parcel:${countyCode}:${parcelId.toUpperCase()}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_MS) {
        return Response.json({ results: hit.results, cached: true, county: county.name });
      }
      let results: PropertyLookupResult[];
      try {
        results = await lookupFlParcel(parcelId, countyCode, ctl.signal);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          return Response.json({ results: [], error: 'The Florida cadastral service took too long to answer. Try a narrower search.' });
        }
        return Response.json({ results: [], error: (e as Error)?.message || 'The Florida cadastral service could not be reached.' });
      }
      cache.set(key, { at: Date.now(), results });
      return Response.json({ results, cached: false, county: county.name });
    }

    if (address) {
      // Mode A — Census geocode, nationwide.
      if (address.length < 5) {
        return Response.json({ results: [], error: 'Type a fuller address — house number and street at least.' });
      }
      const key = `addr:${address.toUpperCase()}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_MS) {
        return Response.json({ results: hit.results, cached: true });
      }
      let geo;
      try {
        geo = await geocodeAddress(address, ctl.signal);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          return Response.json({ results: [], error: 'The Census geocoder took too long to answer. Try again shortly.' });
        }
        return Response.json({ results: [], error: (e as Error)?.message || 'The Census geocoder could not be reached.' });
      }
      if (!geo) {
        return Response.json({ results: [], error: 'The Census geocoder found no match for that address — check the spelling and try again.' });
      }
      const countyName = geo.countyName ? geo.countyName.replace(/\s+County$/i, '') : undefined;
      const result: PropertyLookupResult = {
        source: 'census',
        address: geo.matchedAddress,
        state: '',
        county: countyName || undefined,
        lat: geo.lat,
        lng: geo.lng,
        censusCountyFips: geo.countyFips || undefined,
        matchedAddress: geo.matchedAddress,
      };
      // State is only claimed when the Census geography says so:
      // the matched address itself carries the state — parse it
      // from the end of the matched address ("..., FL 34950").
      const m = geo.matchedAddress.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/);
      if (m) result.state = m[1];
      const zipM = geo.matchedAddress.match(/(\d{5})(?:-\d{4})?\s*$/);
      if (zipM) result.zip = zipM[1];
      const results = [result];
      cache.set(key, { at: Date.now(), results });
      return Response.json({ results, cached: false });
    }

    return Response.json({
      results: [],
      error: 'Give an address to geocode, or a parcel ID plus a Florida county to look up on the cadastral roll.',
    });
  } finally {
    clearTimeout(timer);
  }
}
