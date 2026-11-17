// Slice 135 — Distressed Finder feed registry.
//
// The 10 code-violation feeds below are the ONLY feeds this finder
// queries. Every endpoint, field name, and open-status filter was
// verified live on Nov 17, 2026 (see ~/MEMORY.md, "Distressed
// Finder feeds — ALL 10 VERIFIED"). Homepage domains are NOT
// endpoints, and no URL or field name here is guessed:
//   * Socrata feeds are queried with SoQL ($where with the
//     verified open filter, $limit, $order).
//   * ArcGIS feeds query the verified FeatureServer layer with a
//     where clause, outFields=*, f=json.
// Known quirks are carried on each feed and honored by the
// normalizers in this file, never papered over:
//   * Orlando rows sometimes have no real address ("No Address") —
//     those rows are address-unknown, never given an invented one.
//   * NYC and LA have NO single address field — the address is
//     assembled from the verified components (housenumber +
//     streetname; stno + predir + stname + suffix + zip).
//   * LA has NO violation-text field — aptype (case type) is the
//     closest proxy and is labeled as such wherever it appears.
//   * New Orleans violation text lives in a SECOND dataset (All
//     Violations) joined on caseno/caseid — the pipeline row shows
//     the keystatus narrative, and violation detail is fetched only
//     when the user expands a row.
//   * Kansas City data is STALE (last updated 2026-04-30, ~6.5
//     months old) — flagged on the feed and on every KC row, never
//     presented as live/current.
//   * Chicago's dataset warns its data is historical and "should
//     not be relied upon for real estate transactions" — surfaced
//     on the feed and on every Chicago row.
//   * Nashville's filter is confirmed live (Nov 17, 2026) and safe
//     to hard-code; it is a 311 layer, not a dedicated
//     code-enforcement dataset — labeled as such.
// No scraping, no bulk skip trace, no auto-send anywhere here:
// this file only READS public open-data feeds.

export type FeedKind = 'socrata' | 'arcgis';

export interface DistressedFeed {
  id: string;
  city: string;
  state: string;
  county: string;
  sourceName: string;
  datasetName: string;
  kind: FeedKind;
  endpoint: string;
  /** The verified open filter, verbatim (SoQL $where, or ArcGIS where). */
  openFilter: string;
  /** What "open" means for this feed, in plain words. */
  openMeaning: string;
  /** Freshness as verified Nov 17, 2026. */
  freshness: string;
  verifiedDate: string;
  stale?: boolean;
  warning?: string;
  note?: string;
  /** SoQL $order field (Socrata) or ArcGIS orderByFields field. */
  orderField: string;
}

