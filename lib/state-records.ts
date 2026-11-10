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

export type StateSearchMode = 'owner' | 'parcel';

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
  return null;
  // DELIBERATELY no address/city/ZIP modes (Nov 10, 2026): three
  // query shapes were tried live against this layer — contains,
  // equality, and prefix — and every search on the physical
  // address/city/ZIP fields ground past 60 seconds without
  // answering, while owner-name and parcel-ID searches return in
  // seconds. On the statewide roll only OWN_NAME and PARCEL_ID
  // are indexed; the roll is a WHO-owns-it and WHAT-is-this-parcel
  // book, not a browse-by-address book. Address lookups belong to
  // the county property appraisers — the platform's county doors
  // in the same view exist for exactly that, and the panel copy
  // says so. Modes that time out do not ship.
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

// ---------------------------------------------------------------------------
// Slice 106 — the panel goes multi-state. Each state is an "engine":
// its own official service, its own field names, its own where-clause
// builder and mapper, behind the one StateRecord shape. A state is
// added to this registry only after its terms have been READ and
// pass the gate (see ~/workspace/wholesaling-os/production/
// us-source-map-2026-11-10.md). Florida above is the first engine;
// Connecticut below is the second.

export type StateCode = 'FL' | 'CT';

export interface StateSourceInfo {
  code: StateCode;
  heading: string;
  sourceLine: string;
  listSource: string;
  blurb: string;
  valueLabel: string;
  verifyLine: string;
  yearNoun: string;
  emptyHint: string;
}

export const CT_RECORD_SOURCE =
  'Connecticut GIS Office (OPM) — Connecticut CAMA and Parcel Layer; town assessor data published by the state under CC0 (public domain)';

export const STATE_SOURCES: StateSourceInfo[] = [
  {
    code: 'FL',
    heading: 'Florida state records — live ownership lookup (all 67 counties)',
    sourceLine: STATE_RECORD_SOURCE,
    listSource: 'FDOR state records',
    blurb:
      'The Florida Department of Revenue publishes the statewide tax roll — owner of record, property and mailing address, parcel, values, last sale — for every county in one official service. Search it live here; add a result as a lead only when it earns a place in your pipeline. The roll is a yearly snapshot republished each August — the county property appraiser is the live record, so verify before you spend money. A public record is not consent: leads land with consent “unknown”. Search it the two ways the state’s index answers instantly: by owner name — everything a person or company owns, statewide — or by parcel ID, from any listing, letter, or county record. Looking up a street address instead? That is the county appraiser’s job, and your county doors are right below — the statewide service does not answer address searches in usable time, so this panel does not pretend to.',
    valueLabel: 'Just value',
    verifyLine: 'Verify at the county property appraiser before acting — the roll is a yearly snapshot.',
    yearNoun: 'roll',
    emptyHint:
      'Check the spelling — the roll stores owner names in capitals, and a company may be recorded under its entity name rather than a person’s.',
  },
  {
    code: 'CT',
    heading: 'Connecticut state records — live ownership lookup (all 169 towns)',
    sourceLine: CT_RECORD_SOURCE,
    listSource: 'Connecticut state records',
    blurb:
      'The Connecticut GIS Office publishes the statewide parcel and CAMA layer — owner of record, property and mailing address, parcel, assessed and appraised values, last sale — assembled from every town assessor in one official service, released under CC0 (public domain). Search it live here; add a result as a lead only when it earns a place in your pipeline. Towns submit their data to the state once a year, so the town assessor is the live record — verify before you spend money. A few towns suppress ownership entirely; their parcels show the owner as “Current Owner”. A public record is not consent: leads land with consent “unknown”. Search by owner name — everything a person or company owns, statewide — or by parcel ID from any listing, letter, or town record.',
    valueLabel: 'Appraised value',
    verifyLine: 'Verify with the town assessor before acting — towns submit this data to the state once a year.',
    yearNoun: 'collection',
    emptyHint:
      'Check the spelling — a company may be recorded under its entity name rather than a person’s, and a few towns suppress owner names entirely (shown as “Current Owner”).',
  },
];

