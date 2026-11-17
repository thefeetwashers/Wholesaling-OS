// Slice 135 — Bulk FL Parcel Enricher (server-side only).
//
// One statewide query against the Florida Statewide Cadastral
// roll (FDOR Property Tax Oversight — the same official service
// the single-parcel lookup in lib/property-lookup.ts uses):
//   PARCEL_ID IN ('a','b','c')
// PARCEL_ID is a TEXT field, so every value is QUOTED and any
// single-quote inside a value is escaped by doubling it — an
// unquoted IN list returns nothing for every ID and is the known
// bug; do not repeat it. No county filter: the roll's CO_NO on
// each returned row says which county it is (roll CO_NO = DOR
// code + 10 — ROLL_COUNTY_CODE_OFFSET, Slice 126 — so the county
// is found by SUBTRACTING the offset, e.g. roll 66 = DOR 56 =
// St. Lucie).
//
// Honesty rules, same as the single-parcel lookup:
//   - Up to 50 parcel IDs per batch. More than 50 is refused
//     before any fetch, not silently truncated.
//   - A requested ID with no match comes back as a row with
//     matched: false and status 'no match found' — it never kills
//     the whole batch and is never invented into a match.
//   - Duplicates are FLAGGED, never silently dropped: the same
//     parcel ID pasted twice, or one ID matching multiple roll
//     rows, each get duplicate: true on every affected row.
//   - The service's own error text is quoted verbatim; a 30s
//     guard aborts a hung fetch (the route owns the timer, this
//     function takes the signal).
//   - The roll is a yearly snapshot published each August — the
//     county appraiser is the live record. No roll year is
//     invented for a record whose fields do not carry one.
//   - Nothing is stored here. A row becomes a lead only when the
//     wholesaler taps that action in the UI; a skip-traced phone
//     or email is a wholesaler-entered value with source + date,
//     never fetched by the platform.
//
// Florida only. A state joins this enricher only after its real
// parcel service is verified live (see lib/parcel-sources.ts).

import {
  FL_CADASTRAL_QUERY_URL,
  ROLL_COUNTY_CODE_OFFSET,
  countyByCode,
} from './property-lookup';

export const PARCEL_ENRICH_MAX_IDS = 50;

// Mailing fields on the statewide roll, verified from the
// service's own field list (see lib/corporate-buyers.ts and
// lib/state-records.ts): OWN_ADDR1 / OWN_ADDR2 street lines,
// OWN_CITY, OWN_STATE (some layers spell it OWN_STATE_), and
// OWN_ZIPCD. PHY_ADDR1 is the property (situs) street address.
export const PARCEL_ENRICH_OUT_FIELDS = [
  'PARCEL_ID',
  'OWN_NAME',
  'OWN_ADDR1',
  'OWN_ADDR2',
  'OWN_CITY',
  'OWN_STATE',
  'OWN_STATE_',
  'OWN_ZIPCD',
  'PHY_ADDR1',
  'JV',
  'CO_NO',
].join(',');

export interface EnrichedParcelRow {
  parcelId: string;
  matched: boolean;
  status: 'matched' | 'no match found';
  duplicate: boolean;
  ownerName: string | null;
  propertyAddress: string | null;
  mailingAddress: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
  justValue: number | null;
  county: string | null;
  countyCode: number | null;
}

export interface EnrichFlParcelsResult {
  rows: EnrichedParcelRow[];
  requested: number;
  matched: number;
  unmatched: number;
  duplicates: number;
}

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const n = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : parseFloat(s(v).replace(/[$,]/g, ''));
  return Number.isFinite(x) ? x : null;
};

// Split pasted input on commas and/or line breaks, collapse the
// doubled internal spaces the roll sometimes stores (Slice 104
// lesson), drop empties. Returns the IDs in paste order, WITH
// repeats kept — the caller counts repeats for the duplicate flag.
export function parseParcelIdInput(raw: string): string[] {
  return raw
    .split(/[,\n\r]+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0);
}

function mapEnrichFeature(attrs: Record<string, unknown>): EnrichedParcelRow | null {
  const parcelId = s(attrs.PARCEL_ID).replace(/\s+/g, ' ').trim();
  if (!parcelId) return null;
  const coNo = n(attrs.CO_NO);
  const county = coNo !== null ? countyByCode(Math.round(coNo) - ROLL_COUNTY_CODE_OFFSET) : undefined;
  const mailingStreet = [s(attrs.OWN_ADDR1).trim(), s(attrs.OWN_ADDR2).trim()].filter(Boolean).join(' ');
  const zipRaw = s(attrs.OWN_ZIPCD).trim();
  return {
    parcelId,
    matched: true,
    status: 'matched',
    duplicate: false,
    ownerName: s(attrs.OWN_NAME).trim() || null,
    propertyAddress: s(attrs.PHY_ADDR1).trim() || null,
    mailingAddress: mailingStreet || null,
    mailingCity: s(attrs.OWN_CITY).trim() || null,
    mailingState: (s(attrs.OWN_STATE_).trim() || s(attrs.OWN_STATE).trim()) || null,
    mailingZip: zipRaw ? zipRaw.slice(0, 5) : null,
    justValue: n(attrs.JV),
    county: county?.name || null,
    countyCode: county?.code ?? null,
  };
}

