// Slice 132 — automated buy-box matching (follow-ups (1) + (D)).
//
// PINNED CONTRACT (another worker imports this file — do not break
// these interfaces; the coordinator notifies other workers of
// changes separately):
//   DealForMatching, BuyBoxForMatching, DealSummary,
//   dealMatchesBuyBox(deal, box), findMatchingBuyers(deal),
//   findMatchingDeals(box).
//
// Matches are computed ON READ — no background jobs, no cron.
// No email/SMS alerts anywhere: no email or SMS provider is
// connected and the founder has none. Matching is shown IN THE
// APP ONLY; nothing is sent, and no alert is ever claimed sent.
//
// dealMatchesBuyBox is a pure function (no I/O). A published deal
// matches a published buy box when ALL of these hold:
//   * Geography: the deal county overlaps the box markets OR the
//     deal ZIP overlaps the box zip_codes. If BOTH markets and
//     zip_codes are empty, that criterion is no constraint and
//     passes.
//   * State: if box.states is empty, the state criterion passes
//     (no constraint); otherwise the deal's state — normalized to
//     an uppercase 2-letter code, trimmed — must be in box.states
//     (compared case-insensitively).
//   * Property type: box.property_types empty, or the deal's
//     property_type is in it.
//   * Price: min_price null, or asking_price >= min_price; and
//     max_price null, or asking_price <= max_price. A null
//     asking_price passes the price check.
//   * Rehab tolerance (deal condition values are EXACTLY
//     'Turnkey', 'Light rehab', 'Moderate rehab', 'Heavy rehab',
//     'Gut rehab' — never varied here): 'any'/null/empty passes
//     all conditions; 'light' passes Turnkey + Light rehab;
//     'moderate' passes Turnkey + Light rehab + Moderate rehab;
//     'heavy' passes all conditions. A null deal condition passes.
//     Any other tolerance value is treated as no preference.
//   * Slice 133 criteria — each used ONLY when the buyer set it;
//     empty is no constraint, and a deal missing the compared
//     value passes that check (never excluded on unknown data):
//     - Condition preferences: deal condition must be in the
//       buyer's list (empty list = no preference).
//     - Strategy preferences: the deal's free-text strategy must
//       match one of the buyer's list, case-insensitively.
//     - Max ARV %: asking_price must be <= pct% of the deal ARV.
//     - Min profit $: deal ARV − asking_price − repair_estimate
//       (repairs 0 when unknown — the same spread the deal blast
//       computes) must be >= min_profit.
//       Deal ARV for both = arv_high when set, else arv_low; a
//       deal with no ARV at all passes both ARV checks.
//     - Closing timeline: the buyer must be able to close by the
//       deal's close_by date — days from today until close_by
//       must be >= the timeline's max days (7 / 14 / 30;
//       '30+ days' has no max and always passes). A deal with no
//       close_by passes; an unparseable close_by passes.
// Comparisons are trimmed and case-insensitive throughout, so a
// 'st. lucie' county or 'fl' state still matches.
//
// County (coordinator reconciliation, Nov 17, 2026):
// public.published_deals carries a county column (migration
// 20261117130000), so DealSummary carries it and findMatchingDeals
// passes it through — the geography rule uses county OR ZIP in
// both directions now.

import { supabase, supabaseConfigured } from './supabase';

export interface DealForMatching {
  county: string | null;
  zip: string | null;
  property_type: string | null;
  asking_price: number | null;
  condition: string | null;
  state: string | null;
  // Slice 133 — optional deal-side values for the new criteria.
  // Absent (undefined) reads as "not known" and passes the
  // check it feeds, same as null.
  arv_low?: number | null;
  arv_high?: number | null;
  repair_estimate?: number | null;
  strategy?: string | null;
  close_by?: string | null;
}

