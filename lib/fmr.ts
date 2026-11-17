// Slice 132 — HUD Fair Market Rent (FMR) data.
//
// Source: HUD USER Data API (huduser.gov), documented at
// https://www.huduser.gov/portal/dataset/fmr-api.html — VERIFIED
// from HUD's own docs Nov 17, 2026. Base:
//   https://www.huduser.gov/hudapi/public/fmr/
// Endpoints used here:
//   fmr/data/{entityid} — FMR by bedroom count for one county or
//     metro area. The entity id for a county is the 10-digit
//     fips_code listCounties returns: state (2) + county (3) +
//     "99999" — e.g. Accomack County, VA is "5100199999", so
//     Broward County, FL (FIPS 12011) is "1201199999".
//   Response: { data: { county_name, metro_name, metro_status,
//     smallarea_status, basicdata: { Efficiency, "One-Bedroom",
//     "Two-Bedroom", "Three-Bedroom", "Four-Bedroom", year } } }.
//     basicdata is an OBJECT for a county (an ARRAY only for
//     small-area metro areas, which this route does not request).
// Auth: a FREE HUD token, sent as `Authorization: Bearer <token>`
// in the header. The token comes from env HUD_API_TOKEN only and
// is NEVER in the repo. Without a token the route returns
// {mode: 'not_configured'} and the UI honestly reads "needs a
// free HUD token" — no rent is shown, none is invented.
// No live call was possible without a token; the parser handles
// both the object and array basicdata shapes and reads every
// value by its documented field name, so an unexpected shape
// degrades to "not provided" instead of a wrong number.
// HUD's notice, shown wherever FMR appears: "This product uses
// the HUD User Data API but is not endorsed or certified by HUD
// User."

export interface FmrData {
  mode: 'ok';
  year: string | null;
  countyName: string | null;
  metroName: string | null;
  efficiency: number | null;
  oneBedroom: number | null;
  twoBedroom: number | null;
  threeBedroom: number | null;
  fourBedroom: number | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function countyFipsToEntityId(countyFips: string): string | null {
  const fips = (countyFips || '').trim();
  if (!/^\d{5}$/.test(fips)) return null;
  return `${fips}99999`;
}

export async function fetchFmrByCountyFips(
  countyFips: string,
  token: string | undefined,
  signal?: AbortSignal
): Promise<FmrData | { mode: 'not_configured' }> {
  if (!token) return { mode: 'not_configured' };
  const entityId = countyFipsToEntityId(countyFips);
  if (!entityId) throw new Error('That county FIPS code does not look like a 5-digit county code.');
  const res = await fetch(`https://www.huduser.gov/hudapi/public/fmr/data/${entityId}`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => null)) as {
    data?: {
      county_name?: string;
      metro_name?: string;
      basicdata?: Record<string, unknown> | Record<string, unknown>[];
    };
    error?: string;
    message?: string;
  } | null;
  if (!res.ok) {
    const msg =
      (body && (body.error || body.message)) ||
      `HUD API refused the request (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  const data = body?.data;
  if (!data) throw new Error('The HUD API answered with nothing readable for this county.');
  // County basicdata is an object; a small-area metro returns an
  // array (first row is the MSA level). This route asks for a
  // county, so the object is expected — the array is handled only
  // so a surprise shape reads as the MSA-level row, never as a
  // ZIP row.
  const basic = Array.isArray(data.basicdata) ? data.basicdata[0] || {} : data.basicdata || {};
  return {
    mode: 'ok',
    year: typeof basic.year === 'string' || typeof basic.year === 'number' ? String(basic.year) : null,
    countyName: typeof data.county_name === 'string' ? data.county_name : null,
    metroName: typeof data.metro_name === 'string' ? data.metro_name : null,
    efficiency: num(basic.Efficiency),
    oneBedroom: num(basic['One-Bedroom']),
    twoBedroom: num(basic['Two-Bedroom']),
    threeBedroom: num(basic['Three-Bedroom']),
    fourBedroom: num(basic['Four-Bedroom']),
  };
}