export const DISTRESSED_FEEDS: DistressedFeed[] = [
  {
    id: 'orlando',
    city: 'Orlando',
    state: 'FL',
    county: 'Orange',
    sourceName: 'City of Orlando Open Data',
    datasetName: 'Code Enforcement Cases',
    kind: 'socrata',
    endpoint: 'https://data.cityoforlando.net/resource/k6e8-nw6w.json',
    openFilter: "caseinfostatus='Open'",
    openMeaning: "Rows where caseinfostatus is 'Open'. 2,539 open of 262,927 rows at verification.",
    freshness: 'Refreshed daily; fresh Nov 17, 2026.',
    verifiedDate: 'Nov 17, 2026',
    note: 'Some rows have no real address ("No Address") — those rows show as address-unknown, never with an invented address. Case number is the apno field, verified live from the endpoint Nov 17, 2026.',
    orderField: 'casedt',
  },
  {
    id: 'miami-dade',
    city: 'Miami-Dade',
    state: 'FL',
    county: 'Miami-Dade',
    sourceName: 'Miami-Dade County ArcGIS (Code Compliance)',
    datasetName: 'CodeComplianceViolation_Open_View',
    kind: 'arcgis',
    endpoint:
      'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/CodeComplianceViolation_Open_View/FeatureServer/0/query',
    openFilter: 'CASE_STATUS = 1',
    openMeaning:
      'The Open view is pre-filtered by the publisher to open cases; the query also asks for CASE_STATUS 1, which is Open. Civil, Lien, and Closed views exist separately and are not queried.',
    freshness: 'Fresh Nov 17, 2026.',
    verifiedDate: 'Nov 17, 2026',
    note: 'CASE_DATE is epoch milliseconds. A "178,000+ cases" figure seen elsewhere is UNVERIFIED and is never used.',
    orderField: 'CASE_DATE',
  },
  {
    id: 'dallas',
    city: 'Dallas',
    state: 'TX',
    county: 'Dallas',
    sourceName: 'Dallas OpenData (311 Service Requests)',
    datasetName: '311 Service Requests',
    kind: 'socrata',
    endpoint: 'https://www.dallasopendata.com/resource/d7e7-envw.json',
    openFilter:
      "department='Code Compliance' AND service_request_type='Code Concern - CCS' AND status IN ('New','In Progress','Escalated')",
    openMeaning:
      "311 requests from the Code Compliance department, of type 'Code Concern - CCS', with a status of New, In Progress, or Escalated.",
    freshness: 'Daily refresh; fresh Nov 17, 2026. 2.7M rows in the dataset.',
    verifiedDate: 'Nov 17, 2026',
    note: 'This is a 311 request feed, not a dedicated code-enforcement dataset, and its verified fields carry no violation-text field — the request type is shown and labeled as such.',
    orderField: 'created_date',
  },
  {
    id: 'chicago',
    city: 'Chicago',
    state: 'IL',
    county: 'Cook',
    sourceName: 'City of Chicago Data Portal',
    datasetName: 'Building Violations',
    kind: 'socrata',
    endpoint: 'https://data.cityofchicago.org/resource/22u3-xenr.json',
    openFilter: "violation_status='OPEN'",
    openMeaning: "Rows where violation_status is 'OPEN'. 1,134,663 open at verification.",
    freshness: 'Fresh Nov 17, 2026.',
    verifiedDate: 'Nov 17, 2026',
    warning:
      'The dataset itself warns its data is historical and "should not be relied upon for real estate transactions". Treat every Chicago row as a lead to verify against the current record, never as a current fact.',
    orderField: 'violation_date',
  },
  {
    id: 'austin',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    sourceName: 'City of Austin Open Data',
    datasetName: 'Code Enforcement Cases',
    kind: 'socrata',
    endpoint: 'https://data.austintexas.gov/resource/6wtj-zbtb.json',
    openFilter: "status='Active'",
    openMeaning: "Rows where status is 'Active'.",
    freshness: 'Fresh Nov 17, 2026.',
    verifiedDate: 'Nov 17, 2026',
    orderField: 'opened_date',
  },
  {
    id: 'nyc',
    city: 'New York City',
    state: 'NY',
    county: 'New York (all five boroughs)',
    sourceName: 'NYC Open Data (HPD)',
    datasetName: 'Open HPD Violations',
    kind: 'socrata',
    endpoint: 'https://data.cityofnewyork.us/resource/csn4-vhvf.json',
    openFilter: "violationstatus='Open'",
    openMeaning:
      "Rows where violationstatus is 'Open'. This is the pre-filtered Open HPD Violations dataset (the all-violations dataset wvxf-dwi5.json is not queried).",
    freshness: 'Daily refresh; fresh Nov 17, 2026. 8.3M rows in the dataset.',
    verifiedDate: 'Nov 17, 2026',
    note: 'No single address field exists in this dataset — the address is assembled from housenumber + streetname, the verified components. No ZIP field is in the verified field list.',
    orderField: 'inspectiondate',
  },
  {
    id: 'los-angeles',
    city: 'Los Angeles',
    state: 'CA',
    county: 'Los Angeles',
    sourceName: 'Los Angeles Open Data (LADBS)',
    datasetName: 'Open Code Enforcement Cases',
    kind: 'socrata',
    endpoint: 'https://data.lacity.org/resource/u82d-eh7z.json',
    openFilter: "stat='O'",
    openMeaning: "Rows where stat is 'O' (open). This dataset holds open cases only.",
    freshness: 'Weekly refresh; 28,763 rows at verification.',
    verifiedDate: 'Nov 17, 2026',
    note: 'No single address field — the address is assembled from stno + predir + stname + suffix + zip, the verified components. NO violation-text field exists in this dataset — aptype (case type) is shown as the closest proxy and is labeled as such.',
    orderField: 'adddttm',
  },
  {
    id: 'nashville',
    city: 'Nashville',
    state: 'TN',
    county: 'Davidson',
    sourceName: 'Metro Nashville ArcGIS (hubNashville 311)',
    datasetName: 'hubNashville_311_Service_Requests_Current_Year_view',
    kind: 'arcgis',
    endpoint:
      'https://services2.arcgis.com/HdTo6HJqh92wn4D8/ArcGIS/rest/services/hubNashville_311_Service_Requests_Current_Year_view/FeatureServer/0/query',
    openFilter:
      "Request_Type='Property Violations' AND Status IN ('New','Assigned','In Progress')",
    openMeaning:
      "311 requests of type 'Property Violations' with a status of New, Assigned, or In Progress. The filter value was confirmed live Nov 17, 2026 (3 live rows returned, e.g. Request 2341096, opened Nov 16, 2026) — safe to hard-code.",
    freshness: 'Confirmed live Nov 17, 2026.',
    verifiedDate: 'Nov 17, 2026',
    note: 'This is a 311 layer, not a dedicated code-enforcement dataset. There is NO Socrata dataset for Nashville 311 (api/views returns 404) — do not query one. Request number is the Request__ field, verified live from the layer Nov 17, 2026.',
    orderField: 'Date_Time_Opened',
  },
  {
    id: 'new-orleans',
    city: 'New Orleans',
    state: 'LA',
    county: 'Orleans',
    sourceName: 'City of New Orleans Open Data',
    datasetName: 'Code Enforcement Active Pipeline',
    kind: 'socrata',
    endpoint: 'https://data.nola.gov/resource/8pqz-ftzc.json',
    openFilter: "o_c='Open'",
    openMeaning: "Rows where o_c is 'Open'. 29,659 open at verification.",
    freshness: 'Fresh Nov 17, 2026.',
    verifiedDate: 'Nov 17, 2026',
    note: 'Violation text lives in a SECOND dataset, All Violations (https://data.nola.gov/resource/3ehi-je3s.json — violation / description / codesection, joined on caseno/caseid). The pipeline row shows the keystatus narrative; violation detail is fetched only when the user expands a row.',
    orderField: 'casefiled',
  },
  {
    id: 'kansas-city',
    city: 'Kansas City',
    state: 'MO',
    county: 'Jackson',
    sourceName: 'Kansas City Open Data',
    datasetName: 'EG NPD Violations',
    kind: 'socrata',
    endpoint: 'https://data.kcmo.org/resource/vq3e-m9ge.json',
    openFilter: "case_status='In-Violation' AND date_resolved IS NULL",
    openMeaning:
      "Rows where case_status is 'In-Violation' and date_resolved is blank (no resolution date recorded).",
    freshness: 'STALE — data_updated_at 2026-04-30, about 6.5 months old at verification, despite a "daily/nightly" claim.',
    verifiedDate: 'Nov 17, 2026',
    stale: true,
    warning:
      'STALE DATA: this feed was last updated 2026-04-30 — about 6.5 months before verification. Treat every Kansas City row as out of date until the city refreshes the dataset; never present it as live or current.',
    orderField: 'date_found',
  },
];

