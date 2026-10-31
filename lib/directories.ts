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
