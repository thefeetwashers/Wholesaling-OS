// Slice 132 — Broward County Property Appraiser (BCPA) record.
//
// Source: the BCPA GIS REST service ALREADY recorded as verified
// in lib/property-lookup.ts (VERIFIED_COUNTY_PARCEL_SERVICES):
//   https://gisweb-adapters.bcpa.net/arcgis/rest/services/BCPA_EXTERNAL_JAN26/MapServer
// VERIFIED LIVE Nov 17, 2026:
//   * MapServer ?f=json lists layers incl. 16 "Parcels" and
//     yearly "Sales" layers, plus tables 36 BCPA_INFO and 37
//     BCPA_SALES. Capabilities Map,Query,Data.
//   * Table 37 BCPA_SALES fields, verified from live metadata:
//     FOLIO_NUMBER (string, 12), SALE_DATE (date, epoch ms),
//     SALE_AMOUNT (string, e.g. "$1,325,000"), SALE_VER,
//     SALE_YEAR. A live 1=1 query returned 2 real 2026 rows
//     (folio 474132030070, $1,325,000; folio 484223080010,
//     $520,000). The test folio 494125000190 (City of Lauderdale
//     Lakes) correctly returns NO sales — a city-owned parcel.
//   * Table 36 BCPA_INFO fields, verified from live metadata:
//     FOLIO_NUMBER, NAME_LINE_1 (owner name), USE_CODE,
//     JUST_BUILDING_VALUE, BLDG_ADJ_SQ_FOOTAGE, BLDG_YEAR_BUILT,
//     ACTUAL_YEAR_BUILT, BLDG_UNITS, SITUS_STREET_NUMBER /
//     DIRECTION / NAME / TYPE, SITUS_CITY, SITUS_ZIP_CODE,
//     LAND_GROSS. NOTE: BCPA_INFO carries NO owner mailing
//     address — only the situs (property) address. The mailing
//     address comes from the statewide cadastral roll (OWN_ADDR1)
//     where the roll has it.
// Deed history here = the BCPA_SALES rows for the folio: sale
// date + sale amount + sale year. SALE_VER is the county's sale
// verification code and is shown as returned, without
// interpretation. Only fields the live service returns are shown.
// Broward only (DOR county code 6). The folio is the 12-digit
// parcel number, the same format as the cadastral PARCEL_ID.

const BCPA_BASE =
  'https://gisweb-adapters.bcpa.net/arcgis/rest/services/BCPA_EXTERNAL_JAN26/MapServer';

const INFO_FIELDS = [
  'FOLIO_NUMBER',
  'NAME_LINE_1',
  'USE_CODE',
  'JUST_BUILDING_VALUE',
  'BLDG_ADJ_SQ_FOOTAGE',
  'BLDG_YEAR_BUILT',
  'ACTUAL_YEAR_BUILT',
  'BLDG_UNITS',
  'SITUS_STREET_NUMBER',
  'SITUS_STREET_DIRECTION',
  'SITUS_STREET_NAME',
  'SITUS_STREET_TYPE',
  'SITUS_CITY',
  'SITUS_ZIP_CODE',
  'LAND_GROSS',
].join(',');

const SALES_FIELDS = 'FOLIO_NUMBER,SALE_DATE,SALE_AMOUNT,SALE_VER,SALE_YEAR';

export interface BrowardOwnerProfile {
  folio: string;
  ownerName: string | null;
  useCode: string | null;
  justBuildingValue: number | null;
  buildingSqft: number | null;
  yearBuilt: number | null;
  actualYearBuilt: string | null;
  units: number | null;
  situsAddress: string | null;
  situsCity: string | null;
  situsZip: string | null;
  landGross: string | null;
}

export interface BrowardSale {
  folio: string;
  saleDate: string | null;
  saleAmount: number | null;
  saleAmountRaw: string | null;
  saleVerification: string | null;
  saleYear: string | null;
}

