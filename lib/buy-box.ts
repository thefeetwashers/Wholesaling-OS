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
  // Slice 132 — publish this buy box to the public Cash Buyers
  // directory (/buyers). False by default: a buy box is private
  // until its owner turns publishing on.
  published: boolean;
  // Slice 132 follow-up (1) — automated matching. Target ZIP codes
  // (empty = no ZIP constraint) and rehab tolerance ('any' /
  // 'light' / 'moderate' / 'heavy'; null/empty = no preference).
  zip_codes: string[];
  rehab_tolerance: string | null;
  // Slice 132 follow-up (D) — U.S. state codes (empty = no state
  // constraint), so nationwide matching works later. Florida
  // remains the only state with live parcel data today; other
  // states join only after their real service URL is verified live.
  states: string[];
  // Slice 132 follow-up (5) — email-alert opt-in for the
  // match-and-email Edge Function. False by default: the function
  // only emails published buy boxes with this flag true.
  email_alerts_opt_in: boolean;
  // Slice 133 — OBL-style criteria FIELDS only (field names, never
  // OBL buyer data). All empty by default; empty = no constraint.
  // max_arv_pct: max % of ARV the buyer will pay (number or null).
  // min_profit: min profit $ the buyer needs (number or null).
  // condition_preferences / strategy_preferences: multi-selects
  // from the pinned lists below (empty = no preference).
  // closing_timeline: one of CLOSING_TIMELINE_OPTIONS, or null.
  max_arv_pct: number | null;
  min_profit: number | null;
  condition_preferences: string[];
  strategy_preferences: string[];
  closing_timeline: string | null;
  created_at?: string;
  updated_at?: string;
}

// The 5 pinned deal conditions — the same five the deal publish
// form and matching use (lib/match-buy-box.ts). Never varied.
export const CONDITION_OPTIONS = ['Turnkey', 'Light rehab', 'Moderate rehab', 'Heavy rehab', 'Gut rehab'];

// Strategy preferences for the buy box (free-form deal strategy
// is matched case-insensitively against these).
export const STRATEGY_OPTIONS = ['Fix & Flip', 'Rental', 'BRRRR', 'Wholesale', 'New Build', 'Creative Finance', 'Other'];

// Closing-timeline options. The value is the whole label, stored
// as-is; matching reads the max days from it (30+ days = no max).
export const CLOSING_TIMELINE_OPTIONS = ['7 days or less', '8-14 days', '15-30 days', '30+ days'];

const BUY_BOX_SELECT =
  'id, user_id, markets, property_types, min_price, max_price, notes, published, zip_codes, rehab_tolerance, states, email_alerts_opt_in, max_arv_pct, min_profit, condition_preferences, strategy_preferences, closing_timeline, created_at, updated_at';

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
        published: box.published ?? false,
        zip_codes: (box.zip_codes || []).map((z) => z.trim()).filter(Boolean),
        rehab_tolerance: ['any', 'light', 'moderate', 'heavy'].includes((box.rehab_tolerance || '').trim().toLowerCase())
          ? (box.rehab_tolerance as string).trim().toLowerCase()
          : null,
        states: (box.states || []).map((s) => s.trim().toUpperCase()).filter(Boolean),
        email_alerts_opt_in: box.email_alerts_opt_in === true,
        // Slice 133 criteria — stored only when set; a non-finite
        // number reads as empty, and a preference outside the
        // pinned lists is dropped, never stored as junk.
        max_arv_pct: typeof box.max_arv_pct === 'number' && Number.isFinite(box.max_arv_pct) ? box.max_arv_pct : null,
        min_profit: typeof box.min_profit === 'number' && Number.isFinite(box.min_profit) ? box.min_profit : null,
        condition_preferences: (box.condition_preferences || []).filter((c) => CONDITION_OPTIONS.includes(c)),
        strategy_preferences: (box.strategy_preferences || []).filter((s) => STRATEGY_OPTIONS.includes(s)),
        closing_timeline: CLOSING_TIMELINE_OPTIONS.includes(box.closing_timeline || '') ? (box.closing_timeline as string) : null,
      },
      { onConflict: 'user_id' },
    )
    .select(BUY_BOX_SELECT)
    .single();
  if (error) throw error;
  if (!data) throw new Error('The buy box was not saved — nothing was written.');
  return data as BuyBox;
}
