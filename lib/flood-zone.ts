// Slice 132 — FEMA flood zone at a point (National Flood Hazard
// Layer, NFHL).
//
// VERIFIED LIVE Nov 17, 2026 (live browser): the /arcgis/ path
// WORKS and the /gis/nfhl/ path is DEAD (WebSEAL "Not Found").
//   https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=json
// loads: service "NFHL", currentVersion 11.1, capabilities
// Map/Query/Data, 32 layers — layer 28 "Flood Hazard Zones"
// (polygon), layer 27 "Flood Hazard Boundaries". NEVER use the
// /gis/nfhl/ path.
// Flood-zone query goes to layer 28:
//   .../NFHL/MapServer/28/query
//     ?geometry=<lng>,<lat>
//     &geometryType=esriGeometryPoint&inSR=4326
//     &spatialRel=esriSpatialRelIntersects
//     &outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json
// FLD_ZONE is the zone letter (A, AE, VE, X, etc.); ZONE_SUBTY
// carries qualifiers. No key is required.
// A point with no feature is NOT an error: it means FEMA has no
// mapped flood hazard zone at that point, and the UI reads "not
// checked" — never a guessed zone. A zone letter is information
// from FEMA's effective map, not a Standard Flood Hazard
// Determination (FEMA Form 086-0-32), not a prediction of whether
// a building will flood, and not an insurance quote — the UI says
// so wherever a zone is shown.

export interface FloodZone {
  mode: 'ok';
  zone: string | null;
  zoneSubtype: string | null;
  // Special Flood Hazard Area, by FEMA's definition: zones in the
  // A and V series. X (and similar) is outside the SFHA.
  inSfha: boolean | null;
}

export async function fetchFloodZone(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<FloodZone | { mode: 'no_data' }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('That latitude/longitude does not look valid.');
  }
  const qs = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,ZONE_SUBTY',
    returnGeometry: 'false',
    f: 'json',
  });
  const res = await fetch(
    `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${qs.toString()}`,
    { signal }
  );
  const body = (await res.json().catch(() => null)) as {
    features?: { attributes?: { FLD_ZONE?: string; ZONE_SUBTY?: string } }[];
    error?: { message?: string };
  } | null;
  if (!res.ok) {
    throw new Error(
      (body?.error?.message && `FEMA NFHL answered: ${body.error.message}`) ||
        `FEMA NFHL refused the request (HTTP ${res.status}).`
    );
  }
  if (!body) throw new Error('FEMA NFHL answered with nothing readable.');
  if (body.error) throw new Error(`FEMA NFHL answered: ${body.error.message || 'invalid query'}`);
  const attrs = Array.isArray(body.features) && body.features[0]?.attributes;
  if (!attrs || typeof attrs.FLD_ZONE !== 'string' || !attrs.FLD_ZONE.trim()) {
    return { mode: 'no_data' };
  }
  const zone = attrs.FLD_ZONE.trim();
  const first = zone.charAt(0).toUpperCase();
  return {
    mode: 'ok',
    zone,
    zoneSubtype: typeof attrs.ZONE_SUBTY === 'string' && attrs.ZONE_SUBTY.trim() ? attrs.ZONE_SUBTY.trim() : null,
    inSfha: first === 'A' || first === 'V',
  };
}
