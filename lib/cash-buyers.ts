// Slice 129 — cash buyers loader for the master search.
//
// components/CashBuyersDealBlast.tsx queries cash_buyers directly
// for its own table; the GlobalSearch needs the same rows without
// duplicating the query. Columns are the real ones from migration
// 20261115160000 (name, company, email, phone — NOT buyer_name /
// company_name, which do not exist on this table).

import { supabase, supabaseConfigured } from './supabase';

export interface CashBuyerRow {
  id?: string;
  user_id?: string;
  name: string;
  company?: string | null;
  email: string;
  phone?: string | null;
  target_counties?: string[];
  max_budget?: number | null;
  min_beds?: number | null;
  property_types?: string[];
  pof_verified: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export async function loadCashBuyers(userId: string): Promise<CashBuyerRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('cash_buyers')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as CashBuyerRow[];
}