export interface BrowardRecord {
  info: BrowardOwnerProfile | null;
  sales: BrowardSale[];
}

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const n = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : parseFloat(s(v).replace(/[$,]/g, ''));
  return Number.isFinite(x) ? x : null;
};

async function bcpaQuery(
  layerOrTable: number,
  where: string,
  outFields: string,
  orderBy: string | undefined,
  signal?: AbortSignal
): Promise<{ attributes?: Record<string, unknown> }[]> {
  const qs = new URLSearchParams({
    where,
    outFields,
    resultRecordCount: '10',
    returnGeometry: 'false',
    f: 'json',
  });
  if (orderBy) qs.set('orderByFields', orderBy);
  const res = await fetch(`${BCPA_BASE}/${layerOrTable}/query?${qs.toString()}`, { signal });
  const body = (await res.json().catch(() => null)) as {
    features?: { attributes?: Record<string, unknown> }[];
    error?: { message?: string };
  } | null;
  if (!res.ok) {
    throw new Error(
      (body?.error?.message && `Broward County appraiser answered: ${body.error.message}`) ||
        `Broward County appraiser refused the request (HTTP ${res.status}).`
    );
  }
  if (!body) throw new Error('Broward County appraiser answered with nothing readable.');
  if (body.error) throw new Error(`Broward County appraiser answered: ${body.error.message || 'invalid query'}`);
  return Array.isArray(body.features) ? body.features : [];
}

export async function fetchBrowardRecord(
  folio: string,
  signal?: AbortSignal
): Promise<BrowardRecord> {
  const clean = (folio || '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('A folio (parcel) number is needed for the Broward record.');
  const escaped = clean.replace(/'/g, "''");
  const where = `FOLIO_NUMBER = '${escaped}'`;
  const [infoRows, saleRows] = await Promise.all([
    bcpaQuery(36, where, INFO_FIELDS, undefined, signal),
    bcpaQuery(37, where, SALES_FIELDS, 'SALE_DATE DESC', signal),
  ]);
  const a = infoRows[0]?.attributes;
  let info: BrowardOwnerProfile | null = null;
  if (a && s(a.FOLIO_NUMBER)) {
    const situs = [s(a.SITUS_STREET_NUMBER), s(a.SITUS_STREET_DIRECTION), s(a.SITUS_STREET_NAME), s(a.SITUS_STREET_TYPE)]
      .filter(Boolean)
      .join(' ');
    info = {
      folio: s(a.FOLIO_NUMBER),
      ownerName: s(a.NAME_LINE_1).trim() || null,
      useCode: s(a.USE_CODE).trim() || null,
      justBuildingValue: n(a.JUST_BUILDING_VALUE),
      buildingSqft: n(a.BLDG_ADJ_SQ_FOOTAGE),
      yearBuilt: n(a.BLDG_YEAR_BUILT),
      actualYearBuilt: s(a.ACTUAL_YEAR_BUILT).trim() || null,
      units: n(a.BLDG_UNITS),
      situsAddress: situs || null,
      situsCity: s(a.SITUS_CITY).trim() || null,
      situsZip: s(a.SITUS_ZIP_CODE).trim() || null,
      landGross: s(a.LAND_GROSS).trim() || null,
    };
  }
  const sales: BrowardSale[] = saleRows
    .map((f) => f.attributes || {})
    .filter((r) => s(r.FOLIO_NUMBER))
    .map((r) => {
      const ms = typeof r.SALE_DATE === 'number' ? r.SALE_DATE : n(r.SALE_DATE);
      return {
        folio: s(r.FOLIO_NUMBER),
        saleDate: ms !== null && ms > 0 ? new Date(ms).toISOString().slice(0, 10) : null,
        saleAmount: n(r.SALE_AMOUNT),
        saleAmountRaw: s(r.SALE_AMOUNT).trim() || null,
        saleVerification: s(r.SALE_VER).trim() || null,
        saleYear: s(r.SALE_YEAR).trim() || null,
      };
    });
  return { info, sales };
}
