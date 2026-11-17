// Slice 132 — Marketplace counts, from REAL rows only.
//
// fetchMarketplaceCounts() counts published marketplace rows:
//   public.published_deals (published = true) and
//   public.wholesaler_buy_boxes (published = true).
// Those tables arrive with the Slice 132 migrations the other
// workers are running in parallel, so either table may not exist
// yet — or may not have its `published` column yet. A missing
// table or column is NOT an error here: that side reads as 0 and
// the dashboard keeps rendering. This function never throws, and
// it never invents a number: a 0 means "none published yet" (or
// "table not there yet"), never a seeded count. Callers show the
// numbers with that honest-zero note (see the OperatorStats
// pattern: a plain note on failure, never fake numbers).

import { supabase } from './supabase';

export interface MarketplaceCounts {
  publishedDeals: number;
  publishedBuyers: number;
}

const ZERO_COUNTS: MarketplaceCounts = { publishedDeals: 0, publishedBuyers: 0 };

export async function fetchMarketplaceCounts(): Promise<MarketplaceCounts> {
  if (!supabase) return { ...ZERO_COUNTS };
  let publishedDeals = 0;
  let publishedBuyers = 0;
  try {
    const { count, error } = await supabase
      .from('published_deals')
      .select('id', { count: 'exact', head: true })
      .eq('published', true);
    if (!error) publishedDeals = count ?? 0;
    // An error here (table or column not there yet) leaves the
    // honest 0 — the caller never sees a throw.
  } catch {
    // Missing table — honest 0, dashboard unaffected.
  }
  try {
    const { count, error } = await supabase
      .from('wholesaler_buy_boxes')
      .select('id', { count: 'exact', head: true })
      .eq('published', true);
    if (!error) publishedBuyers = count ?? 0;
  } catch {
    // Missing table or `published` column — honest 0.
  }
  return { publishedDeals, publishedBuyers };
}
