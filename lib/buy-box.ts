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
  // Slice 134 — SMS-alert opt-in for the match-and-text path.
  // False by default. This records the preference only: the
  // matching SMS alert is not built, so checking it sends nothing
  // today and must never be shown as "alerts on".
  sms_opt_in: boolean;
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
  'id, user_id, markets, property_types, min_price, max_price, notes, published, zip_codes, rehab_tolerance, states, email_alerts_opt_in, sms_opt_in, max_arv_pct, min_profit, condition_preferences, strategy_preferences, closing_timeline, created_at, updated_at';

export async function loadMyBuyBox(userId: string): Promise<BuyBox | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('wholesaler_buy_boxes')
    .select(BUY_BOX_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // Defensive read (Slice 134): the sms_opt_in column lands with
    // the Slice 134 migration; before it is applied this select
    // errors, so retry without that column and default it false
    // rather than failing the whole buy-box load.
    if (/sms_opt_in/.test(error.message || '')) {
      const fallback = await supabase
        .from('wholesaler_buy_boxes')
        .select(BUY_BOX_SELECT.replace(', sms_opt_in', ''))
        .eq('user_id', userId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      if (!fallback.data) return null;
      return { ...(fallback.data as unknown as BuyBox), sms_opt_in: false };
    }
    throw error;
  }
  return (data || null) as BuyBox | null;
}

// Slice 136 — buy-box merge: the legacy public.buy_boxes table
// (lib/portals.ts) is retired from the app. Every buy-box read now
// goes through this table, public.wholesaler_buy_boxes — one row
// per wholesaler, UNIQUE(user_id). Published boxes only are
// readable in aggregate: a box counts as platform demand only
// once its owner turns publishing on. Unpublished boxes are
// visible to their owner alone (their own portal, their own
// matching), never to anyone else.
export async function loadAllPublishedBuyBoxes(): Promise<BuyBox[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('wholesaler_buy_boxes')
    .select(BUY_BOX_SELECT)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    // Same Slice 134 defensive read as loadMyBuyBox above: before
    // the sms_opt_in column is applied, retry without it.
    if (/sms_opt_in/.test(error.message || '')) {
      const fallback = await supabase
        .from('wholesaler_buy_boxes')
        .select(BUY_BOX_SELECT.replace(', sms_opt_in', ''))
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(200);
      if (fallback.error) throw fallback.error;
      return ((fallback.data || []) as unknown as BuyBox[]).map((b) => ({ ...b, sms_opt_in: false }));
    }
    throw error;
  }
  return (data || []) as BuyBox[];
}

// A marketplace listing matches a buy box when its total cost
// sits inside the box price range (when set) and its property
// address text contains one of the box's markets/states (when
// set). Address is free text on the deal, so this is a plain
// text match — labeled as such in the UI. Moved from
// lib/portals.ts (Slice 136) and adapted to the live BuyBox
// shape: markets are county names, states are 2-letter codes;
// the legacy label / cities / counties / min_beds fields do not
// exist on this table. Published is NOT checked here — the
// caller's own box matches their own feed whether or not they
// have published it; callers aggregating other people's boxes
// must pass published boxes (loadAllPublishedBuyBoxes above).
export interface FeedListingForMatch {
  total_marketplace_cost: number;
  deals?: { documents?: { property_address?: string; city?: string; state?: string } | null } | null;
}

export function listingMatchesBox(listing: FeedListingForMatch, box: BuyBox): boolean {
  const cost = Number(listing.total_marketplace_cost);
  if (box.min_price != null && cost < Number(box.min_price)) return false;
  if (box.max_price != null && cost > Number(box.max_price)) return false;
  const places = [...(box.markets || []), ...(box.states || [])]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (places.length) {
    const docs = listing.deals?.documents;
    const hay = [docs?.property_address || '', docs?.city || '', docs?.state || ''].join(' ').toLowerCase();
    if (!places.some((p) => hay.includes(p))) return false;
  }
  return true;
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
        // Slice 134 — SMS-alert preference, false by default.
        sms_opt_in: box.sms_opt_in === true,
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