export interface BuyBoxForMatching {
  user_id: string;
  // Public-safe display name + company, from the buyer's
  // storefront_profiles row when one exists (the same fields the
  // public /buyers directory shows). Attached by
  // findMatchingBuyers only; null when the buyer has no storefront
  // profile — never invented.
  display_name?: string | null;
  company_name?: string | null;
  markets: string[];
  zip_codes: string[];
  property_types: string[];
  min_price: number | null;
  max_price: number | null;
  rehab_tolerance: string | null;
  states: string[];
  // Slice 133 criteria — all optional; undefined/null/empty is
  // no constraint. Added as optional fields so existing callers
  // constructing this interface keep compiling (pinned contract).
  max_arv_pct?: number | null;
  min_profit?: number | null;
  condition_preferences?: string[];
  strategy_preferences?: string[];
  closing_timeline?: string | null;
}

export interface DealSummary {
  id: string;
  city: string | null;
  state: string | null;
  county: string | null;
  zip: string | null;
  property_type: string | null;
  asking_price: number | null;
  condition: string | null;
  // Slice 133 — carried so findMatchingDeals can apply the new
  // criteria without a second read.
  arv_low: number | null;
  arv_high: number | null;
  repair_estimate: number | null;
  strategy: string | null;
  close_by: string | null;
}

const norm = (v: string | null | undefined): string =>
  (v || '').trim().toLowerCase();
const normList = (xs: string[] | null | undefined): string[] =>
  (xs || []).map((x) => norm(x)).filter(Boolean);

// Deal condition values are exactly these five — do not vary them.
const LIGHT_OK = ['turnkey', 'light rehab'];
const MODERATE_OK = ['turnkey', 'light rehab', 'moderate rehab'];

function rehabPasses(condition: string | null, tolerance: string | null): boolean {
  if (condition == null || norm(condition) === '') return true;
  const t = norm(tolerance);
  if (t === '' || t === 'any' || t === 'heavy') return true;
  if (t === 'light') return LIGHT_OK.includes(norm(condition));
  if (t === 'moderate') return MODERATE_OK.includes(norm(condition));
  // Unknown tolerance value: no preference, never silently exclude.
  return true;
}

export function dealMatchesBuyBox(deal: DealForMatching, box: BuyBoxForMatching): boolean {
  // Geography: county overlaps markets OR zip overlaps zip_codes;
  // both empty on the box side means no constraint.
  const markets = normList(box.markets);
  const zips = normList(box.zip_codes);
  const geoConstrained = markets.length > 0 || zips.length > 0;
  if (geoConstrained) {
    const countyHit = markets.length > 0 && markets.includes(norm(deal.county));
    const zipHit = zips.length > 0 && zips.includes(norm(deal.zip));
    if (!countyHit && !zipHit) return false;
  }

  // State: empty box.states means no constraint; otherwise the
  // deal state (uppercase 2-letter code, trimmed) must be listed.
  const states = (box.states || []).map((s) => (s || '').trim().toUpperCase()).filter(Boolean);
  if (states.length > 0) {
    const dealState = (deal.state || '').trim().toUpperCase();
    if (!dealState || !states.includes(dealState)) return false;
  }

  // Property type: empty box list means no constraint.
  const types = normList(box.property_types);
  if (types.length > 0 && !types.includes(norm(deal.property_type))) return false;

  // Price: a null asking price passes the price check.
  if (deal.asking_price != null) {
    if (box.min_price != null && deal.asking_price < box.min_price) return false;
    if (box.max_price != null && deal.asking_price > box.max_price) return false;
  }

  // Rehab tolerance.
  if (!rehabPasses(deal.condition, box.rehab_tolerance)) return false;

  // Slice 133 criteria — each only when the buyer set it.
  // Condition preferences: a stated deal condition must be one
  // the buyer picked; an unstated condition passes.
  const condPrefs = normList(box.condition_preferences);
  if (condPrefs.length > 0 && norm(deal.condition) !== '' && !condPrefs.includes(norm(deal.condition))) return false;

  // Strategy preferences: a stated deal strategy must match one
  // the buyer picked (case-insensitive); unstated passes.
  const stratPrefs = normList(box.strategy_preferences);
  if (stratPrefs.length > 0 && norm(deal.strategy) !== '' && !stratPrefs.includes(norm(deal.strategy))) return false;

  // Max ARV % and min profit: both need a deal ARV (arv_high
  // when set, else arv_low) and an asking price; a deal missing
  // either passes both checks.
  const dealArv = deal.arv_high != null ? deal.arv_high : deal.arv_low;
  if (dealArv != null && deal.asking_price != null) {
    if (box.max_arv_pct != null && deal.asking_price > (dealArv * box.max_arv_pct) / 100) return false;
    if (box.min_profit != null) {
      const repairs = deal.repair_estimate != null ? deal.repair_estimate : 0;
      if (dealArv - deal.asking_price - repairs < box.min_profit) return false;
    }
  }

  // Closing timeline: the buyer must be able to close by the
  // deal's close_by date. '30+ days' has no max and always
  // passes; a deal with no (or unparseable) close_by passes.
  if (!closingTimelinePasses(deal.close_by, box.closing_timeline)) return false;

  return true;
}

