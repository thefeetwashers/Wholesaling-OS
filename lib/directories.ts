import { supabase, supabaseConfigured } from './supabase';

// Read-only directory loads. Both tables have seed rows with a null
// owner (platform rows) that signed-in users may read, plus the user's
// own added rows. No scraping, no guessed URLs — only rows in the DB.
export interface TitleCompanyRow {
  id?: string;
  owner_id?: string | null;
  name: string;
  states: string[];
  website?: string | null;
  notes?: string | null;
}

export interface CountyLinkRow {
  id?: string;
  added_by?: string | null;
  state_code: string;
  county_name: string;
  fips_code?: string | null;
  clerk_court_deeds_url?: string | null;
  code_enforcement_url?: string | null;
  utility_records_url?: string | null;
  arrest_logs_url?: string | null;
  tax_assessor_gis_url?: string | null;
  verified: boolean;
}

export async function loadTitleCompanies(): Promise<TitleCompanyRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('title_companies')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data || []) as TitleCompanyRow[];
}

export async function loadCountyLinks(): Promise<CountyLinkRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('county_portal_links')
    .select('*')
    .order('county_name');
  if (error) throw error;
  return (data || []) as CountyLinkRow[];
}


export interface StateDirectoryRow {
  state_code: string;
  state_name: string;
  directory_url: string;
  run_by?: string | null;
  verified: boolean;
}

// Official state-level directories (schema v3.9, Slice 22): one
// verified directory per state that lists or links the state's county
// clerks / recorders / county offices. Platform rows only.
export async function loadStateDirectories(): Promise<StateDirectoryRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('state_directory_links')
    .select('*')
    .order('state_name');
  if (error) throw error;
  return (data || []) as StateDirectoryRow[];
}

// ---------- User-saved county links (schema v4.0, Slice 23) ----------
// A wholesaler's own links for counties the platform set does not
// cover yet. Stored as their private rows in county_portal_links
// (added_by = their id, verified = false), readable and writable only
// by them under RLS. They are labeled "your links — unverified"
// everywhere; the platform never presents them as verified. When many
// wholesalers save the same county, it surfaces in the owner's Verify
// Queue (county_demand) for a future platform verification batch.

export const US_STATES: { code: string; name: string }[] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
].map(([code, name]) => ({ code, name }));

// Slice 57 — My Markets: everything the platform lawfully has for
// the counties a wholesaler actually works, gathered in one place.
// A "market" is derived only from the wholesaler's own footprint:
// counties on their leads plus counties they saved links for. The
// links shown are the platform's verified county rows, topped up
// by the wholesaler's own saved rows — never guessed URLs.
export interface MarketSummary {
  countyName: string;
  stateCode: string;
  stateLabel: string;
  leadCount: number;
  clerkUrl: string | null;
  appraiserUrl: string | null;
  codeUrl: string | null;
  hasLinks: boolean;
  savedByUser: boolean;
}

