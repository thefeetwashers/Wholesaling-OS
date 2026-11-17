// Slice 133 — saved searches for buyers.
//
// A signed-in buyer saves the search criteria they are filtering
// the public Cash Buyers directory (/buyers) by — states,
// markets (counties), property types, price range — and applies
// or deletes them later. One row per saved search in
// public.buyer_saved_searches (migration
// 20261117143000_slice133_saved_searches.sql, owner RLS +
// operator read). The criteria mirror the /buyers filters
// exactly, so applying a search is just restoring filter state.
//
// Matching deals show IN THE APP ONLY: applying a search filters
// the directory, and /vip already shows matching published deals
// in the app. NO email alerts — no email provider is connected,
// so nothing here sends email or SMS, and no alert is claimed.
// Money fields are numbers or null — never defaulted.

import { supabase, supabaseConfigured } from './supabase';

export interface BuyerSavedSearch {
  id?: string;
  user_id?: string;
  name: string;
  states: string[];
  markets: string[];
  property_types: string[];
  min_price: number | null;
  max_price: number | null;
  created_at?: string;
}

export type SavedSearchCriteria = Omit<BuyerSavedSearch, 'id' | 'user_id' | 'created_at'>;

const SAVED_SEARCH_SELECT =
  'id, user_id, name, states, markets, property_types, min_price, max_price, created_at';

// Human label for a search, from its criteria only — no invented
// names. Empty criteria reads as "All buyers".
export function savedSearchLabel(s: SavedSearchCriteria): string {
  const parts: string[] = [];
  if (s.states.length > 0) parts.push(s.states.join(', '));
  if (s.markets.length > 0) parts.push(s.markets.join(', '));
  if (s.property_types.length > 0) parts.push(s.property_types.join(', '));
  const lo = s.min_price != null ? `$${Number(s.min_price).toLocaleString()}` : '';
  const hi = s.max_price != null ? `$${Number(s.max_price).toLocaleString()}` : '';
  if (lo || hi) parts.push(`${lo || 'no min'} – ${hi || 'no max'}`);
  return parts.length > 0 ? parts.join(' · ') : 'All buyers';
}

export async function loadMySavedSearches(userId: string): Promise<BuyerSavedSearch[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('buyer_saved_searches')
    .select(SAVED_SEARCH_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BuyerSavedSearch[];
}

// Insert only — a saved search is never edited in place; the
// buyer saves the current filters again or deletes the old row.
export async function saveSavedSearch(
  userId: string,
  criteria: SavedSearchCriteria,
): Promise<BuyerSavedSearch> {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so the search was not saved. Nothing was saved.',
    );
  }
  const { data, error } = await supabase
    .from('buyer_saved_searches')
    .insert({
      user_id: userId,
      name: criteria.name?.trim() || savedSearchLabel(criteria),
      states: (criteria.states || []).map((s) => s.trim().toUpperCase()).filter(Boolean),
      markets: (criteria.markets || []).map((m) => m.trim()).filter(Boolean),
      property_types: criteria.property_types || [],
      min_price: criteria.min_price ?? null,
      max_price: criteria.max_price ?? null,
    })
    .select(SAVED_SEARCH_SELECT)
    .single();
  if (error) throw error;
  if (!data) throw new Error('The search was not saved — nothing was written.');
  return data as BuyerSavedSearch;
}

export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('buyer_saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
