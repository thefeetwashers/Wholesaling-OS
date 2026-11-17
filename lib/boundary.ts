// Slice 132 — Census TIGERweb boundary polygons (county + ZIP).
//
// Source: tigerweb.geo.census.gov, ArcGIS REST, no key, free.
// VERIFIED LIVE Nov 17, 2026:
//   * Services directory lists the TIGERweb folder.
//   * TIGERweb/State_County/MapServer: "States and Counties",
//     Counties layer id 1 (January 1, 2026 vintage), fields
//     STATE, COUNTY, GEOID, NAME, BASENAME, CENTLAT, CENTLON,
//     INTPTLAT, INTPTLON; supported formats include geoJSON.
//   * TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer: "Urban Growth
//     Areas, ZIP Code Tabulation Areas", 2020 Census ZIP Code
//     Tabulation Areas layer id 1 (2020 vintage), fields ZCTA5,
//     GEOID, BASENAME, NAME, CENTLAT, CENTLON, INTPTLAT, INTPTLON,
//     POP100, HU100; supported formats include geoJSON.
//   * NOTE: the generic .../TIGERweb/MapServer path 404s ("Service
//     not found") — the services live under the TIGERweb folder
//     with their own names, as used here.
// The route returns the GeoJSON feature (f=geojson, outSR=4326,
// maxAllowableOffset 0.001 to generalize the ring) plus the
// Census centroid (CENTLAT/CENTLON), which the map uses as its
// center. A ZIP with no ZCTA, or a county FIPS with no match,
// returns no feature — the map then shows a marker only, never a
// guessed boundary.

export interface BoundaryResult {
  kind: 'county' | 'zcta';
  key: string;
  name: string | null;
  centroid: { lat: number; lng: number } | null;
  geojson: {
    type: string;
    features?: { type: string; geometry?: { type: string; coordinates?: unknown } }[];
  } | null;
}

const TIGERWEB_BASE = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb';

async function tigerQuery(
  service: string,
  layer: number,
  where: string,
  outFields: string,
  signal?: AbortSignal
): Promise<BoundaryResult['geojson']> {
  const qs = new URLSearchParams({
    where,
    outFields,
    returnGeometry: 'true',
    outSR: '4326',
    maxAllowableOffset: '0.001',
    f: 'geojson',
  });
  const res = await fetch(`${TIGERWEB_BASE}/${service}/MapServer/${layer}/query?${qs.toString()}`, { signal });
  const body = (await res.json().catch(() => null)) as {
    features?: unknown[];
    error?: { message?: string };
  } | null;
  if (!res.ok) {
    throw new Error(
      (body?.error?.message && `Census TIGERweb answered: ${body.error.message}`) ||
        `Census TIGERweb refused the request (HTTP ${res.status}).`
    );
  }
  if (!body) throw new Error('Census TIGERweb answered with nothing readable.');
  if (body.error) throw new Error(`Census TIGERweb answered: ${body.error.message || 'invalid query'}`);
  return body as BoundaryResult['geojson'];
}

export async function fetchCountyBoundary(
  countyFips: string,
  signal?: AbortSignal
): Promise<BoundaryResult> {
  const fips = (countyFips || '').trim();
  if (!/^\d{5}$/.test(fips)) throw new Error('That county FIPS code does not look like a 5-digit county code.');
  const geojson = await tigerQuery(
    'State_County',
    1,
    `STATE='${fips.slice(0, 2)}' AND COUNTY='${fips.slice(2)}'`,
    'NAME,GEOID,CENTLAT,CENTLON',
    signal
  );
  const props = (geojson?.features?.[0] as { properties?: Record<string, unknown> } | undefined)?.properties || {};
  const lat = parseFloat(String(props.CENTLAT ?? ''));
  const lng = parseFloat(String(props.CENTLON ?? ''));
  return {
    kind: 'county',
    key: fips,
    name: typeof props.NAME === 'string' ? props.NAME : null,
    centroid: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    geojson: geojson && Array.isArray(geojson.features) && geojson.features.length > 0 ? geojson : null,
  };
}

export async function fetchZctaBoundary(
  zip: string,
  signal?: AbortSignal
): Promise<BoundaryResult> {
  const z = (zip || '').trim();
  if (!/^\d{5}$/.test(z)) throw new Error('That ZIP code does not look like a 5-digit ZIP code.');
  const geojson = await tigerQuery(
    'PUMA_TAD_TAZ_UGA_ZCTA',
    1,
    `ZCTA5='${z}'`,
    'NAME,ZCTA5,CENTLAT,CENTLON',
    signal
  );
  const props = (geojson?.features?.[0] as { properties?: Record<string, unknown> } | undefined)?.properties || {};
  const lat = parseFloat(String(props.CENTLAT ?? ''));
  const lng = parseFloat(String(props.CENTLON ?? ''));
  return {
    kind: 'zcta',
    key: z,
    name: typeof props.NAME === 'string' ? props.NAME : null,
    centroid: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    geojson: geojson && Array.isArray(geojson.features) && geojson.features.length > 0 ? geojson : null,
  };
}
