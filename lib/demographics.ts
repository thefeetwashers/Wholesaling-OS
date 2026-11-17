// Slice 132 — U.S. Census Bureau ACS demographics (ZIP level).
//
// Source: api.census.gov, 2023 ACS 5-year (acs5). VERIFIED LIVE
// Nov 17, 2026: the data API now REQUIRES a key — both the 2023
// and 2022 ACS5 queries without one return "Missing Key: A valid
// key must be included with each data API request." The task brief
// said no key was needed at low volume; that is no longer true.
// So this module is key-optional by design: without a free Census
// key (env CENSUS_API_KEY) the route returns {mode:
// 'not_configured'} and the UI honestly reads "needs a free
// Census API key" — no numbers are shown, none are invented.
// With a key, the route calls the API server-side (the key never
// reaches the browser) and parses ONLY the fields the live
// response actually returns: the response is an array of arrays
// whose first row is the header, so every value is read by its
// header name and any variable the API does not return reads
// "not provided".
//
// Variables requested (standard ACS 5-year table IDs):
//   B01003_001E total population
//   B19013_001E median household income
//   B25003_001E total housing units
//   B25003_002E owner-occupied units
//   B25003_003E renter-occupied units
//   B25077_001E median home value
//   B25064_001E median gross rent
// Values are NOT verified live (no key was available to test
// with) — the parser is defensive by construction: it reads the
// header row and maps by name, so a missing or renamed variable
// degrades to "not provided" instead of a wrong number.

export const ACS_YEAR = 2023;

const ACS_VARIABLES = [
  'B01003_001E',
  'B19013_001E',
  'B25003_001E',
  'B25003_002E',
  'B25003_003E',
  'B25077_001E',
  'B25064_001E',
];

export interface Demographics {
  mode: 'ok';
  year: number;
  zip: string;
  population: number | null;
  medianIncome: number | null;
  housingUnits: number | null;
  ownerOccupied: number | null;
  renterOccupied: number | null;
  medianHomeValue: number | null;
  medianGrossRent: number | null;
}

export async function fetchDemographicsByZip(
  zip: string,
  apiKey: string | undefined,
  signal?: AbortSignal
): Promise<Demographics | { mode: 'not_configured' }> {
  if (!apiKey) return { mode: 'not_configured' };
  const qs = new URLSearchParams({
    get: ACS_VARIABLES.join(','),
    for: `zip code tabulation area:${zip}`,
    key: apiKey,
  });
  const res = await fetch(`https://api.census.gov/data/${ACS_YEAR}/acs/acs5?${qs.toString()}`, { signal });
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    // The Census error body is plain text or an object — quote it
    // verbatim, never paraphrase it into a number.
    const msg =
      typeof body === 'string'
        ? body
        : (body as { message?: string } | null)?.message || `Census API refused the request (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  if (!Array.isArray(body) || body.length < 2 || !Array.isArray(body[0])) {
    throw new Error('The Census API answered with nothing readable for this ZIP.');
  }
  const headers = (body[0] as unknown[]).map((h) => String(h));
  const row = body[1] as unknown[];
  const byName = (name: string): number | null => {
    const i = headers.indexOf(name);
    if (i < 0) return null;
    const raw = row[i];
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  return {
    mode: 'ok',
    year: ACS_YEAR,
    zip,
    population: byName('B01003_001E'),
    medianIncome: byName('B19013_001E'),
    housingUnits: byName('B25003_001E'),
    ownerOccupied: byName('B25003_002E'),
    renterOccupied: byName('B25003_003E'),
    medianHomeValue: byName('B25077_001E'),
    medianGrossRent: byName('B25064_001E'),
  };
}
