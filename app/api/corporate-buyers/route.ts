// Slice 132 — "Find recent corporate buyers" RESEARCH route
// (subscriber feature, same auth pattern as
// /api/property-lookup). Server-side only: the Florida Statewide
// Cadastral roll is queried here, never from the browser. Same
// guards: 30-second timeout, 10-minute cache, service errors
// quoted verbatim. Returns at most 25 rows, ordered by sale
// price descending: county (DOR code, translated to the roll
// code +10) + SALE_YR1 >= minYear + SALE_PRC1 >= minPrice +
// owner name LIKE LLC / INC / TRUST / LP.
//
// RESEARCH ONLY — an LLC owning a property is NOT a buyer who
// consented to be contacted. Nothing here writes to the buyers
// database, nothing is bulk-harvested, nothing is emailed or
// messaged. The UI labels the results RESEARCH with the exact
// honest wording and links out to Sunbiz for a manual check.

import { findRecentCorporateBuyers } from '../../../lib/corporate-buyers';

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
  const countyCode = Number((searchParams.get('countyCode') || '').trim());
  const minYear = Number((searchParams.get('minYear') || '').trim());
  const minPrice = Number((searchParams.get('minPrice') || '').trim());
  if (!Number.isInteger(countyCode) || countyCode < 1 || countyCode > 67) {
    return Response.json({ error: 'Pick a Florida county (DOR code 1–67) for the research lookup.' }, { status: 400 });
  }
  if (!Number.isInteger(minYear) || minYear < 1900 || minYear > 2100) {
    return Response.json({ error: 'Pick a sale year between 1900 and 2100.' }, { status: 400 });
  }
  if (!Number.isFinite(minPrice) || minPrice < 0) {
    return Response.json({ error: 'Pick a minimum sale price of $0 or more.' }, { status: 400 });
  }
  const key = `corp:${countyCode}:${minYear}:${Math.round(minPrice)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.body);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const rows = await findRecentCorporateBuyers(countyCode, minYear, minPrice, ctl.signal);
    const body = { rows };
    cache.set(key, { at: Date.now(), body });
    return Response.json(body);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return Response.json({ error: 'The Florida cadastral service took too long to answer. Try a narrower search.' }, { status: 504 });
    }
    return Response.json({ error: (e as Error)?.message || 'The Florida cadastral service could not be reached.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
