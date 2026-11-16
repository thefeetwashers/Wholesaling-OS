// Slice 123 — Property lookup helpers (server-side only).
// Two live sources, Florida only, nothing invented:
//   Mode A — a street address goes to the U.S. Census geocoder
//   (free, no key). The Census service sends NO CORS headers, so
//   the browser must never call it directly — only the
//   /api/property-lookup route does.
//   Mode B — a parcel ID + Florida county code goes to the Florida
//   Statewide Cadastral roll (FDOR Property Tax Oversight, the same
//   official service the State Records panel already queries).
//   The roll is a yearly snapshot published each August — it lags
//   the county appraiser, and the UI says so wherever a roll year
//   is shown.
//
// Registry rule: a state or county joins this registry only after
// its real service URL is verified live. Florida is the only state
// here. Texas has NO statewide parcel server (county-level only)
// and is not claimed to have one.

export type LookupSource = 'census' | 'fl_cadastral';

export interface PropertyLookupResult {
  source: LookupSource;
  // Situs (property) facts.
  address: string;
  city?: string;
  state: string;
  zip?: string;
  county?: string;
  countyCode?: number;
  parcelId?: string;
  // Owner facts from the roll (Mode B only).
  ownerName?: string;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  // Value facts from the roll (Mode B only).
  justValue?: number | null;
  landValue?: number | null;
  dorUseCode?: string;
  yearBuilt?: number | null;
  rollYear?: number | null;
  // Geocode facts (Mode A only).
  lat?: number;
  lng?: number;
  censusCountyFips?: string;
  matchedAddress?: string;
}

// Florida DOR county codes (CO_NO), 1–67. The codes follow the
// numbering the Department of Revenue assigned — alphabetical by
// the county's name AT THE TIME, so Miami-Dade is 13 (it was
// "Dade"), St. Johns is 55, St. Lucie 56, Santa Rosa 57. The ten
// codes the build brief verified are exactly these; the rest
// follow the same published sequence. Do NOT compute a code from
// a name by counting the modern alphabetical list — that puts
// Miami-Dade at 42 and is wrong.
export interface FloridaCountyEntry {
  name: string;
  code: number;
  // Census county FIPS (state 12 + county). Only the ten the build
  // brief verified are filled in; the rest are null — never guessed.
  // A null here does NOT block an address lookup: the Census
  // geocoder returns the county FIPS itself for any address.
  fips: string | null;
}

export const FLORIDA_COUNTIES: FloridaCountyEntry[] = [
  { name: 'Alachua', code: 1, fips: null },
  { name: 'Baker', code: 2, fips: null },
  { name: 'Bay', code: 3, fips: null },
  { name: 'Bradford', code: 4, fips: null },
  { name: 'Brevard', code: 5, fips: null },
  { name: 'Broward', code: 6, fips: '12011' },
  { name: 'Calhoun', code: 7, fips: null },
  { name: 'Charlotte', code: 8, fips: '12015' },
  { name: 'Citrus', code: 9, fips: null },
  { name: 'Clay', code: 10, fips: null },
  { name: 'Collier', code: 11, fips: null },
  { name: 'Columbia', code: 12, fips: null },
  { name: 'Miami-Dade', code: 13, fips: '12086' },
  { name: 'DeSoto', code: 14, fips: null },
  { name: 'Dixie', code: 15, fips: null },
  { name: 'Duval', code: 16, fips: null },
  { name: 'Escambia', code: 17, fips: null },
  { name: 'Flagler', code: 18, fips: null },
  { name: 'Franklin', code: 19, fips: null },
  { name: 'Gadsden', code: 20, fips: null },
  { name: 'Gilchrist', code: 21, fips: null },
  { name: 'Glades', code: 22, fips: null },
  { name: 'Gulf', code: 23, fips: null },
  { name: 'Hamilton', code: 24, fips: null },
  { name: 'Hardee', code: 25, fips: null },
  { name: 'Hendry', code: 26, fips: null },
  { name: 'Hernando', code: 27, fips: null },
  { name: 'Highlands', code: 28, fips: null },
  { name: 'Hillsborough', code: 29, fips: '12057' },
  { name: 'Holmes', code: 30, fips: null },
  { name: 'Indian River', code: 31, fips: '12061' },
  { name: 'Jackson', code: 32, fips: null },
  { name: 'Jefferson', code: 33, fips: null },
  { name: 'Lafayette', code: 34, fips: null },
  { name: 'Lake', code: 35, fips: null },
  { name: 'Lee', code: 36, fips: '12071' },
  { name: 'Leon', code: 37, fips: null },
  { name: 'Levy', code: 38, fips: null },
  { name: 'Liberty', code: 39, fips: null },
  { name: 'Madison', code: 40, fips: null },
  { name: 'Manatee', code: 41, fips: null },
  { name: 'Marion', code: 42, fips: null },
  { name: 'Martin', code: 43, fips: '12085' },
  { name: 'Monroe', code: 44, fips: null },
  { name: 'Nassau', code: 45, fips: null },
  { name: 'Okaloosa', code: 46, fips: null },
  { name: 'Okeechobee', code: 47, fips: null },
  { name: 'Orange', code: 48, fips: '12095' },
  { name: 'Osceola', code: 49, fips: null },
  { name: 'Palm Beach', code: 50, fips: '12099' },
  { name: 'Pasco', code: 51, fips: null },
  { name: 'Pinellas', code: 52, fips: null },
  { name: 'Polk', code: 53, fips: null },
  { name: 'Putnam', code: 54, fips: null },
  { name: 'St. Johns', code: 55, fips: null },
  { name: 'St. Lucie', code: 56, fips: '12111' },
  { name: 'Santa Rosa', code: 57, fips: null },
  { name: 'Sarasota', code: 58, fips: null },
  { name: 'Seminole', code: 59, fips: null },
  { name: 'Sumter', code: 60, fips: null },
  { name: 'Suwannee', code: 61, fips: null },
  { name: 'Taylor', code: 62, fips: null },
  { name: 'Union', code: 63, fips: null },
  { name: 'Volusia', code: 64, fips: null },
  { name: 'Wakulla', code: 65, fips: null },
  { name: 'Walton', code: 66, fips: null },
  { name: 'Washington', code: 67, fips: null },
];