export function feedById(id: string): DistressedFeed {
  return DISTRESSED_FEEDS.find((f) => f.id === id) || DISTRESSED_FEEDS[0];
}

/** One normalized open-case row, whatever feed it came from. */
export interface DistressedRow {
  feedId: string;
  caseNumber: string;
  address: string;
  addressUnknown: boolean;
  city: string;
  state: string;
  zip: string;
  county: string;
  parcelId: string;
  violation: string;
  /** True when the violation text is a proxy, not violation text from the feed (LA aptype, Dallas request type). */
  violationIsProxy: boolean;
  openedDate: string;
  status: string;
  /** Extra honest context for the row (e.g. NOLA second-dataset note). */
  detailNote: string;
  raw: Record<string, unknown>;
}

export interface NolaViolationDetail {
  violation: string;
  description: string;
  codesection: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const epochToDate = (v: unknown): string => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};
const dateOnly = (v: unknown): string => {
  const s = str(v);
  if (!s) return '';
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};

function base(feed: DistressedFeed, raw: Record<string, unknown>): DistressedRow {
  return {
    feedId: feed.id,
    caseNumber: '',
    address: '',
    addressUnknown: false,
    city: feed.city,
    state: feed.state,
    zip: '',
    county: feed.county,
    parcelId: '',
    violation: '',
    violationIsProxy: false,
    openedDate: '',
    status: '',
    detailNote: '',
    raw,
  };
}

