import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase client for auth + data. Values come ONLY from environment
// variables. No key is hardcoded here, and no key is in this repo.
// If the variables are missing, the app shows a setup checklist
// instead of pretending sync works.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null =
  supabaseConfigured && url && anonKey
    ? createClient(url, anonKey)
    : null;