// Max days to close for a timeline label ('30+ days' = no max).
// Unknown/empty timeline reads as no preference.
function closingTimelineMaxDays(timeline: string | null | undefined): number | null {
  const t = norm(timeline);
  if (t === '7 days or less') return 7;
  if (t === '8-14 days') return 14;
  if (t === '15-30 days') return 30;
  return null;
}

function closingTimelinePasses(closeBy: string | null | undefined, timeline: string | null | undefined): boolean {
  const maxDays = closingTimelineMaxDays(timeline);
  if (maxDays == null) return true;
  if (closeBy == null || norm(closeBy) === '') return true;
  // close_by is a date (YYYY-MM-DD). Whole days from today
  // (midnight) until that date; an unparseable value passes.
  const close = new Date(`${closeBy.trim().slice(0, 10)}T00:00:00`);
  if (Number.isNaN(close.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((close.getTime() - today.getTime()) / 86400000);
  return daysUntil >= maxDays;
}

const BUY_BOX_MATCH_SELECT =
  'user_id, markets, zip_codes, property_types, min_price, max_price, rehab_tolerance, states, max_arv_pct, min_profit, condition_preferences, strategy_preferences, closing_timeline';

function rowToBox(row: Record<string, unknown>): BuyBoxForMatching {
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)) : [];
  const num = (v: unknown): number | null =>
    typeof v === 'number' ? v : v == null ? null : Number(v);
  return {
    user_id: typeof row.user_id === 'string' ? row.user_id : '',
    markets: list(row.markets),
    zip_codes: list(row.zip_codes),
    property_types: list(row.property_types),
    min_price: num(row.min_price),
    max_price: num(row.max_price),
    rehab_tolerance: typeof row.rehab_tolerance === 'string' ? row.rehab_tolerance : null,
    states: list(row.states),
    // Slice 133 criteria. A row from before migration
    // 20261117145000 has no such columns — but the select above
    // would already have failed then, and the caller degrades
    // to no matches (same as the existing missing-table path).
    max_arv_pct: num(row.max_arv_pct),
    min_profit: num(row.min_profit),
    condition_preferences: list(row.condition_preferences),
    strategy_preferences: list(row.strategy_preferences),
    closing_timeline: typeof row.closing_timeline === 'string' ? row.closing_timeline : null,
  };
}