/** Normalize one raw row from a feed into a DistressedRow. Only
 * verified field names are read; anything missing reads empty,
 * never invented. */
export function normalizeRow(feed: DistressedFeed, raw: Record<string, unknown>): DistressedRow {
  const row = base(feed, raw);
  switch (feed.id) {
    case 'orlando': {
      row.caseNumber = str(raw.apno);
      const addr = str(raw.derived_address);
      row.addressUnknown = !addr || /^no address$/i.test(addr);
      row.address = row.addressUnknown ? '' : addr;
      row.violation = str(raw.casename);
      row.openedDate = dateOnly(raw.casedt);
      row.status = str(raw.caseinfostatus);
      row.parcelId = str(raw.parcel_id);
      break;
    }
    case 'miami-dade': {
      row.caseNumber = str(raw.CASE_NUM);
      row.address = str(raw.ADDRESS);
      row.addressUnknown = !row.address;
      row.violation = str(raw.PROBLEM_DESC);
      row.openedDate = epochToDate(raw.CASE_DATE);
      row.status = str(raw.CASE_STATUS) === '1' ? 'Open' : str(raw.CASE_STATUS);
      row.parcelId = str(raw.FOLIO);
      // LAST_ACTV is epoch ms on this layer, like CASE_DATE.
      const lastAct = epochToDate(raw.LAST_ACTV) || dateOnly(raw.LAST_ACTV);
      row.detailNote = lastAct ? `Last activity: ${lastAct}.` : '';
      break;
    }
    case 'dallas': {
      row.caseNumber = str(raw.service_request_number);
      row.address = str(raw.address);
      row.addressUnknown = !row.address;
      row.violation = str(raw.service_request_type);
      // This 311 feed's verified fields carry no violation-text
      // field — the request type is the closest label, not a
      // violation description.
      row.violationIsProxy = true;
      row.openedDate = dateOnly(raw.created_date);
      row.status = str(raw.status);
      break;
    }
    case 'chicago': {
      row.caseNumber = str(raw.id);
      row.address = str(raw.address);
      row.addressUnknown = !row.address;
      row.violation = str(raw.violation_description);
      row.openedDate = dateOnly(raw.violation_date);
      row.status = str(raw.violation_status);
      break;
    }
    case 'austin': {
      row.caseNumber = str(raw.case_id);
      row.address = str(raw.address);
      row.addressUnknown = !row.address;
      row.violation = str(raw.description);
      row.openedDate = dateOnly(raw.opened_date);
      row.status = str(raw.status);
      row.parcelId = str(raw.parcelid);
      break;
    }
    case 'nyc': {
      row.caseNumber = str(raw.violationid);
      // No single address field — assemble from the verified
      // components housenumber + streetname.
      row.address = [str(raw.housenumber), str(raw.streetname)].filter(Boolean).join(' ');
      row.addressUnknown = !row.address;
      row.violation = str(raw.novdescription);
      row.openedDate = dateOnly(raw.inspectiondate);
      row.status = str(raw.violationstatus);
      row.detailNote = str(raw.class) ? `Violation class ${str(raw.class)}.` : '';
      break;
    }
    case 'los-angeles': {
      row.caseNumber = str(raw.apno);
      // No single address field — assemble from the verified
      // components stno + predir + stname + suffix + zip.
      row.address = [str(raw.stno), str(raw.predir), str(raw.stname), str(raw.suffix)]
        .filter(Boolean)
        .join(' ');
      row.addressUnknown = !row.address;
      row.zip = str(raw.zip);
      // NO violation-text field exists in this dataset — aptype
      // (case type) is the closest proxy and is labeled as such.
      row.violation = str(raw.aptype);
      row.violationIsProxy = true;
      row.openedDate = dateOnly(raw.adddttm);
      row.status = str(raw.stat) === 'O' ? 'Open' : str(raw.stat);
      break;
    }
    case 'nashville': {
      row.caseNumber = str(raw.Request__);
      row.address = str(raw.Address);
      row.addressUnknown = !row.address;
      row.violation = str(raw.Subrequest_Type) || str(raw.Request_Type);
      row.violationIsProxy = !str(raw.Subrequest_Type);
      row.openedDate = epochToDate(raw.Date_Time_Opened);
      row.status = str(raw.Status);
      row.zip = str(raw.ZIP);
      row.detailNote = '311 layer — not a dedicated code-enforcement dataset.';
      break;
    }
    case 'new-orleans': {
      row.caseNumber = str(raw.caseno) || str(raw.caseid);
      row.address = str(raw.geoaddress) || str(raw.location);
      row.addressUnknown = !row.address;
      // The pipeline row carries the keystatus narrative; the
      // violation text itself lives in the second dataset and is
      // fetched only on expand (see fetchNolaViolationDetail).
      row.violation = str(raw.keystatus);
      row.openedDate = dateOnly(raw.casefiled);
      row.status = str(raw.o_c);
      row.detailNote =
        'Violation detail lives in the separate All Violations dataset — expand this row to fetch it.';
      break;
    }
    case 'kansas-city': {
      // No case-number field is in this feed's verified field
      // list — the case number is left blank, never guessed.
      row.caseNumber = '';
      row.address = str(raw.full_address);
      row.addressUnknown = !row.address;
      row.violation = str(raw.description);
      row.openedDate = dateOnly(raw.date_found);
      row.status = str(raw.case_status) || str(raw.vio_status);
      row.detailNote = str(raw.ordinance) ? `Ordinance: ${str(raw.ordinance)}.` : '';
      break;
    }
    default:
      break;
  }
  return row;
}

