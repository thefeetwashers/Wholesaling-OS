import { supabase, supabaseConfigured } from './supabase';
import { loadIncomingOffers, loadBuyerRecord, loadMyListings } from './portals';

// Slice 43 — the wholesaler dashboard band: the four headline numbers
// and the pipeline stage tracker. Every figure is computed live from
// the wholesaler's own rows, with the definition printed next to it:
//   * Revenue = assignment fees on deals the wholesaler marked closed
//     (actual sale price recorded), bucketed by the month/year that
//     closing was recorded. Never pipeline, never projected.
//   * Active contracts = A–B signed and not yet closed.
//   * Cash buyers = the size of the wholesaler's own buyer list, plus
//     how many portal buyers have a real closing record here (Slice
//     38's counted record). Nobody is labeled "vetted" — the platform
//     verifies closings, not people.
//   * Pipeline stages trace to real states: leads in play, open
//     offers (negotiation), active contracts, escrow files with a
//     closing scheduled (ready to close).

export interface BandDeal {
  assignment_fee?: number | null;
  actual_sale_price?: number | null;
  updated_at?: string | null;
  documents?: { ab_status?: string } | null;
}

export interface DashboardBandData {
  revenueMonth: number;
  revenueYear: number;
  revenueMonthCount: number;
  revenueYearCount: number;
  activeContracts: number;
  feesInPipeline: number;
  buyersTotal: number;
  buyersWithClosings: number;
  stages: { leadsInPlay: number; inNegotiation: number; underContract: number; readyToClose: number };
  overdueFollowUps: number;
  dueToday: number;
}

export function summarizeBand(
  deals: BandDeal[],
  leads: { status: string; follow_up_date?: string | null }[],
  openOffers: number,
  buyersTotal: number,
  buyersWithClosings: number,
  readyToClose: number,
  now: Date,
): DashboardBandData {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const yearKey = `${now.getFullYear()}`;
  const todayISO = now.toISOString().slice(0, 10);
  let revenueMonth = 0; let revenueYear = 0; let revenueMonthCount = 0; let revenueYearCount = 0;
  let activeContracts = 0; let feesInPipeline = 0;
  for (const d of deals) {
    const signed = d.documents?.ab_status === 'Signed';
    const closed = d.actual_sale_price != null;
    if (closed) {
      const when = (d.updated_at || '').slice(0, 10);
      if (when.startsWith(yearKey)) { revenueYear += Number(d.assignment_fee || 0); revenueYearCount += 1; }
      if (when.startsWith(monthKey)) { revenueMonth += Number(d.assignment_fee || 0); revenueMonthCount += 1; }
    } else if (signed) {
      activeContracts += 1;
      feesInPipeline += Number(d.assignment_fee || 0);
    }
  }
  return {
    revenueMonth, revenueYear, revenueMonthCount, revenueYearCount,
    activeContracts, feesInPipeline,
    buyersTotal, buyersWithClosings,
    stages: {
      leadsInPlay: leads.filter((l) => l.status !== 'closed' && l.status !== 'dead').length,
      inNegotiation: openOffers,
      underContract: activeContracts,
      readyToClose,
    },
    overdueFollowUps: leads.filter((l) => l.follow_up_date && l.follow_up_date < todayISO && l.status !== 'closed' && l.status !== 'dead').length,
    dueToday: leads.filter((l) => l.follow_up_date === todayISO && l.status !== 'closed' && l.status !== 'dead').length,
  };
}

export async function loadDashboardBand(userId: string): Promise<DashboardBandData | null> {
  if (!supabaseConfigured || !supabase) return null;
  const [dealsRes, leadsRes, buyersRes, offers, listings] = await Promise.all([
    supabase.from('deals').select('assignment_fee, actual_sale_price, updated_at, documents').eq('owner_id', userId).limit(1000),
    supabase.from('leads').select('status, follow_up_date').eq('owner_id', userId).limit(1000),
    supabase.from('buyers').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    loadIncomingOffers(userId).catch(() => []),
    loadMyListings(userId).catch(() => []),
  ]);
  if (dealsRes.error) throw dealsRes.error;
  const deals = (dealsRes.data || []) as unknown as BandDeal[];
  const leads = (leadsRes.data || []) as { status: string; follow_up_date?: string | null }[];

  const openOffers = offers.filter((o) => o.status === 'sent' || o.status === 'countered').length;

  // Portal buyers with a real closing record (Slice 38's counted
  // record, one RPC per distinct buyer who offered on my listings).
  const buyerIds = Array.from(new Set(offers.map((o) => o.buyer_user).filter(Boolean))) as string[];
  let buyersWithClosings = 0;
  for (const b of buyerIds.slice(0, 50)) {
    const rec = await loadBuyerRecord(b).catch(() => null);
    if (rec && rec.closed_deals >= 1) buyersWithClosings += 1;
  }

  // Ready to close: my escrow files with a closing date scheduled
  // and an outcome that is still open.
  let readyToClose = 0;
  const listingIds = listings.map((l) => l.id).filter(Boolean) as string[];
  if (listingIds.length > 0) {
    const { data } = await supabase
      .from('escrow_files')
      .select('id, target_closing_date, outcome')
      .in('listing_id', listingIds)
      .limit(1000);
    readyToClose = ((data || []) as { target_closing_date?: string | null; outcome?: string | null }[])
      .filter((f) => f.target_closing_date && (!f.outcome || f.outcome === 'open'))
      .length;
  }

  return summarizeBand(
    deals, leads, openOffers,
    buyersRes.count ?? 0, buyersWithClosings, readyToClose, new Date(),
  );
}
