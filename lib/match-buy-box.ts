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

  return true;
}

const BUY_BOX_MATCH_SELECT =
  'user_id, markets, zip_codes, property_types, min_price, max_price, rehab_tolerance, states';

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
    try {
      const ids = [...new Set(matched.map((b) => b.user_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('storefront_profiles')
          .select('user_id, display_name, company_name')
          .in('user_id', ids);
        const byUser = new Map<string, { display_name: string | null; company_name: string | null }>();
        for (const p of (profiles || []) as Record<string, unknown>[]) {
          if (typeof p.user_id === 'string') {
            byUser.set(p.user_id, {
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

const DEAL_SUMMARY_SELECT = 'id, city, state, county, zip, property_type, asking_price, condition';

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
        },
        box,
      ),
    );
  } catch {
    return [];
  }
}
