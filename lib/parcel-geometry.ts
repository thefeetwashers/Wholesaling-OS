// Slice 132 — parcel boundary geometry from the Florida
// Statewide Cadastral roll.
//
// Same service as Mode B (lib/property-lookup.ts):
//   https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query
// VERIFIED LIVE Nov 17, 2026: a query for parcel 494125000190
// with returnGeometry=true returned geometryType
// esriGeometryPolygon with real rings; the same query with
// outSR=4326 returned the rings reprojected to WGS84 longitude /
// latitude (e.g. [-80.2130321497586, 26.1569328587499]) — so the
// map draws the polygon directly, with no projection math in the
// app. The roll's CO_NO is the DOR county code + 10
// (ROLL_COUNTY_CODE_OFFSET), exactly as Slice 126 does — the
// query translates the DOR code before sending it.
// The polygon is drawn ONLY if the live response actually returns
// geometry; a parcel with no geometry returns { rings: null } and
// the map shows a marker only (or nothing, if no point exists).
// Never fake a boundary.

import { FL_CADASTRAL_QUERY_URL, ROLL_COUNTY_CODE_OFFSET } from './property-lookup';

export interface ParcelBoundary {
  parcelId: string;
  // Rings as [lng, lat] pairs, in the order the service returns
  // them (first ring is the outer boundary). Null when the live
  // response carries no geometry.
  rings: [number, number][][] | null;
  centroid: { lat: number; lng: number } | null;
}

export async function fetchParcelBoundary(
  parcelId: string,
  countyCode: number,
  signal?: AbortSignal
): Promise<ParcelBoundary> {
  const clean = (parcelId || '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('A parcel ID is needed for the boundary.');
  if (!Number.isInteger(countyCode) || countyCode < 1 || countyCode > 67) {
    throw new Error('Pick a Florida county (DOR code 1–67) for the boundary.');
  }
  const escaped = clean.replace(/'/g, "''");
  const qs = new URLSearchParams({
    where: `PARCEL_ID = '${escaped}' AND CO_NO = ${countyCode + ROLL_COUNTY_CODE_OFFSET}`,
    outFields: 'PARCEL_ID',
    resultRecordCount: '1',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
  });
  const res = await fetch(`${FL_CADASTRAL_QUERY_URL}?${qs.toString()}`, { signal });
  const body = (await res.json().catch(() => null)) as {
    features?: { attributes?: { PARCEL_ID?: string }; geometry?: { rings?: number[][][] } }[];
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
  const feature = Array.isArray(body.features) ? body.features[0] : undefined;
  const rawRings = feature?.geometry?.rings;
  let rings: [number, number][][] | null = null;
  let centroid: { lat: number; lng: number } | null = null;
  if (Array.isArray(rawRings) && rawRings.length > 0) {
    const cleaned = rawRings
      .map((ring) =>
        (Array.isArray(ring) ? ring : [])
          .map((pt) => (Array.isArray(pt) && pt.length >= 2 ? [Number(pt[0]), Number(pt[1])] as [number, number] : null))
          .filter((pt): pt is [number, number] => pt !== null && Number.isFinite(pt[0]) && Number.isFinite(pt[1]) && pt[0] >= -180 && pt[0] <= 180 && pt[1] >= -90 && pt[1] <= 90)
      )
      .filter((ring) => ring.length >= 4);
    if (cleaned.length > 0) {
      rings = cleaned;
      const outer = cleaned[0];
      const lat = outer.reduce((s, p) => s + p[1], 0) / outer.length;
      const lng = outer.reduce((s, p) => s + p[0], 0) / outer.length;
      centroid = { lat, lng };
    }
  }
  return { parcelId: clean, rings, centroid };
}
