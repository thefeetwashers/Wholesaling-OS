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
  documents?: { property_address?: string } | null;
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
    const addr = (listing.deals?.documents?.property_address || '').toLowerCase();
    if (!places.some((p) => addr.includes(p))) return false;
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

export interface LinkedDeal {
  id: string;
  contract_price?: number | null;
  assignment_fee?: number | null;
  status: string;
  documents?: { property_address?: string } | null;
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
  files: { id: string; file_status: string; emd_status: string; created_at: string }[];
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
    .select('id, file_status, emd_status, created_at')
    .in(
      'title_company_id',
      list.map((c) => c.id)
    )
    .order('created_at', { ascending: false });
  return { companies: list, files: (files || []) as TitleLink['files'] };
}
