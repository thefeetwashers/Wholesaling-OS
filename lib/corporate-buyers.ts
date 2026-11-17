// Slice 132 — "Find recent corporate buyers" RESEARCH lookup.
//
// A live query against the Florida Statewide Cadastral roll (the
// same services9 FeatureServer as Mode B):
//   county via the translated roll code (DOR + 10 —
//   ROLL_COUNTY_CODE_OFFSET, Slice 126) + SALE_YR1 >= chosen year
//   + SALE_PRC1 >= chosen price + OWN_NAME LIKE LLC / INC /
//   TRUST / LP, ORDER BY SALE_PRC1 DESC, 25 rows.
// Fields VERIFIED LIVE Nov 17, 2026 from the service metadata
// (use only these): SALE_PRC1, SALE_YR1, SALE_MO1, SALE_PRC2/YR2,
// OWN_NAME/ADDR1/ADDR2/CITY/STATE/ZIPCD,
// PHY_ADDR1/ADDR2/CITY/ZIPCD, EFF_YR_BLT, ACT_YR_BLT, TOT_LVG_AR,
// JV, CO_NO, DOR_UC, LND_VAL. Geometry is esriGeometryPolygon.
// (An earlier direct verification of this exact query timed out
// in the fetch tool — a broad LIKE scan — and the retry was
// barred; the field list itself was then verified from the live
// service metadata, and the route quotes any service error
// verbatim instead of returning rows it did not get.)
//
// HARD RULE — this is RESEARCH, not a buyer list. An LLC owning a
// property is NOT a buyer who consented to be contacted. Results
// are NEVER written into the buyers database, never bulk-harvested
// across counties, never auto-emailed or auto-messaged. The UI
// carries this exact wording: "Property owners found in public
// records — not opted-in buyers. Contact respectfully once, and
// add to your buyers list only if they agree." The Sunbiz
// link-out is manual only (verified live Nov 17:
// https://search.sunbiz.org/Inquiry/CorporationSearch/ByName — a
// form the user types the name into; no deep link exists).

import { FL_CADASTRAL_QUERY_URL, ROLL_COUNTY_CODE_OFFSET, countyByCode } from './property-lookup';

export interface CorporateBuyerRow {
  parcelId: string | null;
  ownerName: string | null;
  mailingAddress: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyZip: string | null;
  salePrice: number | null;
  saleYear: number | null;
  saleMonth: number | null;
  livingArea: number | null;
  yearBuilt: number | null;
  justValue: number | null;
}

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const n = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : parseFloat(s(v).replace(/[$,]/g, ''));
  return Number.isFinite(x) ? x : null;
};

const RESEARCH_FIELDS = [
  'PARCEL_ID',
  'OWN_NAME',
  'OWN_ADDR1',
  'OWN_ADDR2',
  'OWN_CITY',
  'OWN_STATE',
  'OWN_ZIPCD',
  'PHY_ADDR1',
  'PHY_ADDR2',
  'PHY_CITY',
  'PHY_ZIPCD',
  'SALE_PRC1',
  'SALE_YR1',
  'SALE_MO1',
  'TOT_LVG_AR',
  'EFF_YR_BLT',
  'JV',
].join(',');

export async function findRecentCorporateBuyers(
  countyCode: number,
  minYear: number,
  minPrice: number,
  signal?: AbortSignal
): Promise<CorporateBuyerRow[]> {
  if (!Number.isInteger(countyCode) || countyCode < 1 || countyCode > 67) {
    throw new Error('Pick a Florida county (DOR code 1–67) for the research lookup.');
  }
  if (!Number.isInteger(minYear) || minYear < 1900 || minYear > 2100) {
    throw new Error('Pick a sale year between 1900 and 2100.');
  }
  if (!Number.isFinite(minPrice) || minPrice < 0) {
    throw new Error('Pick a minimum sale price of $0 or more.');
  }
  const county = countyByCode(countyCode);
  if (!county) throw new Error('That county code is not a Florida county.');
  const where =
    `CO_NO = ${countyCode + ROLL_COUNTY_CODE_OFFSET} AND SALE_YR1 >= ${minYear} AND SALE_PRC1 >= ${Math.round(minPrice)} ` +
    `AND (OWN_NAME LIKE '%LLC%' OR OWN_NAME LIKE '%INC%' OR OWN_NAME LIKE '%TRUST%' OR OWN_NAME LIKE '% LP%')`;
  const qs = new URLSearchParams({
    where,
    outFields: RESEARCH_FIELDS,
    orderByFields: 'SALE_PRC1 DESC',
    resultRecordCount: '25',
    returnGeometry: 'false',
    f: 'json',
  });
  const res = await fetch(`${FL_CADASTRAL_QUERY_URL}?${qs.toString()}`, { signal });
  const body = (await res.json().catch(() => null)) as {
    features?: { attributes?: Record<string, unknown> }[];
    error?: { message?: string };
  } | null;
  if (!res.ok) {
    throw new Error(
      (body?.error?.message && `The Florida cadastral service answered: ${body.error.message}`) ||
        `The Florida cadastral service refused the request (HTTP ${res.status}).`
    );
  }
  if (!body) throw new Error('The Florida cadastral service answered with nothing readable.');
  if (body.error) throw new Error(`The Florida cadastral service answered: ${body.error.message || 'invalid query'}`);
  return (Array.isArray(body.features) ? body.features : [])
    .map((f) => f.attributes || {})
    .map((a) => {
      const mailing = [s(a.OWN_ADDR1), s(a.OWN_ADDR2)].filter(Boolean).join(' ');
      const property = [s(a.PHY_ADDR1), s(a.PHY_ADDR2)].filter(Boolean).join(' ');
      return {
        parcelId: s(a.PARCEL_ID).trim() || null,
        ownerName: s(a.OWN_NAME).trim() || null,
        mailingAddress: mailing || null,
        mailingCity: s(a.OWN_CITY).trim() || null,
        mailingState: s(a.OWN_STATE).trim() || null,
        mailingZip: s(a.OWN_ZIPCD).trim() || null,
        propertyAddress: property || null,
        propertyCity: s(a.PHY_CITY).trim() || null,
        propertyZip: s(a.PHY_ZIPCD).trim() || null,
        salePrice: n(a.SALE_PRC1),
        saleYear: n(a.SALE_YR1),
        saleMonth: n(a.SALE_MO1),
        livingArea: n(a.TOT_LVG_AR),
        yearBuilt: n(a.EFF_YR_BLT),
        justValue: n(a.JV),
      } as CorporateBuyerRow;
    });
}
