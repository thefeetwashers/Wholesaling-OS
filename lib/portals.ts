import { supabase, supabaseConfigured } from './supabase';

// Slice 9 — Full Portals foundation (schema v3). Roles live on profiles.role.
// Every query here is scoped by Supabase RLS; nothing is faked client-side.

export type PortalRole = 'wholesaler' | 'buyer' | 'seller' | 'title';
export const PORTAL_ROLES: PortalRole[] = ['wholesaler', 'buyer', 'seller', 'title'];
export const ROLE_LABELS: Record<PortalRole, string> = {
  wholesaler: 'Wholesaler',
  buyer: 'Cash Buyer',
  seller: 'Seller',
  title: 'Title Company',
};

export interface MyProfile {
  id: string;
  email: string;
  role: PortalRole;
}

export async function loadMyProfile(userId: string): Promise<MyProfile | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as MyProfile;
}

export async function setMyRole(userId: string, role: PortalRole): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

export interface BuyBox {
  id?: string;
  user_id?: string;
  label: string;
  states: string[];
  counties: string[];
  cities: string[];
  property_types: string[];
  price_min?: number | null;
  price_max?: number | null;
  min_beds?: number | null;
  active: boolean;
}

export async function loadMyBuyBoxes(userId: string): Promise<BuyBox[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('buy_boxes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BuyBox[];
}

export async function saveBuyBox(userId: string, box: BuyBox): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('buy_boxes').insert({ ...box, user_id: userId });
  if (error) throw error;
}

export async function deleteBuyBox(id: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('buy_boxes').delete().eq('id', id);
  if (error) throw error;
}

export interface FeedDeal {
  contract_price?: number | null;
  assignment_fee?: number | null;
  status?: string;
  documents?: { property_address?: string; city?: string; state?: string } | null;
}

export interface FeedListing {
  id: string;
  owner_id: string;
  total_marketplace_cost: number;
  listing_status: string;
  created_at: string;
  deals: FeedDeal | null;
}

export async function loadFeed(): Promise<FeedListing[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      'id, owner_id, total_marketplace_cost, listing_status, created_at, deals:deal_id ( contract_price, assignment_fee, status, documents )'
    )
    .eq('visibility', 'public')
    .eq('listing_status', 'active')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as unknown as FeedListing[];
}

// A listing matches a buy box when its total cost sits inside the box price
// range (when set) and its property address text contains one of the box's
// cities/states (when set). Address is free text on the deal, so this is a
// plain text match — labeled as such in the UI.
export function listingMatchesBox(listing: FeedListing, box: BuyBox): boolean {
  if (!box.active) return false;
  const cost = Number(listing.total_marketplace_cost);
  if (box.price_min != null && cost < Number(box.price_min)) return false;
  if (box.price_max != null && cost > Number(box.price_max)) return false;
  const places = [...(box.cities || []), ...(box.states || [])]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (places.length) {
    const docs = listing.deals?.documents;
    const hay = [docs?.property_address || '', docs?.city || '', docs?.state || ''].join(' ').toLowerCase();
    if (!places.some((p) => hay.includes(p))) return false;
  }
  return true;
}

export interface DashboardData {
  leadsTotal: number;
  leadsByStatus: Record<string, number>;
  followUpsDue: number;
  dealsCount: number;
  feesInPipeline: number;
  myActiveListings: number;
  offersReceived: number;
}

