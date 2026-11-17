import { supabase, supabaseConfigured } from './supabase';

// Slice 133 — buyer offers on a published deal.
//
// An offer is a real, structured bid: offer price (required),
// earnest-money amount (optional), closing date (optional), with
// a lifecycle pending -> accepted / declined / withdrawn. It lives
// in its own table, public.deal_offers — deal_responses (Slice
// 132) is NOT extended: a response is a free-text message with a
// mutual-opt-in contact flow, an offer is money with a decision,
// and one buyer may both respond to a deal and offer on it.
// Bolting money columns onto every message row would conflate the
// two flows; a separate table keeps them, their lifecycles, and
// their RLS apart, with no duplicate table.
//
// Money is never pre-filled: the offer form starts empty, and
// submitOffer rejects a missing or non-positive price rather than
// inventing one. Offers are visible only to the offering buyer,
// the deal owner, and the operator (RLS in migration
// 20261117140000) — never to other buyers, never to anon.
//
// Who may set which status is enforced here, by role — the same
// precedent as the Slice 132 contact-share flags, which RLS gates
// by row, not by value:
//   * decideOffer ('accepted' | 'declined') — the deal owner only.
//     The update selects its row back, so a refused save throws
//     instead of looking decided.
//   * withdrawOffer ('withdrawn') — the offering buyer only.
// Accepting one offer does NOT auto-decline the others; the owner
// declines each one. Nothing here files, sends, or signs anything:
// an accepted offer is a decision in the app, and the assignment
// contract is drafted separately (see the deal detail page,
// which hands the accepted offer to the existing generator).

export type DealOfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export interface DealOffer {
  id?: string;
  deal_id: string;
  buyer_id?: string;
  offer_price: number;
  emd_amount?: number | null;
  closing_date?: string | null;
  status?: DealOfferStatus;
  created_at?: string;
  updated_at?: string;
}

export interface DealOfferInput {
  offer_price: number | null;
  emd_amount?: number | null;
  closing_date?: string | null;
}

export interface BuyerPublicName {
  display_name: string | null;
  company_name: string | null;
}

const OFFER_SELECT =
  'id, deal_id, buyer_id, offer_price, emd_amount, closing_date, status, created_at, updated_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so nothing was submitted. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Slice 133 migration, then try again. No submission was faked.'
    );
  }
  return supabase;
}

function cleanOfferInput(input: DealOfferInput): { offer_price: number; emd_amount: number | null; closing_date: string | null } {
  const price =
    typeof input.offer_price === 'number' && Number.isFinite(input.offer_price) ? input.offer_price : null;
  if (price == null || price <= 0) {
    throw new Error('Enter an offer price above $0 — the price is never filled in for you.');
  }
  const emd =
    typeof input.emd_amount === 'number' && Number.isFinite(input.emd_amount) ? input.emd_amount : null;
  if (emd != null && emd < 0) {
    throw new Error('Earnest money cannot be negative.');
  }
  const closing =
    typeof input.closing_date === 'string' && input.closing_date.trim()
      ? input.closing_date.trim()
      : null;
  if (closing != null && Number.isNaN(new Date(`${closing}T12:00:00`).getTime())) {
    throw new Error('Enter a valid closing date, or leave it blank.');
  }
  return { offer_price: price, emd_amount: emd, closing_date: closing };
}

// A signed-in buyer submits an offer on a published deal. The
// buyer_id is the caller's own id — RLS refuses anything else.
export async function submitOffer(
  userId: string,
  dealId: string,
  input: DealOfferInput
): Promise<DealOffer> {
  const client = requireSupabase();
  const clean = cleanOfferInput(input);
  const { data, error } = await client
    .from('deal_offers')
    .insert({ deal_id: dealId, buyer_id: userId, status: 'pending', ...clean })
    .select(OFFER_SELECT)
    .single();
  if (error) throw error;
  return data as DealOffer;
}

// Offers on the caller's own deal (the owner reads them). RLS
// still enforces ownership — another wholesaler's offers never
// return.
export async function fetchOffersForDeal(dealId: string): Promise<DealOffer[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('deal_offers')
    .select(OFFER_SELECT)
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as DealOffer[];
}

// Offers the signed-in user made on one deal.
export async function fetchMyOffersForDeal(userId: string, dealId: string): Promise<DealOffer[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('deal_offers')
    .select(OFFER_SELECT)
    .eq('deal_id', dealId)
    .eq('buyer_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as DealOffer[];
}

// The deal owner accepts or declines a pending offer on their own
// deal. Only 'accepted' or 'declined' may be set here — a
// withdrawal goes through withdrawOffer, by the buyer.
export async function decideOffer(
  offerId: string,
  decision: 'accepted' | 'declined'
): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('deal_offers')
    .update({ status: decision })
    .eq('id', offerId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'The offer could not be decided — it may already be decided or withdrawn, it may not be your deal, or the Slice 133 migration has not been applied yet.'
    );
  }
}

// The offering buyer withdraws their own pending offer. Only
// 'withdrawn' may be set here.
export async function withdrawOffer(offerId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('deal_offers')
    .update({ status: 'withdrawn' })
    .eq('id', offerId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'The offer could not be withdrawn — it may already be decided, or the Slice 133 migration has not been applied yet.'
    );
  }
}

// Public-safe names for offer makers: display name + company from
// each buyer's storefront_profiles row — the same public fields
// the /buyers directory shows. The table's key is wholesaler_id
// (Slice 124 migration), not user_id. A missing profile leaves
// both fields null — never invented, and never a reason to drop a
// real offer from the list.
export async function fetchBuyerPublicNames(
  buyerIds: string[]
): Promise<Record<string, BuyerPublicName>> {
  const out: Record<string, BuyerPublicName> = {};
  const ids = [...new Set((buyerIds || []).filter(Boolean))];
  if (ids.length === 0 || !supabaseConfigured || !supabase) return out;
  try {
    const { data, error } = await supabase
      .from('storefront_profiles')
      .select('wholesaler_id, display_name, company_name')
      .in('wholesaler_id', ids);
    if (error || !data) return out;
    for (const p of data as Record<string, unknown>[]) {
      if (typeof p.wholesaler_id === 'string') {
        out[p.wholesaler_id] = {
          display_name: typeof p.display_name === 'string' ? p.display_name : null,
          company_name: typeof p.company_name === 'string' ? p.company_name : null,
        };
      }
    }
  } catch {
    // Names stay blank; the offers themselves still stand.
  }
  return out;
}

// LocalStorage key carrying an accepted offer from the deal detail
// page (/deals/[id]) to the dashboard contracts view. The payload
// is a ContractPrefill plus the deal + offer ids, so the dashboard
// can check the signed-in user still owns that deal before it
// opens the generator. The key is consumed (removed) on read.
export const CONTRACT_PREFILL_HANDOFF_KEY = 'ws_contract_prefill';