// Published buy boxes that match this deal. A missing table (or a
// table without the published column yet — the Slice 132 migrations
// land separately) is NOT an error: it reads as no matches, and
// this function never throws into a page.
export async function findMatchingBuyers(deal: DealForMatching): Promise<BuyBoxForMatching[]> {
  if (!supabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('wholesaler_buy_boxes')
      .select(BUY_BOX_MATCH_SELECT)
      .eq('published', true);
    if (error || !data) return [];
    const matched = (data as Record<string, unknown>[]).map(rowToBox).filter((b) => dealMatchesBuyBox(deal, b));
    // Attach the public-safe display name + company from each
    // matched buyer's storefront_profiles row (the same fields
    // the public /buyers directory shows). A missing profile or a
    // failed lookup leaves the fields null — never invented, and
    // never a reason to drop a real match.
    // Slice 133 fix (Nov 17, 2026): the key is wholesaler_id,
    // not user_id — migration 20261115130000 (Slice 124) defines
    // storefront_profiles.wholesaler_id as the primary key. The
    // old select on user_id errored, so names silently stayed
    // null; matches themselves were never affected.
    try {
      const ids = [...new Set(matched.map((b) => b.user_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('storefront_profiles')
          .select('wholesaler_id, display_name, company_name')
          .in('wholesaler_id', ids);
        const byUser = new Map<string, { display_name: string | null; company_name: string | null }>();
        for (const p of (profiles || []) as Record<string, unknown>[]) {
          if (typeof p.wholesaler_id === 'string') {
            byUser.set(p.wholesaler_id, {
              display_name: typeof p.display_name === 'string' ? p.display_name : null,
              company_name: typeof p.company_name === 'string' ? p.company_name : null,
            });
          }
        }
        for (const b of matched) {
          const prof = byUser.get(b.user_id);
          b.display_name = prof?.display_name ?? null;
          b.company_name = prof?.company_name ?? null;
        }
      }
    } catch {
      // Names stay null; the matches themselves still stand.
    }
    return matched;
  } catch {
    return [];
  }
}

const DEAL_SUMMARY_SELECT = 'id, city, state, county, zip, property_type, asking_price, condition, arv_low, arv_high, repair_estimate, strategy, close_by';

// Published deals that match this buy box. Same graceful [] on a
// missing table or error. The deal county is carried in
// DealSummary, so this direction matches geography on county OR
// ZIP, same as the other direction.
export async function findMatchingDeals(box: BuyBoxForMatching): Promise<DealSummary[]> {
  if (!supabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('published_deals')
      .select(DEAL_SUMMARY_SELECT)
      .eq('published', true);
    if (error || !data) return [];
    const summaries = (data as Record<string, unknown>[]).map((row) => ({
      id: typeof row.id === 'string' ? row.id : '',
      city: typeof row.city === 'string' ? row.city : null,
      state: typeof row.state === 'string' ? row.state : null,
      county: typeof row.county === 'string' ? row.county : null,
      zip: typeof row.zip === 'string' ? row.zip : null,
      property_type: typeof row.property_type === 'string' ? row.property_type : null,
      asking_price: typeof row.asking_price === 'number' ? row.asking_price : null,
      condition: typeof row.condition === 'string' ? row.condition : null,
      arv_low: typeof row.arv_low === 'number' ? row.arv_low : null,
      arv_high: typeof row.arv_high === 'number' ? row.arv_high : null,
      repair_estimate: typeof row.repair_estimate === 'number' ? row.repair_estimate : null,
      strategy: typeof row.strategy === 'string' ? row.strategy : null,
      close_by: typeof row.close_by === 'string' ? row.close_by : null,
    })) as DealSummary[];
    return summaries.filter((d) =>
      dealMatchesBuyBox(
        {
          county: d.county,
          zip: d.zip,
          property_type: d.property_type,
          asking_price: d.asking_price,
          condition: d.condition,
          state: d.state,
          arv_low: d.arv_low,
          arv_high: d.arv_high,
          repair_estimate: d.repair_estimate,
          strategy: d.strategy,
          close_by: d.close_by,
        },
        box,
      ),
    );
  } catch {
    return [];
  }
}