export async function loadDashboard(userId: string): Promise<DashboardData | null> {
  if (!supabaseConfigured || !supabase) return null;
  const today = new Date().toISOString().slice(0, 10);
  const [leadsRes, dealsRes, listingsRes, offersRes] = await Promise.all([
    supabase.from('leads').select('status, follow_up_date').eq('owner_id', userId).limit(1000),
    supabase.from('deals').select('assignment_fee, status').eq('owner_id', userId).limit(1000),
    supabase
      .from('marketplace_listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('listing_status', 'active'),
    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('wholesaler_user', userId)
      .eq('status', 'sent'),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (dealsRes.error) throw dealsRes.error;
  const leads = (leadsRes.data || []) as { status: string; follow_up_date?: string }[];
  const byStatus: Record<string, number> = {};
  let followUpsDue = 0;
  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    if (l.follow_up_date && l.follow_up_date <= today && l.status !== 'closed' && l.status !== 'dead') {
      followUpsDue += 1;
    }
  }
  const deals = (dealsRes.data || []) as { assignment_fee?: number; status: string }[];
  const feesInPipeline = deals
    .filter((d) => d.status !== 'closed')
    .reduce((sum, d) => sum + Number(d.assignment_fee || 0), 0);
  return {
    leadsTotal: leads.length,
    leadsByStatus: byStatus,
    followUpsDue,
    dealsCount: deals.length,
    feesInPipeline,
    myActiveListings: listingsRes.count ?? 0,
    offersReceived: offersRes.count ?? 0,
  };
}

export interface SignatureEntry {
  party: string;
  name: string;
  document: string;
  signed_at: string;
}

export interface DealDocuments {
  property_address?: string;
  ab_status?: string;
  bc_status?: string;
  jv_status?: string;
  buyer_user?: string;
  accepted_offer_amount?: number;
  signatures?: SignatureEntry[];
  [key: string]: unknown;
}

export interface LinkedDeal {
  id: string;
  contract_price?: number | null;
  assignment_fee?: number | null;
  status: string;
  documents?: DealDocuments | null;
}

export async function loadSellerDeals(userId: string): Promise<LinkedDeal[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('deals')
    .select('id, contract_price, assignment_fee, status, documents')
    .eq('seller_user', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as LinkedDeal[];
}

export interface TitleLink {
  companies: { id: string; name: string }[];
  files: { id: string; file_status: string; emd_status: string; created_at: string; target_closing_date?: string | null; emd_amount_required?: number | null }[];
}

export async function loadTitleLink(userId: string): Promise<TitleLink> {
  if (!supabaseConfigured || !supabase) return { companies: [], files: [] };
  const { data: companies, error } = await supabase
    .from('title_companies')
    .select('id, name')
    .eq('portal_user', userId);
  if (error) throw error;
  const list = (companies || []) as { id: string; name: string }[];
  if (!list.length) return { companies: [], files: [] };
  const { data: files } = await supabase
    .from('escrow_files')
    .select('id, file_status, emd_status, created_at, target_closing_date, emd_amount_required')
    .in(
      'title_company_id',
      list.map((c) => c.id)
    )
    .order('created_at', { ascending: false });
  return { companies: list, files: (files || []) as TitleLink['files'] };
}

// ---- Slice 10: offers ----

export type OfferStatus = 'sent' | 'countered' | 'accepted' | 'declined' | 'withdrawn';

export interface OfferRow {
  id: string;
  listing_id: string;
  buyer_user: string;
  wholesaler_user: string;
  amount: number;
  message?: string | null;
  status: OfferStatus;
  counter_amount?: number | null;
  created_at: string;
  listing?: {
    deal_id?: string;
    total_marketplace_cost?: number;
    deals?: { documents?: { property_address?: string } | null; contract_price?: number | null } | null;
  } | null;
}

const OFFER_SELECT =
  'id, listing_id, buyer_user, wholesaler_user, amount, message, status, counter_amount, created_at';

// The nested PostgREST embed (offers -> listings -> deals) silently
// returned no listing in production (E2E, Oct 29), which broke both the
// address display and acceptOffer's deal write. Offers are therefore
// stitched from flat queries, which RLS handles predictably.
async function stitchOfferAddresses(rows: OfferRow[]): Promise<OfferRow[]> {
  if (!supabase || rows.length === 0) return rows;
  const listingIds = Array.from(new Set(rows.map((r) => r.listing_id)));
  const { data: listings } = await supabase
    .from('marketplace_listings')
    .select('id, deal_id, total_marketplace_cost')
    .in('id', listingIds);
  const dealIds = Array.from(
    new Set(((listings || []) as { deal_id?: string }[]).map((l) => l.deal_id).filter(Boolean) as string[])
  );
  const { data: deals } = dealIds.length
    ? await supabase.from('deals').select('id, documents, contract_price').in('id', dealIds)
    : { data: [] as { id: string; documents?: unknown; contract_price?: number | null }[] };
  const dealById = new Map(((deals || []) as { id: string; documents?: unknown; contract_price?: number | null }[]).map((d) => [d.id, d]));
  const listingById = new Map(((listings || []) as { id: string; deal_id?: string; total_marketplace_cost?: number }[]).map((l) => [l.id, l]));
  for (const r of rows) {
    const l = listingById.get(r.listing_id);
    if (!l) continue;
    const d = l.deal_id ? dealById.get(l.deal_id) : undefined;
    r.listing = {
      deal_id: l.deal_id,
      total_marketplace_cost: l.total_marketplace_cost,
      deals: d
        ? { documents: d.documents as { property_address?: string } | null, contract_price: d.contract_price }
        : null,
    };
  }
  return rows;
}

export async function createOffer(
  buyerId: string,
  listing: FeedListing,
  amount: number,
  message: string
): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('offers').insert({
    listing_id: listing.id,
    buyer_user: buyerId,
    wholesaler_user: listing.owner_id,
    amount,
    message: message || null,
    status: 'sent',
  });
  if (error) throw error;
}

export async function loadBuyerOffers(buyerId: string): Promise<OfferRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq('buyer_user', buyerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return stitchOfferAddresses((data || []) as unknown as OfferRow[]);
}

export async function loadIncomingOffers(wholesalerId: string): Promise<OfferRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq('wholesaler_user', wholesalerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return stitchOfferAddresses((data || []) as unknown as OfferRow[]);
}

export async function setOfferStatus(
  offerId: string,
  status: OfferStatus,
  counterAmount?: number | null
): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const patch: Record<string, unknown> = { status };
  if (counterAmount !== undefined) patch.counter_amount = counterAmount;
  const { error } = await supabase.from('offers').update(patch).eq('id', offerId);
  if (error) throw error;
}

// Accepting an offer also writes the outcome into the underlying deal's
// documents (B–C status + accepted amount), so the Contracts section shows
// it. The wholesaler owns that deal, so RLS allows the update.
export async function acceptOffer(offer: OfferRow): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  // Slice 17: resolve the deal with flat queries and THROW on any
  // failure. The Slice 10 version read deal_id from a nested embed
  // that silently returned nothing, so the deal write was skipped
  // while the UI reported success (E2E, Oct 29 — offer showed
  // 'accepted' but the deal was never stamped). The deal is stamped
  // first; the offer status flips last, so a failure stays retryable.
  const { data: listing, error: lErr } = await supabase
    .from('marketplace_listings')
    .select('deal_id')
    .eq('id', offer.listing_id)
    .single();
  if (lErr || !listing?.deal_id) throw new Error('Accept failed: could not resolve the deal for this offer. The offer was not accepted.');
  const dealId = listing.deal_id as string;
  const { data: deal, error: dErr } = await supabase
    .from('deals')
    .select('documents')
    .eq('id', dealId)
    .single();
  if (dErr || !deal) throw new Error('Accept failed: could not load the deal for this offer. The offer was not accepted.');
  const docs = (deal.documents || {}) as Record<string, unknown>;
  const { error: uErr } = await supabase
    .from('deals')
    .update({
      documents: {
        ...docs,
        bc_status: 'offer_accepted',
        accepted_offer_amount: offer.amount,
        accepted_offer_id: offer.id,
        buyer_user: offer.buyer_user,
      },
    })
    .eq('id', dealId);
  if (uErr) throw uErr;
  await setOfferStatus(offer.id, 'accepted');
}

