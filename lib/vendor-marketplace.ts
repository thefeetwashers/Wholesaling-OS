import { supabase, supabaseConfigured } from './supabase';

// Slice 122 — Rehab & Property Services Vendor Marketplace data
// layer. This is the PUBLIC marketplace directory of licensed
// vendors (vendor_directory), NOT the wholesaler's private address
// book in lib/vendors.ts (table `vendors`). Vendors register free;
// the operator verifies their license before requesters can see
// them. Bid requests go to ONE chosen verified vendor, never a
// broadcast. No subscription is charged by the platform in this
// slice — subscription_status is a status field the operator flips
// by hand. Nothing here is faked: when Supabase is not configured
// these functions throw or return empty, and the UI says so plainly.

export const OPERATOR_EMAIL = 'thefeetwashers@gmail.com';

export type TradeCategory =
  | 'general_contractor'
  | 'roofing'
  | 'home_inspector'
  | 'cleanout_crew'
  | 'appraiser'
  | 'property_manager';

// The 67 Florida counties, alphabetical — the coverage list vendors
// tick when they register. A public reference list, not platform data.
export const FLORIDA_COUNTIES: string[] = [
  'Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard', 'Broward', 'Calhoun', 'Charlotte', 'Citrus', 'Clay',
  'Collier', 'Columbia', 'DeSoto', 'Dixie', 'Duval', 'Escambia', 'Flagler', 'Franklin', 'Gadsden', 'Gilchrist',
  'Glades', 'Gulf', 'Hamilton', 'Hardee', 'Hendry', 'Hernando', 'Highlands', 'Hillsborough', 'Holmes', 'Indian River',
  'Jackson', 'Jefferson', 'Lafayette', 'Lake', 'Lee', 'Leon', 'Levy', 'Liberty', 'Madison', 'Manatee',
  'Marion', 'Martin', 'Miami-Dade', 'Monroe', 'Nassau', 'Okaloosa', 'Okeechobee', 'Orange', 'Osceola', 'Palm Beach',
  'Pasco', 'Pinellas', 'Polk', 'Putnam', 'Santa Rosa', 'Sarasota', 'Seminole', 'St. Johns', 'St. Lucie', 'Sumter',
  'Suwannee', 'Taylor', 'Union', 'Volusia', 'Wakulla', 'Walton', 'Washington',
];

export const TRADE_CATEGORIES: { value: TradeCategory; label: string }[] = [
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'home_inspector', label: 'Home Inspector' },
  { value: 'cleanout_crew', label: 'Cleanout Crew' },
  { value: 'appraiser', label: 'Appraiser' },
  { value: 'property_manager', label: 'Property Manager' },
];

export function tradeLabel(trade: string | null | undefined): string {
  return TRADE_CATEGORIES.find((t) => t.value === trade)?.label || trade || 'Not given';
}

export interface VendorDirectoryRow {
  id?: string;
  vendor_user_id?: string;
  business_name?: string | null;
  trade_category?: TradeCategory | null;
  license_number: string;
  states_covered: string[];
  counties_covered: string[];
  subscription_status?: 'active' | 'inactive';
  is_verified?: boolean;
  created_at?: string;
}

export type BidRequestStatus = 'open' | 'bids_received' | 'awarded';

export interface VendorBidRequest {
  id?: string;
  requester_id?: string;
  vendor_id?: string | null;
  deal_id?: string | null;
  property_address?: string | null;
  property_state?: string | null;
  trade_needed?: TradeCategory | null;
  scope_notes?: string | null;
  target_walkthrough_date?: string | null;
  status?: BidRequestStatus;
  created_at?: string;
}

const VENDOR_SELECT =
  'id, vendor_user_id, business_name, trade_category, license_number, states_covered, counties_covered, subscription_status, is_verified, created_at';

const BID_SELECT =
  'id, requester_id, vendor_id, deal_id, property_address, property_state, trade_needed, scope_notes, target_walkthrough_date, status, created_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so nothing was submitted. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Slice 122 migration, then try again. No submission was faked.'
    );
  }
  return supabase;
}