export function summarizeMarkets(
  leads: { county?: string | null; state?: string | null }[],
  platformRows: CountyLinkRow[],
  userRows: CountyLinkRow[],
): MarketSummary[] {
  const byKey = new Map<string, MarketSummary>();
  const keyOf = (county: string, stateCode: string) => `${county.trim().toLowerCase()}|${stateCode.trim().toUpperCase()}`;
  const stateCodeOf = (raw?: string | null): string => {
    const t = (raw || '').trim();
    if (!t) return '';
    if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
    const hit = US_STATES.find((s) => s.name.toLowerCase() === t.toLowerCase());
    return hit ? hit.code : '';
  };
  const ensure = (county: string, stateCode: string, stateLabel: string): MarketSummary => {
    const k = keyOf(county, stateCode);
    let m = byKey.get(k);
    if (!m) {
      m = {
        countyName: county, stateCode, stateLabel,
        leadCount: 0, clerkUrl: null, appraiserUrl: null, codeUrl: null,
        hasLinks: false, savedByUser: false,
      };
      byKey.set(k, m);
    }
    return m;
  };
  const applyRow = (r: CountyLinkRow, fromUser: boolean) => {
    const m = ensure(r.county_name, r.state_code, r.state_code);
    if (r.clerk_court_deeds_url) m.clerkUrl = r.clerk_court_deeds_url;
    if (r.tax_assessor_gis_url) m.appraiserUrl = r.tax_assessor_gis_url;
    if (r.code_enforcement_url) m.codeUrl = r.code_enforcement_url;
    m.hasLinks = !!(m.clerkUrl || m.appraiserUrl || m.codeUrl);
    if (fromUser) m.savedByUser = true;
  };
  for (const r of platformRows) applyRow(r, false);
  // NOTE: platform rows cover every seeded county — markets are
  // only the counties the wholesaler touches, so collect link data
  // here but create market entries only from leads + user rows.
  const linkData = new Map<string, MarketSummary>();
  for (const [k, m] of Array.from(byKey.entries())) linkData.set(k, m);
  byKey.clear();
  const ensureMarket = (county: string, stateCode: string, stateLabel: string): MarketSummary => {
    const m = ensure(county, stateCode, stateLabel);
    const src = linkData.get(keyOf(county, stateCode));
    if (src) {
      m.clerkUrl = src.clerkUrl; m.appraiserUrl = src.appraiserUrl; m.codeUrl = src.codeUrl;
      m.hasLinks = src.hasLinks;
    }
    return m;
  };
  for (const l of leads) {
    const county = (l.county || '').trim();
    if (!county) continue;
    const code = stateCodeOf(l.state);
    const m = ensureMarket(county, code, (l.state || '').trim());
    m.leadCount += 1;
  }
  for (const r of userRows) {
    const m = ensureMarket(r.county_name, r.state_code, r.state_code);
    if (r.clerk_court_deeds_url) m.clerkUrl = r.clerk_court_deeds_url;
    if (r.tax_assessor_gis_url) m.appraiserUrl = r.tax_assessor_gis_url;
    if (r.code_enforcement_url) m.codeUrl = r.code_enforcement_url;
    m.hasLinks = !!(m.clerkUrl || m.appraiserUrl || m.codeUrl);
    m.savedByUser = true;
  }
  return Array.from(byKey.values()).sort((a, b) => b.leadCount - a.leadCount || a.countyName.localeCompare(b.countyName));
}

export interface UserCountyInput {
  state_code: string;
  county_name: string;
  clerk_court_deeds_url?: string | null;
  code_enforcement_url?: string | null;
  utility_records_url?: string | null;
  arrest_logs_url?: string | null;
  tax_assessor_gis_url?: string | null;
}

const cleanUrl = (v?: string | null): string | null => {
  const t = (v || '').trim();
  return t ? t : null;
};

export async function loadUserCounties(userId: string): Promise<CountyLinkRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('county_portal_links')
    .select('*')
    .eq('added_by', userId)
    .order('state_code')
    .order('county_name');
  if (error) throw error;
  return (data || []) as CountyLinkRow[];
}

// Insert-or-update the caller's own row for a county. Done as an
// explicit select-then-write so it does not depend on PostgREST
// upsert inference against the partial unique index (schema v4.0).
export async function saveUserCounty(userId: string, input: UserCountyInput): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Database is not configured.');
  const county = input.county_name.trim();
  if (!county) throw new Error('County name is required.');
  const fields = {
    state_code: input.state_code,
    county_name: county,
    clerk_court_deeds_url: cleanUrl(input.clerk_court_deeds_url),
    code_enforcement_url: cleanUrl(input.code_enforcement_url),
    utility_records_url: cleanUrl(input.utility_records_url),
    arrest_logs_url: cleanUrl(input.arrest_logs_url),
    tax_assessor_gis_url: cleanUrl(input.tax_assessor_gis_url),
    verified: false,
  };
  const { data: existing, error: selErr } = await supabase
    .from('county_portal_links')
    .select('id')
    .eq('added_by', userId)
    .eq('state_code', input.state_code)
    .eq('county_name', county)
    .limit(1);
  if (selErr) throw selErr;
  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('county_portal_links')
      .update(fields)
      .eq('id', (existing[0] as { id: string }).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('county_portal_links')
      .insert({ ...fields, added_by: userId });
    if (error) throw error;
  }
}

export async function deleteUserCounty(id: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('county_portal_links').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Owner Verify Queue (schema v4.0, Slice 23) ----------
// County names + distinct-wholesaler counts only, served by the
// owner-only county_demand() function; non-owners get zero rows.
export interface CountyDemandRow {
  state_code: string;
  county_name: string;
  wholesalers: number;
  saved_rows: number;
  has_platform: boolean;
}

export async function loadCountyDemand(): Promise<CountyDemandRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('county_demand');
  if (error) throw error;
  return (data || []) as CountyDemandRow[];
}
