// Slice 104 — Florida state records lookup (FDOR statewide
// cadastral service). A signed-in wholesaler searches the Florida
// property tax roll — owner name, street address, parcel ID, or
// city — and this route runs ONE live query against the Florida
// Department of Revenue's public ArcGIS service, maps the rows, and
// returns them. The platform stores nothing from the roll: a record
// becomes a lead only when the wholesaler taps "Add as lead", with
// the provenance stamped on it (see components/StateRecords.tsx).
//
// Why this is within the source's terms (read Nov 9–10, 2026):
// the roll is public records under Ch. 119, Fla. Stat.; the 67
// county property appraisers submit it to FDOR's Property Tax
// Oversight program, which publishes the rolls and this service
// expressly for public use; the service's Query operation is open,
// no key, attribution = "Florida's county property appraisers,
// Florida Department of Revenue Property Tax Oversight" (printed on
// the panel). Design honors the limits: live per-search queries of
// at most 25 rows, a 10-minute cache so repeated searches don't
// hammer the state service, no bulk copying, no resale, no export
// of the dataset. The roll is a yearly snapshot (published each
// August) — every record carries its roll year and the panel says
// the county appraiser is the live record.
//
// Auth: session-verified against Supabase Auth, same pattern as
// /api/auctions — a subscriber feature, not a public endpoint.

import { buildStateWhere, mapStateFeature, stateOutFields, type StateRecord, type StateSearchMode } from '../../../lib/state-records';

export const dynamic = 'force-dynamic';

const SERVICE_URL =
  'https://services9.arcgis.com/Gh9awoU677aKree0/ArcGIS/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query';

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

interface CacheEntry { at: number; records: StateRecord[] }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 10 * 60 * 1000;

const MODES: StateSearchMode[] = ['owner', 'address', 'parcel', 'city', 'zip'];

export async function GET(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return Response.json({ error: 'Sign in required.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const modeParam = (searchParams.get('mode') || 'owner') as StateSearchMode;
  const mode: StateSearchMode = MODES.indexOf(modeParam) >= 0 ? modeParam : 'owner';
  const q = searchParams.get('q') || '';
  // Address search is a prefix search on the roll's index, so it
  // has to start the way the roll stores addresses: house number
  // first. Say so BEFORE burning a doomed query.
  if (mode === 'address' && !/^\d/.test(q.trim())) {
    return Response.json({
      records: [],
      error:
        'Address search on the state roll starts with the house number — e.g. “400 85 DEBARRY AVE”. The roll is indexed from the first character, so a street name alone cannot be scanned. Don’t know the number? Search by owner name or ZIP instead.',
    });
  }
  const where = buildStateWhere(mode, q);
  if (!where) {
    return Response.json({
      records: [],
      error:
        mode === 'parcel'
          ? 'Type at least 4 characters of the parcel ID.'
          : mode === 'zip'
            ? 'Type the full 5-digit ZIP code.'
            : 'Type at least 3 characters to search the state roll.',
    });
  }

  const key = `${mode}:${q.trim().toUpperCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return Response.json({ records: hit.records, cached: true });
  }

  // No orderByFields — ever. Live probes (Nov 10, 2026) proved the
  // FDOR service rejects full-field queries that also ask it to
  // sort (generic 400 "Invalid query parameters"), while the same
  // queries without the sort succeed. The records are sorted below,
  // after mapping, in this route.
  const qs = new URLSearchParams({
    where,
    outFields: stateOutFields(),
    resultRecordCount: '25',
    returnGeometry: 'false',
    f: 'json',
  });

  let res: Response;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    res = await fetch(`${SERVICE_URL}?${qs.toString()}`, { signal: ctl.signal });
  } catch {
    clearTimeout(timer);
    return Response.json({
      records: [],
      error: 'The state records service took too long to answer or could not be reached. Try a narrower search — a house number plus street name usually answers fastest.',
    });
  }
  clearTimeout(timer);
  if (!res.ok) {
    return Response.json({ records: [], error: `The state records service refused the request (HTTP ${res.status}). Try again shortly.` });
  }
  const body = (await res.json().catch(() => null)) as {
    features?: { attributes?: Record<string, unknown> }[];
    error?: { message?: string };
  } | null;
  if (!body || body.error) {
    // Quote the service's own words — a swallowed error message
    // cost a full diagnosis round on Nov 9–10, 2026.
    const svcMsg = body && body.error && body.error.message ? body.error.message : '';
    return Response.json({
      records: [],
      error: svcMsg
        ? `That search did not run — the state service answered: “${svcMsg}”`
        : 'That search did not run — check the spelling and try again.',
    });
  }
  const records: StateRecord[] = [];
  const features = Array.isArray(body.features) ? body.features : [];
  for (const f of features) {
    if (f && typeof f === 'object' && f.attributes) {
      const rec = mapStateFeature(f.attributes);
      if (rec) records.push(rec);
    }
    if (records.length >= 25) break;
  }
  records.sort((a, b) => {
    const ka = mode === 'owner' ? a.ownerName || a.address : a.address;
    const kb = mode === 'owner' ? b.ownerName || b.address : b.address;
    const c = ka.localeCompare(kb);
    return c !== 0 ? c : a.address.localeCompare(b.address);
  });
  cache.set(key, { at: Date.now(), records });
  return Response.json({ records, cached: false });
}