const CT_OUT_FIELDS = [
  'Parcel_ID', 'Location_1', 'Location', 'Property_City', 'Town_Name', 'Property_Zip',
  'Owner', 'Co_Owner', 'Mailing_Address', 'Mailing_City', 'Mailing_State', 'Mailing_Zip',
  'Assessed_Total', 'Appraised_Land', 'Appraised_Building', 'Appraised_Outbuilding',
  'Living_Area', 'AYB', 'Sale_Price', 'Sale_Date', 'CAMA_Collection_Year', 'Valuation_Year',
];

// Same sanitizing as the Florida builder: uppercase, double the
// quotes, strip the LIKE wildcards so a search term can never
// become a pattern of the user's choosing.
function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/'/g, "''")
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

export function buildCtWhere(mode: StateSearchMode, raw: string): string | null {
  const q = sanitizeQuery(raw);
  if (mode === 'parcel') {
    if (q.replace(/[^A-Z0-9]/g, '').length < 4) return null;
    const tokens = q.split(' ').filter(Boolean);
    const like = `${tokens.join('%')}%`;
    return `Parcel_ID LIKE '${like}'`;
  }
  if (q.length < 3) return null;
  if (mode === 'owner') return `Owner LIKE '%${q}%'`;
  return null;
}

export function mapCtFeature(attrs: Record<string, unknown>): StateRecord | null {
  const address = s(attrs.Location_1) || s(attrs.Location);
  const parcelId = s(attrs.Parcel_ID).replace(/\s+/g, ' ');
  if (!address && !parcelId) return null;
  const owner = s(attrs.Owner);
  const coOwner = s(attrs.Co_Owner);
  const ownerName = owner && coOwner ? `${owner} & ${coOwner}` : owner || coOwner;
  const apprParts = [n(attrs.Appraised_Land), n(attrs.Appraised_Building), n(attrs.Appraised_Outbuilding)];
  let appraised: number | null = null;
  for (const p of apprParts) {
    if (p !== null) appraised = (appraised === null ? 0 : appraised) + p;
  }
  const saleDate = s(attrs.Sale_Date);
  const yearMatch = saleDate.match(/(19|20)\d{2}/);
  const saleYear = yearMatch ? parseInt(yearMatch[0], 10) : null;
  let saleMonth = '';
  const iso = saleDate.match(/^\d{4}-(\d{2})/);
  const us = saleDate.match(/^(\d{1,2})[/-]\d{1,2}[/-]\d{4}/);
  if (iso) saleMonth = iso[1];
  else if (us) saleMonth = us[1].length === 1 ? `0${us[1]}` : us[1];
  const ayb = n(attrs.AYB);
  const camaYear = n(attrs.CAMA_Collection_Year);
  const valYear = n(attrs.Valuation_Year);
  return {
    parcelId,
    ownerName,
    mailingAddress: s(attrs.Mailing_Address),
    mailingCity: s(attrs.Mailing_City),
    mailingState: s(attrs.Mailing_State),
    mailingZip: s(attrs.Mailing_Zip),
    address,
    city: s(attrs.Property_City) || s(attrs.Town_Name),
    zip: s(attrs.Property_Zip),
    justValue: appraised,
    assessedValue: n(attrs.Assessed_Total),
    yearBuilt: ayb !== null && ayb > 0 ? Math.round(ayb) : null,
    livingArea: n(attrs.Living_Area),
    salePrice: n(attrs.Sale_Price),
    saleYear,
    saleMonth,
    rollYear: camaYear !== null ? Math.round(camaYear) : valYear !== null ? Math.round(valYear) : null,
  };
}

export interface StateEngine {
  serviceUrl: string;
  outFields: string;
  buildWhere: (mode: StateSearchMode, raw: string) => string | null;
  mapFeature: (attrs: Record<string, unknown>) => StateRecord | null;
}

export const STATE_ENGINES: Record<StateCode, StateEngine> = {
  FL: {
    serviceUrl:
      'https://services9.arcgis.com/Gh9awoU677aKree0/ArcGIS/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    outFields: OUT_FIELDS.join(','),
    buildWhere: buildStateWhere,
    mapFeature: mapStateFeature,
  },
  CT: {
    serviceUrl:
      'https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/ArcGIS/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer/0/query',
    outFields: CT_OUT_FIELDS.join(','),
    buildWhere: buildCtWhere,
    mapFeature: mapCtFeature,
  },
};

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