export function buildFeedUrl(feed: DistressedFeed, limit: number): string {
  if (feed.kind === 'socrata') {
    const params = new URLSearchParams({
      $where: feed.openFilter,
      $limit: String(limit),
      $order: `${feed.orderField} DESC`,
    });
    return `${feed.endpoint}?${params.toString()}`;
  }
  const params = new URLSearchParams({
    where: feed.openFilter,
    outFields: '*',
    f: 'json',
    resultRecordCount: String(limit),
    orderByFields: `${feed.orderField} DESC`,
  });
  return `${feed.endpoint}?${params.toString()}`;
}

/** Fetch one feed's open rows, normalized. Throws with a plain
 * message naming the feed when the fetch or the parse fails — the
 * caller shows that honestly instead of an empty table. */
export async function fetchFeedRows(feed: DistressedFeed, limit = 25): Promise<DistressedRow[]> {
  const res = await fetch(buildFeedUrl(feed, limit));
  if (!res.ok) {
    throw new Error(
      `${feed.city}: the ${feed.sourceName} feed answered ${res.status} — no rows were loaded. Try again later.`
    );
  }
  const data: unknown = await res.json();
  if (feed.kind === 'socrata') {
    if (!Array.isArray(data)) {
      throw new Error(`${feed.city}: the feed answered in an unexpected shape — no rows were loaded.`);
    }
    return (data as Record<string, unknown>[]).map((r) => normalizeRow(feed, r));
  }
  const features = (data as { features?: { attributes?: Record<string, unknown> }[] } | null)?.features;
  if (!Array.isArray(features)) {
    throw new Error(`${feed.city}: the feed answered in an unexpected shape — no rows were loaded.`);
  }
  return features.map((f) => normalizeRow(feed, f.attributes || {}));
}

const NOLA_VIOLATIONS_ENDPOINT = 'https://data.nola.gov/resource/3ehi-je3s.json';

/** New Orleans only: violation detail from the separate All
 * Violations dataset, joined on caseno/caseid. Fetched only when
 * the user expands a row — never bulk-fetched. */
export async function fetchNolaViolationDetail(caseNumber: string): Promise<NolaViolationDetail[]> {
  const key = caseNumber.trim().replace(/'/g, "''");
  if (!key) return [];
  const params = new URLSearchParams({
    $where: `caseno='${key}' OR caseid='${key}'`,
    $limit: '5',
  });
  const res = await fetch(`${NOLA_VIOLATIONS_ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`New Orleans violation detail answered ${res.status} — try expanding the row again later.`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    violation: str(r.violation),
    description: str(r.description),
    codesection: str(r.codesection),
  }));
}
