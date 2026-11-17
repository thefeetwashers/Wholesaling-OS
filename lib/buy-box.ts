// Slice 131 — the wholesaler's own buy box, for Buyer Networks.
//
// One row per wholesaler in public.wholesaler_buy_boxes (migration
// 20261117124100, UNIQUE(user_id), owner RLS + operator read).
// This holds ONLY the signed-in wholesaler's own buying criteria —
// markets, property types, price range, notes — so it can be copied
// into OpenBuyersList, where cash buyers publish their buy box.
// No buyer names, emails, phones, companies, or counts from
// OpenBuyersList are stored anywhere here: those buyers never
// consented to be in this platform and there is no feed to pull
// from. Money fields are numbers or null — never defaulted.

import { supabase, supabaseConfigured } from './supabase';

export interface BuyBox {
  id?: string;
  user_id?: string;
  markets: string[];
  property_types: string[];
  min_price: number | null;
  max_price: number | null;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

const BUY_BOX_SELECT =
  'id, user_id, markets, property_types, min_price, max_price, notes, created_at, updated_at';

export async function loadMyBuyBox(userId: string): Promise<BuyBox | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('wholesaler_buy_boxes')
    .select(BUY_BOX_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as BuyBox | null;
}

// Upsert on user_id (one buy box per wholesaler). Verified write:
// the saved row is selected back, and a missing row is an honest
// error — the save is never silently pretended to have worked.
export async function saveMyBuyBox(
  userId: string,
  box: Omit<BuyBox, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
): Promise<BuyBox> {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so the buy box was not saved. No buy box was faked.',
    );
  }
  const { data, error } = await supabase
    .from('wholesaler_buy_boxes')
    .upsert(
      {
        user_id: userId,
        markets: box.markets || [],
        property_types: box.property_types || [],
        min_price: box.min_price ?? null,
        max_price: box.max_price ?? null,
        notes: box.notes?.trim() || '',
      },
      { onConflict: 'user_id' },
    )
    .select(BUY_BOX_SELECT)
    .single();
  if (error) throw error;
  if (!data) throw new Error('The buy box was not saved — nothing was written.');
  return data as BuyBox;
}