export function countyByCode(code: number): FloridaCountyEntry | undefined {
  return FLORIDA_COUNTIES.find((c) => c.code === code);
}

export function countyByName(name: string): FloridaCountyEntry | undefined {
  const n = name.trim().toLowerCase();
  return FLORIDA_COUNTIES.find((c) => c.name.toLowerCase() === n);
}

// The 70% rule / MAO calculator takes House or Land. The DOR use
// code (DOR_UC) decides it, conservatively: 0000 is vacant land,
// 01xx is single-family residential, and anything else gets NO
// auto-select — the wholesaler picks, rather than the platform
// guessing a property type from a code it does not understand.
export function dorUcKind(dorUc: string | undefined | null): 'house' | 'land' | null {
  const code = (dorUc || '').trim();
  if (!code) return null;
  if (code === '0000') return 'land';
  if (/^01/.test(code)) return 'house';
  return null;
}

// Handoff to the Deal Analyzer (lib/mao.ts): a lookup result can
// fill the 70% rule / MAO calculator — ARV from the roll's just
// value, House/Land from the DOR use code. Same pattern as the
// Repair Estimator's saved total: a localStorage key the analyzer
// reads on mount, plus a live window event when it is mounted.
export const PROPERTY_LOOKUP_MAO_KEY = 'ws_property_lookup_mao';
export const PROPERTY_LOOKUP_MAO_EVENT = 'ws-property-lookup';
export interface LookupMaoLoad { arv: number; kind: 'house' | 'land'; at: string }

export const CENSUS_GEOCODER_URL =
  'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

export const FL_CADASTRAL_QUERY_URL =
  'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query';

export const FL_CADASTRAL_OUT_FIELDS = [
  'PARCEL_ID', 'OWN_NAME', 'OWN_ADDR1', 'PHY_ADDR1', 'JV', 'CO_NO', 'DOR_UC', 'ACT_YR_BLT', 'LND_VAL',
].join(',');

// Slice 126 — the roll's CO_NO is NOT the DOR county code: it is
// the DOR code + 10, uniformly. Verified live against the real
// service on Nov 15, 2026: a point query at the office address
// (4848 NW 24th Court, Lauderdale Lakes — Broward, DOR 6)
// returned a parcel with CO_NO 16; a Fort Pierce parcel (St.
// Lucie, DOR 56) carries CO_NO 66; CO_NO = 6 has ZERO records in
// the roll while CO_NO = 16 has 766,749; and the counts for roll
// codes 23 (Miami-Dade, DOR 13), 26 (Duval, DOR 16), 39
// (Hillsborough, DOR 29), 58 (Orange, DOR 48) and 60 (Palm Beach,
// DOR 50) all match those counties' parcel sizes. The DOR
// registry above stays 1–67 — only the roll's field is offset —
// so queries ADD the offset and returned records SUBTRACT it.
export const ROLL_COUNTY_CODE_OFFSET = 10;

// Verified-live county parcel services, available for future
// per-county enrichment. NOT wired into the lookup route in this
// slice — the route uses the statewide roll (Mode B) so every
// county answers the same way. A county joins the route only when
// its service is verified live; these three are.
export const VERIFIED_COUNTY_PARCEL_SERVICES: { county: string; serviceUrl: string }[] = [
  { county: 'Miami-Dade', serviceUrl: 'https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/26' },
  { county: 'Broward', serviceUrl: 'https://gisweb-adapters.bcpa.net/arcgis/rest/services/BCPA_EXTERNAL_JAN26/MapServer/16' },
  { county: 'Hillsborough', serviceUrl: 'https://gis.hcpafl.org/arcgis/rest/services/Webmaps/HillsboroughFL_WebParcels/' },
];

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const n = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : parseFloat(s(v).replace(/[$,]/g, ''));
  return Number.isFinite(x) ? x : null;
};

