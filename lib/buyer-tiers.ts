import type { BuyerRecord } from './portals';

// Slice 38 — earned buyer tiers. Tiers are derived ONLY from the
// database-counted platform record built in Slice 21: accepted offers,
// B-C signings, and wholesaler-marked escrow outcomes. They are never
// copied from the private Buyer CRM's manual working tier, a buyer's
// self-description, or any outside list.
//
// Published rules (shown verbatim in the UI):
// - Tier 1, Proven closer: 3 or more platform closings.
// - Tier 2, Verified closer: 1-2 platform closings.
// - Tier 3, Building record: no platform closings yet.
// - Caution overrides the numbered tiers when more escrows fell
//   through than closed.

export type BuyerTierKey = 'tier1' | 'tier2' | 'tier3' | 'caution';

export interface BuyerTier {
  key: BuyerTierKey;
  label: string;
  rank: number;
}

export interface BuyerTierSummary {
  buyerUser: string;
  record: BuyerRecord;
  tier: BuyerTier;
  offersCount: number;
  latestAddress: string;
  completionRatePct: number | null;
}

function count(v: number | undefined): number {
  return Number.isFinite(v) && v && v > 0 ? Math.floor(v) : 0;
}

export function buyerTier(record: BuyerRecord): BuyerTier {
  const closed = count(record.closed_deals);
  const fellThrough = count(record.fell_through);

  if (fellThrough > closed && fellThrough > 0) {
    return { key: 'caution', label: 'Caution — more fell through than closed', rank: 4 };
  }
  if (closed >= 3) {
    return { key: 'tier1', label: 'Tier 1 — Proven closer', rank: 1 };
  }
  if (closed >= 1) {
    return { key: 'tier2', label: 'Tier 2 — Verified closer', rank: 2 };
  }
  return { key: 'tier3', label: 'Tier 3 — Building record', rank: 3 };
}

export function completionRatePct(record: BuyerRecord): number | null {
  const closed = count(record.closed_deals);
  const fellThrough = count(record.fell_through);
  const resolved = closed + fellThrough;
  return resolved > 0 ? (closed / resolved) * 100 : null;
}

export function compareBuyerTierSummaries(a: BuyerTierSummary, b: BuyerTierSummary): number {
  if (a.tier.rank !== b.tier.rank) return a.tier.rank - b.tier.rank;
  if (a.record.closed_deals !== b.record.closed_deals) return b.record.closed_deals - a.record.closed_deals;
  const aRate = a.completionRatePct ?? -1;
  const bRate = b.completionRatePct ?? -1;
  if (aRate !== bRate) return bRate - aRate;
  if (a.record.accepted_deals !== b.record.accepted_deals) return b.record.accepted_deals - a.record.accepted_deals;
  return a.buyerUser.localeCompare(b.buyerUser);
}
