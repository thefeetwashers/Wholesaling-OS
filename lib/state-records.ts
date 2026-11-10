// Slice 104 — Florida state records: the FDOR statewide cadastral
// layer, mapped into the app's shape. The data is the Florida
// property tax roll — public records under Ch. 119, Fla. Stat. —
// submitted by all 67 county property appraisers to the Florida
// Department of Revenue (Property Tax Oversight) and republished by
// the state as a public ArcGIS service every August. The app runs a
// LIVE LOOKUP against that service (see app/api/state-records):
// nothing is bulk-copied, resold, or exported as a dataset, the
// source is credited on the panel, and every record carries its
// roll year because the roll is a yearly snapshot, not a live feed.

export interface StateRecord {
  parcelId: string;
  ownerName: string;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  address: string;
  city: string;
  zip: string;
  justValue: number | null;
  assessedValue: number | null;
  yearBuilt: number | null;
  livingArea: number | null;
  salePrice: number | null;
  saleYear: number | null;
  saleMonth: string;
  rollYear: number | null;
}

export type StateSearchMode = 'owner' | 'address' | 'parcel' | 'city';

export const STATE_RECORD_SOURCE =
  'Florida Department of Revenue — statewide cadastral roll (county property appraiser data, Ch. 119 public records)';

const OUT_FIELDS = [
  'PARCEL_ID', 'CO_NO', 'OWN_NAME', 'OWN_ADDR1', 'OWN_ADDR2', 'OWN_CITY', 'OWN_STATE_', 'OWN_ZIPCD',
  'PHY_ADDR1', 'PHY_ADDR2', 'PHY_CITY', 'PHY_ZIPCD', 'JV', 'AV_NSD', 'AV_SD', 'ACT_YR_BLT',
  'TOT_LVG_AR', 'SALE_PRC1', 'SALE_YR1', 'SALE_MO1', 'ASMNT_YR',
];

export function stateOutFields(): string {
  return OUT_FIELDS.join(',');
}

// Build the ArcGIS where clause for one search. The input is
// uppercased (the roll stores uppercase), single quotes are doubled
// (SQL escaping), and the LIKE wildcards % and _ are stripped so a
// search term can never become a pattern of the user's choosing.
export function buildStateWhere(mode: StateSearchMode, raw: string): string | null {
  const q = raw
    .trim()
    .toUpperCase()
    .replace(/'/g, "''")
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  if (mode === 'parcel') {
    if (q.replace(/[^A-Z0-9]/g, '').length < 4) return null;
    // The roll stores some parcel IDs with doubled spaces inside
    // ("311803  D0010"), so an exact match misses what the eye sees
    // as the same ID. Match token-by-token with % between the
    // tokens instead — whitespace-proof in both directions.
    const tokens = q.split(' ').filter(Boolean);
    const like = `${tokens.join('%')}%`;
    return `PARCEL_ID LIKE '${like}' OR PARCELNO LIKE '${like}'`;
  }
  if (q.length < 3) return null;
  if (mode === 'owner') return `OWN_NAME LIKE '%${q}%'`;
  if (mode === 'address') return `PHY_ADDR1 LIKE '%${q}%'`;
  return `PHY_CITY='${q}'`;
}

// NOTE (Nov 10, 2026): there is deliberately no server-side
// ordering helper anymore. Live probes proved the FDOR service
// rejects queries that carry the full field list TOGETHER WITH an
// orderByFields clause (generic 400 "Invalid query parameters"),
// while the same queries without it succeed — the route now sorts
// the ≤25 mapped records itself.

function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function n(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function zipOf(v: unknown): string {
  const num = n(v);
  return num !== null && num > 0 ? String(Math.round(num)) : '';
}

function joinLines(a: string, b: string): string {
  return [a, b].filter(Boolean).join(' ');
}

export function mapStateFeature(attrs: Record<string, unknown>): StateRecord | null {
  const address = joinLines(s(attrs.PHY_ADDR1), s(attrs.PHY_ADDR2));
  // Collapse the roll's doubled internal spaces so the ID a user
  // sees (and later types back into parcel search) is one clean
  // string.
  const parcelId = s(attrs.PARCEL_ID).replace(/\s+/g, ' ');
  if (!address && !parcelId) return null;
  const avNsd = n(attrs.AV_NSD);
  const avSd = n(attrs.AV_SD);
  const yr = n(attrs.ACT_YR_BLT);
  return {
    parcelId,
    ownerName: s(attrs.OWN_NAME),
    mailingAddress: joinLines(s(attrs.OWN_ADDR1), s(attrs.OWN_ADDR2)),
    mailingCity: s(attrs.OWN_CITY),
    mailingState: s(attrs.OWN_STATE_) || s(attrs.OWN_STATE),
    mailingZip: zipOf(attrs.OWN_ZIPCD),
    address,
    city: s(attrs.PHY_CITY),
    zip: zipOf(attrs.PHY_ZIPCD),
    justValue: n(attrs.JV),
    assessedValue: avNsd !== null ? avNsd : avSd,
    yearBuilt: yr !== null && yr > 0 ? Math.round(yr) : null,
    livingArea: n(attrs.TOT_LVG_AR),
    salePrice: n(attrs.SALE_PRC1),
    saleYear: n(attrs.SALE_YR1),
    saleMonth: s(attrs.SALE_MO1),
    rollYear: n(attrs.ASMNT_YR),
  };
}