export interface CensusGeocode {
  matchedAddress: string;
  lat: number;
  lng: number;
  countyName: string | null;
  countyFips: string | null;
  stateFips: string | null;
}

export async function geocodeAddress(address: string, signal?: AbortSignal): Promise<CensusGeocode | null> {
  const qs = new URLSearchParams({
    address: address.trim(),
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    format: 'json',
  });
  const res = await fetch(`${CENSUS_GEOCODER_URL}?${qs.toString()}`, { signal });
  if (!res.ok) throw new Error(`Census geocoder refused the request (HTTP ${res.status}).`);
  const body = (await res.json().catch(() => null)) as {
    result?: {
      addressMatches?: {
        matchedAddress?: string;
        coordinates?: { x?: number; y?: number };
        geographies?: {
          Counties?: { NAME?: string; STATE?: string; COUNTY?: string }[];
        };
      }[];
    };
  } | null;
  const match = body?.result?.addressMatches?.[0];
  if (!match || !match.coordinates || typeof match.coordinates.x !== 'number' || typeof match.coordinates.y !== 'number') {
    return null;
  }
  const county = match.geographies?.Counties?.[0];
  return {
    matchedAddress: s(match.matchedAddress),
    lat: match.coordinates.y,
    lng: match.coordinates.x,
    countyName: county ? s(county.NAME) || null : null,
    countyFips: county && county.STATE && county.COUNTY ? `${county.STATE}${county.COUNTY}` : null,
    stateFips: county ? s(county.STATE) || null : null,
  };
}

export function mapCadastralFeature(attrs: Record<string, unknown>): PropertyLookupResult | null {
  const parcelId = s(attrs.PARCEL_ID).replace(/\s+/g, ' ').trim();
  const address = s(attrs.PHY_ADDR1).trim();
  if (!address && !parcelId) return null;
  const coNo = n(attrs.CO_NO);
  // Slice 126 — the roll's CO_NO is the DOR code + 10, so a
  // returned record's county is found by subtracting the offset
  // (a Broward parcel arrives with CO_NO 16, not 6; reading it
  // as a DOR code would label it Duval).
  const county = coNo !== null ? countyByCode(Math.round(coNo) - ROLL_COUNTY_CODE_OFFSET) : undefined;
  const jv = n(attrs.JV);
  const lnd = n(attrs.LND_VAL);
  const yr = n(attrs.ACT_YR_BLT);
  return {
    source: 'fl_cadastral',
    address,
    state: 'FL',
    county: county?.name,
    countyCode: county?.code,
    parcelId,
    ownerName: s(attrs.OWN_NAME).trim() || undefined,
    mailingAddress: s(attrs.OWN_ADDR1).trim() || undefined,
    justValue: jv,
    landValue: lnd,
    dorUseCode: s(attrs.DOR_UC).trim() || undefined,
    yearBuilt: yr !== null && yr > 0 ? Math.round(yr) : null,
    rollYear: null,
  };
}

export async function lookupFlParcel(
  parcelId: string,
  countyCode: number,
  signal?: AbortSignal,
): Promise<PropertyLookupResult[]> {
  // The roll stores some IDs with doubled internal spaces (Slice 104
  // lesson) — collapse whitespace first, then try the ID as typed.
  const collapsed = parcelId.replace(/\s+/g, ' ').trim();
  const tries = collapsed === parcelId.trim() ? [collapsed] : [collapsed, parcelId.trim()];
  const seen = new Set<string>();
  const out: PropertyLookupResult[] = [];
  for (const id of tries) {
    const escaped = id.replace(/'/g, "''");
    // Slice 126 — the roll's CO_NO is the DOR code + 10 (see
    // ROLL_COUNTY_CODE_OFFSET): querying the DOR code itself
    // returns nothing for every county.
    const where = `PARCEL_ID = '${escaped}' AND CO_NO = ${countyCode + ROLL_COUNTY_CODE_OFFSET}`;
    const qs = new URLSearchParams({
      where,
      outFields: FL_CADASTRAL_OUT_FIELDS,
      resultRecordCount: '25',
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
    for (const f of Array.isArray(body.features) ? body.features : []) {
      if (!f || typeof f !== 'object' || !f.attributes) continue;
      const rec = mapCadastralFeature(f.attributes);
      if (!rec) continue;
      const key = `${rec.parcelId}|${rec.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // The roll year is the assessment year on the record; the
      // cadastral outFields in this route do not carry it, so the
      // record is stamped with the roll's known cadence instead of
      // a guessed year (see the route's provenance line).
      out.push(rec);
      if (out.length >= 25) break;
    }
    if (out.length > 0) break;
  }
  return out;
}