// All buy boxes are readable by signed-in users (schema v3 policy) — the
// wholesaler demand view aggregates criteria only; buyer identities are
// never displayed.
export async function loadAllBuyBoxes(): Promise<BuyBox[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('buy_boxes')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []) as BuyBox[];
}

// ---- Slice 11: claiming + in-portal signing ----

// Claim-by-ID: the wholesaler reads the deal/company ID from their own
// lists and gives it to the other party, who claims it here. RLS (v3.3)
// only allows claiming rows that are still unlinked.
export async function claimDeal(dealId: string, userId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  // Slice 16: claim via the claim_deal security-definer RPC (schema v3.5).
  // The direct RLS update silently matched 0 rows in production (E2E test,
  // Oct 29) despite a correct-looking policy; the RPC has identical
  // semantics — claim only an unlinked deal, only to yourself — and
  // returns whether the claim actually landed.
  void userId;
  const { data, error } = await supabase.rpc('claim_deal', { p_deal_id: dealId.trim() });
  if (error) throw error;
  if (data !== true) {
    throw new Error('No unlinked deal found with that ID. Check the ID with your wholesaler.');
  }
}

export async function claimTitleCompany(companyId: string, userId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { data, error } = await supabase
    .from('title_companies')
    .update({ portal_user: userId })
    .eq('id', companyId.trim())
    .is('portal_user', null)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No unlinked title company found with that ID.');
  }
}

// Typed-name signature with a timestamp audit trail in documents.signatures.
// The contract status vocabulary ('Signed') matches lib/contracts.ts.
export async function signDealDocument(
  dealId: string,
  currentDocs: DealDocuments | null | undefined,
  which: 'ab' | 'bc',
  signerName: string,
  party: string
): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const docs: DealDocuments = { ...(currentDocs || {}) };
  const entry: SignatureEntry = {
    party,
    name: signerName,
    document: which === 'ab' ? 'A-B purchase agreement' : 'B-C assignment',
    signed_at: new Date().toISOString(),
  };
  docs.signatures = [...(docs.signatures || []), entry];
  if (which === 'ab') docs.ab_status = 'Signed';
  else docs.bc_status = 'Signed';
  const { error } = await supabase.from('deals').update({ documents: docs }).eq('id', dealId);
  if (error) throw error;
}