// Register (or update) this vendor's own directory row. Listing is
// free while the directory launches; verification is a separate step
// done only by the operator, and the database trigger refuses a
// vendor who tries to verify themselves.
export async function registerVendor(
  userId: string,
  row: Omit<VendorDirectoryRow, 'id' | 'vendor_user_id' | 'subscription_status' | 'is_verified' | 'created_at'>
): Promise<VendorDirectoryRow> {
  const client = requireSupabase();
  if (!row.license_number.trim()) {
    throw new Error('A state license number is required — unverified listings are not shown to requesters.');
  }
  if (!row.trade_category) {
    throw new Error('Pick your trade before registering.');
  }
  const { data, error } = await client
    .from('vendor_directory')
    .upsert(
      {
        vendor_user_id: userId,
        business_name: row.business_name?.trim() || null,
        trade_category: row.trade_category,
        license_number: row.license_number.trim(),
        states_covered: row.states_covered || [],
        counties_covered: row.counties_covered || [],
      },
      { onConflict: 'vendor_user_id' }
    )
    .select(VENDOR_SELECT)
    .single();
  if (error) throw error;
  return data as VendorDirectoryRow;
}

export async function loadMyVendorRow(userId: string): Promise<VendorDirectoryRow | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('vendor_directory')
    .select(VENDOR_SELECT)
    .eq('vendor_user_id', userId)
    .single();
  if (error || !data) return null;
  return data as VendorDirectoryRow;
}

// What requesters see: verified vendors only. RLS also enforces
// this — an unverified row never reaches this result.
export async function loadVerifiedVendors(trade?: TradeCategory | null): Promise<VendorDirectoryRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  let q = supabase
    .from('vendor_directory')
    .select(VENDOR_SELECT)
    .eq('is_verified', true)
    .order('created_at', { ascending: true });
  if (trade) q = q.eq('trade_category', trade);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as VendorDirectoryRow[];
}

// Operator only: every vendor row, for the verification list.
export async function loadAllVendorRowsForOperator(operatorEmail: string | null): Promise<VendorDirectoryRow[]> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can list vendor rows for verification.');
  }
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('vendor_directory')
    .select(VENDOR_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as VendorDirectoryRow[];
}

// Operator only: flip verification (and subscription status). The
// client-side email check is a UI guard; the database trigger is
// what actually refuses a non-operator change.
export async function setVendorVerified(
  vendorId: string,
  verified: boolean,
  operatorEmail: string | null
): Promise<void> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can verify a vendor.');
  }
  const client = requireSupabase();
  const { error } = await client
    .from('vendor_directory')
    .update({ is_verified: verified })
    .eq('id', vendorId);
  if (error) throw error;
}

export async function setVendorSubscription(
  vendorId: string,
  status: 'active' | 'inactive',
  operatorEmail: string | null
): Promise<void> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can change a vendor subscription status.');
  }
  const client = requireSupabase();
  const { error } = await client
    .from('vendor_directory')
    .update({ subscription_status: status })
    .eq('id', vendorId);
  if (error) throw error;
}

// Send an opt-in bid request to ONE chosen verified vendor. The
// request carries only the property + scope the requester chose to
// share — never leads, seller contacts, or assignment fees.
export async function sendBidRequest(
  userId: string,
  req: Omit<VendorBidRequest, 'id' | 'requester_id' | 'status' | 'created_at'>
): Promise<VendorBidRequest> {
  const client = requireSupabase();
  if (!req.vendor_id) throw new Error('Pick a verified vendor to send this bid request to.');
  if (!req.trade_needed) throw new Error('Pick the trade you need before sending.');
  const { data, error } = await client
    .from('vendor_bid_requests')
    .insert({
      requester_id: userId,
      vendor_id: req.vendor_id,
      deal_id: req.deal_id || null,
      property_address: req.property_address?.trim() || null,
      property_state: req.property_state || null,
      trade_needed: req.trade_needed,
      scope_notes: req.scope_notes?.trim() || null,
      target_walkthrough_date: req.target_walkthrough_date || null,
      status: 'open',
    })
    .select(BID_SELECT)
    .single();
  if (error) throw error;
  return data as VendorBidRequest;
}

export async function loadMyBidRequests(userId: string): Promise<VendorBidRequest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('vendor_bid_requests')
    .select(BID_SELECT)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as VendorBidRequest[];
}

// What the chosen vendor sees: requests sent to their directory row.
// RLS enforces the match — a request sent to another vendor is not
// in this result.
export async function loadBidRequestsForVendor(vendorRowId: string): Promise<VendorBidRequest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('vendor_bid_requests')
    .select(BID_SELECT)
    .eq('vendor_id', vendorRowId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as VendorBidRequest[];
}

export async function setBidRequestStatus(requestId: string, status: BidRequestStatus): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('vendor_bid_requests').update({ status }).eq('id', requestId);
  if (error) throw error;
}