export async function enrichFlParcels(
  parcelIds: string[],
  signal?: AbortSignal,
): Promise<EnrichFlParcelsResult> {
  const cleaned = parcelIds.map((id) => id.replace(/\s+/g, ' ').trim()).filter((id) => id.length > 0);
  if (cleaned.length === 0) {
    throw new Error('Paste at least one parcel ID.');
  }
  if (cleaned.length > PARCEL_ENRICH_MAX_IDS) {
    throw new Error(`Paste at most ${PARCEL_ENRICH_MAX_IDS} parcel IDs — ${cleaned.length} were pasted. Split the list and run it in batches.`);
  }

  // Count repeats in the paste BEFORE querying: a repeated ID is
  // a duplicate even if the roll returns exactly one row for it.
  const requestCounts = new Map<string, number>();
  for (const id of cleaned) {
    const key = id.toUpperCase();
    requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  }
  const uniqueIds = [...new Set(cleaned.map((id) => id.toUpperCase()))].map(
    (upper) => cleaned.find((id) => id.toUpperCase() === upper) as string,
  );

  // PARCEL_ID is a text field: quote every value, escape an
  // embedded single-quote by doubling it. An unquoted IN list is
  // the known bug — it matches nothing.
  const quoted = uniqueIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
  const where = `PARCEL_ID IN (${quoted})`;
  const qs = new URLSearchParams({
    where,
    outFields: PARCEL_ENRICH_OUT_FIELDS,
    // One row per ID is the norm, but one ID can match several
    // roll rows — ask for enough headroom to see them all.
    resultRecordCount: '500',
    returnGeometry: 'false',
    f: 'json',
  });
  const res = await fetch(`${FL_CADASTRAL_QUERY_URL}?${qs.toString()}`, { signal });
  if (!res.ok) throw new Error(`The Florida cadastral service refused the request (HTTP ${res.status}).`);
  const body = (await res.json().catch(() => null)) as {
    features?: { attributes?: Record<string, unknown> }[];
    error?: { message?: string };
  } | null;
  if (!body) throw new Error('The Florida cadastral service answered with nothing readable.');
  if (body.error) {
    throw new Error(`The Florida cadastral service answered: “${body.error.message || 'invalid query'}”`);
  }

  const matchedRows: EnrichedParcelRow[] = [];
  for (const f of Array.isArray(body.features) ? body.features : []) {
    if (!f || typeof f !== 'object' || !f.attributes) continue;
    const row = mapEnrichFeature(f.attributes);
    if (row) matchedRows.push(row);
  }

  // Count roll rows per parcel ID: more than one row for an ID is
  // a duplicate, flagged on every row for that ID.
  const rowCounts = new Map<string, number>();
  for (const row of matchedRows) {
    const key = row.parcelId.toUpperCase();
    rowCounts.set(key, (rowCounts.get(key) || 0) + 1);
  }

  const rows: EnrichedParcelRow[] = [];
  const seenMatched = new Set<string>();
  for (const id of cleaned) {
    const key = id.toUpperCase();
    const matches = matchedRows.filter((r) => r.parcelId.toUpperCase() === key);
    if (matches.length === 0) {
      // No match — an honest row, not an error, and the batch
      // keeps going. A repeated no-match ID is still a duplicate.
      rows.push({
        parcelId: id,
        matched: false,
        status: 'no match found',
        duplicate: (requestCounts.get(key) || 0) > 1,
        ownerName: null,
        propertyAddress: null,
        mailingAddress: null,
        mailingCity: null,
        mailingState: null,
        mailingZip: null,
        justValue: null,
        county: null,
        countyCode: null,
      });
      continue;
    }
    for (const m of matches) {
      const dup =
        (requestCounts.get(key) || 0) > 1 ||
        (rowCounts.get(key) || 0) > 1;
      rows.push({ ...m, duplicate: dup });
      seenMatched.add(key);
    }
  }
  // Defensive: a roll row whose parcel ID differs from every
  // requested ID only by case/spacing is already covered by the
  // case-insensitive match above; nothing is dropped silently —
  // any matched row not yet emitted (should not happen) is
  // appended so the service's answer is never hidden.
  for (const m of matchedRows) {
    if (!seenMatched.has(m.parcelId.toUpperCase())) {
      rows.push({ ...m, duplicate: true });
    }
  }

  const matched = rows.filter((r) => r.matched).length;
  return {
    rows,
    requested: cleaned.length,
    matched,
    unmatched: rows.filter((r) => !r.matched).length,
    duplicates: rows.filter((r) => r.duplicate).length,
  };
}