// Deals where this buyer had an offer accepted (Slice 10 accept flow stamps
// documents.buyer_user). The B-C assignment can only be signed after the
// seller's A-B is 'Signed' — the gate lib/contracts.ts enforces wholesaler-side.
export async function loadBuyerDeals(userId: string): Promise<LinkedDeal[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('deals')
    .select('id, contract_price, assignment_fee, status, documents')
    .filter('documents->>buyer_user', 'eq', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as LinkedDeal[];
}

export interface MilestoneRow {
  milestone_name: string;
  logged_at: string;
}

export async function loadFileMilestones(fileId: string): Promise<MilestoneRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('escrow_milestones')
    .select('milestone_name, logged_at')
    .eq('file_id', fileId)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data || []) as MilestoneRow[];
}

// ---- Slice 15: listing activation (found missing by the Oct 29 E2E test) ----
// Escrow creates listings as visibility 'public' + status 'draft', and
// nothing could activate them — so the buyer feed and public page could
// never show a listing. The wholesaler activates/pauses their own
// listings here (owners-manage RLS covers the update).

export interface MyListing {
  id: string;
  deal_id: string;
  listing_status: string;
  visibility: string;
  total_marketplace_cost: number;
  deals?: { documents?: { property_address?: string } | null } | null;
}

export async function loadMyListings(userId: string): Promise<MyListing[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('id, deal_id, listing_status, visibility, total_marketplace_cost, deals:deal_id ( documents )')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as MyListing[];
}

export async function setListingStatus(listingId: string, status: 'active' | 'draft'): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('marketplace_listings')
    .update({ listing_status: status })
    .eq('id', listingId);
  if (error) throw error;
}


// ---------- Public seller pages (schema v3.7, Slice 20) ----------
// Each wholesaler can publish a "sell your house" page at /sell/<slug>
// under their own company name. Settings live on their own profiles row
// (updated through the existing own-profile policy). The public side
// reads and submits ONLY through security-definer functions — profiles
// are never exposed to anonymous visitors.
export interface SellerPageSettings {
  company: string;
  public_slug: string;
  seller_page_enabled: boolean;
  seller_page_headline: string;
  seller_page_about: string;
}

export async function loadSellerPageSettings(userId: string): Promise<SellerPageSettings | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('company, public_slug, seller_page_enabled, seller_page_headline, seller_page_about')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  return {
    company: (d.company as string) || '',
    public_slug: (d.public_slug as string) || '',
    seller_page_enabled: !!d.seller_page_enabled,
    seller_page_headline: (d.seller_page_headline as string) || '',
    seller_page_about: (d.seller_page_about as string) || '',
  };
}

export async function saveSellerPageSettings(userId: string, s: SellerPageSettings): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const slug = s.public_slug.trim().toLowerCase();
  const { error } = await supabase
    .from('profiles')
    .update({
      company: s.company.trim() || null,
      public_slug: slug || null,
      seller_page_enabled: s.seller_page_enabled && !!slug,
      seller_page_headline: s.seller_page_headline.trim() || null,
      seller_page_about: s.seller_page_about.trim() || null,
    })
    .eq('id', userId);
  if (error) throw error;
}

export interface PublicSellerPage {
  company: string;
  headline?: string | null;
  about?: string | null;
}

export async function loadPublicSellerPage(slug: string): Promise<PublicSellerPage | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('get_seller_page', { p_slug: slug });
  if (error || !data || (data as unknown[]).length === 0) return null;
  return (data as PublicSellerPage[])[0];
}

export interface SellerLeadForm {
  owner_name: string;
  property_address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  notes: string;
  website: string; // honeypot — real sellers leave this empty
}

export async function submitSellerLead(slug: string, f: SellerLeadForm): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { data, error } = await supabase.rpc('submit_seller_lead', {
    p_slug: slug,
    p_owner_name: f.owner_name,
    p_property_address: f.property_address,
    p_city: f.city,
    p_state: f.state,
    p_zip: f.zip,
    p_phone: f.phone,
    p_email: f.email,
    p_notes: f.notes,
    p_website: f.website,
  });
  if (error) return false;
  return !!data;
}
