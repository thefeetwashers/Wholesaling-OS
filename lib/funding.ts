import { supabase, supabaseConfigured } from './supabase';

// Capital & Lending Module — data layer for the opt-in commercial
// funding workflow. Every read/write here goes through Supabase RLS;
// the client never decides who may see a packet — the policies in
// supabase/migrations/20261115090000_capital_lending_lender_role.sql
// do. Nothing here touches leads, seller contacts, or assignment
// fees: funding_requests holds only the packet a requester chose
// to share. No lender, deal, or funding is ever faked: when Supabase
// is not configured these functions throw or return empty, and the
// UI says so plainly.

export const OPERATOR_EMAIL = 'thefeetwashers@gmail.com';

export type FundingType = 'transactional' | 'fix_and_flip' | 'dscr' | 'bridge';
export type RoutingTrack = 'direct_feet_washers' | 'wholesale_iso_network';
export type FundingStatus =
  | 'submitted'
  | 'under_review'
  | 'term_sheet_issued'
  | 'clear_to_close'
  | 'funded'
  | 'declined';

export const FUNDING_TYPES: { value: FundingType; label: string }[] = [
  { value: 'transactional', label: 'Transactional (1–3 day double close)' },
  { value: 'fix_and_flip', label: 'Fix-and-Flip' },
  { value: 'dscr', label: 'DSCR (rental)' },
  { value: 'bridge', label: 'Bridge' },
];

export const FUNDING_STATUSES: FundingStatus[] = [
  'submitted',
  'under_review',
  'term_sheet_issued',
  'clear_to_close',
  'funded',
  'declined',
];

// Transactional funding is direct from the operator; every other
// program goes to the ISO network of verified partner lenders.
export function routingFor(financingType: FundingType): RoutingTrack {
  return financingType === 'transactional'
    ? 'direct_feet_washers'
    : 'wholesale_iso_network';
}

export function routingLabel(track: RoutingTrack): string {
  return track === 'direct_feet_washers'
    ? 'Direct — The Feet Washers, Inc.'
    : 'ISO network — verified partner lenders only';
}

export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

export interface FundingRequest {
  id?: string;
  requester_id?: string;
  deal_id?: string | null;
  financing_type: FundingType;
  borrowing_entity_name?: string | null;
  entity_state?: string | null;
  business_purpose_certified: boolean;
  no_upfront_fee_acknowledged: boolean;
  property_address?: string | null;
  property_state?: string | null;
  purchase_price?: number | null;
  loan_amount_requested?: number | null;
  estimated_arv?: number | null;
  rehab_budget?: number | null;
  monthly_rent?: number | null;
  target_closing_date?: string | null;
  title_company_name?: string | null;
  title_officer_email?: string | null;
  routing_track: RoutingTrack;
  assigned_lender_id?: string | null;
  status: FundingStatus;
  created_at?: string;
  updated_at?: string;
}

export interface LenderBox {
  id?: string;
  lender_id?: string;
  company_name?: string | null;
  lending_types: FundingType[];
  states_covered: string[];
  min_loan_amount?: number | null;
  max_loan_amount?: number | null;
  max_ltv_percent?: number | null;
  min_dscr?: number | null;
  partner_agreement_accepted: boolean;
  partner_agreement_accepted_at?: string | null;
  is_verified_partner: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LenderBoxWithEmail extends LenderBox {
  lender_email?: string | null;
}

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so nothing was submitted. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Capital & Lending migration, then try again. No submission was faked.'
    );
  }
  return supabase;
}

const FUNDING_SELECT =
  'id, requester_id, deal_id, financing_type, borrowing_entity_name, entity_state, business_purpose_certified, no_upfront_fee_acknowledged, property_address, property_state, purchase_price, loan_amount_requested, estimated_arv, rehab_budget, monthly_rent, target_closing_date, title_company_name, title_officer_email, routing_track, assigned_lender_id, status, created_at, updated_at';

const LENDER_BOX_SELECT =
  'id, lender_id, company_name, lending_types, states_covered, min_loan_amount, max_loan_amount, max_ltv_percent, min_dscr, partner_agreement_accepted, partner_agreement_accepted_at, is_verified_partner, created_at, updated_at';

// The requester's own packets only (RLS also enforces this).
export async function loadMyFundingRequests(userId: string): Promise<FundingRequest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('funding_requests')
    .select(FUNDING_SELECT)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as FundingRequest[];
}

// What the Lender Dashboard shows: the packets RLS lets this lender
// see — matched ISO-network packets only (plus the lender's own
// requests, if any). No client-side matching is done here; a packet
// that is not in this result was not shown because the database
// refused it, and the UI says so rather than inventing a match.
export async function loadMatchedFundingRequests(): Promise<FundingRequest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('funding_requests')
    .select(FUNDING_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as FundingRequest[];
}

// Operator only: direct-track packets. RLS allows this only for the
// operator account; anyone else gets an empty result (or an error),
// never another requester's direct packet.
export async function loadDirectFundingRequests(): Promise<FundingRequest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('funding_requests')
    .select(FUNDING_SELECT)
    .eq('routing_track', 'direct_feet_washers')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as FundingRequest[];
}

// Inserts ONLY the opt-in packet fields — never leads, seller
// contacts, or assignment fees. The two attestations are set true
// here because the modal hard-blocks submission until both are
// checked; the database CHECK constraints would refuse a false row.
export async function submitFundingRequest(
  userId: string,
  req: Omit<FundingRequest, 'id' | 'requester_id' | 'routing_track' | 'status' | 'business_purpose_certified' | 'no_upfront_fee_acknowledged' | 'created_at' | 'updated_at'>
): Promise<FundingRequest> {
  const client = requireSupabase();
  if (!req.borrowing_entity_name?.trim()) {
    throw new Error('Enter the borrowing entity name (LLC/Corp) before submitting.');
  }
  const { data, error } = await client
    .from('funding_requests')
    .insert({
      requester_id: userId,
      deal_id: req.deal_id || null,
      financing_type: req.financing_type,
      borrowing_entity_name: req.borrowing_entity_name.trim(),
      entity_state: req.entity_state || null,
      business_purpose_certified: true,
      no_upfront_fee_acknowledged: true,
      property_address: req.property_address || null,
      property_state: req.property_state || null,
      purchase_price: req.purchase_price ?? null,
      loan_amount_requested: req.loan_amount_requested ?? null,
      estimated_arv: req.estimated_arv ?? null,
      rehab_budget: req.rehab_budget ?? null,
      monthly_rent: req.monthly_rent ?? null,
      target_closing_date: req.target_closing_date || null,
      title_company_name: req.title_company_name || null,
      title_officer_email: req.title_officer_email || null,
      routing_track: routingFor(req.financing_type),
      assigned_lender_id: req.assigned_lender_id || null,
      status: 'submitted',
    })
    .select(FUNDING_SELECT)
    .single();
  if (error) throw error;
  return data as FundingRequest;
}

export async function setFundingRequestStatus(
  requestId: string,
  status: FundingStatus
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('funding_requests')
    .update({ status })
    .eq('id', requestId);
  if (error) throw error;
}

export async function loadMyLenderBox(userId: string): Promise<LenderBox | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('lender_boxes')
    .select(LENDER_BOX_SELECT)
    .eq('lender_id', userId)
    .single();
  if (error || !data) return null;
  return data as LenderBox;
}

export async function saveLenderBox(
  userId: string,
  box: Omit<LenderBox, 'id' | 'lender_id' | 'partner_agreement_accepted' | 'partner_agreement_accepted_at' | 'is_verified_partner' | 'created_at' | 'updated_at'>
): Promise<LenderBox> {
  const client = requireSupabase();
  const payload = {
    lender_id: userId,
    company_name: box.company_name?.trim() || null,
    lending_types: box.lending_types,
    states_covered: box.states_covered,
    min_loan_amount: box.min_loan_amount ?? null,
    max_loan_amount: box.max_loan_amount ?? null,
    max_ltv_percent: box.max_ltv_percent ?? null,
    min_dscr: box.min_dscr ?? null,
  };
  const { data, error } = await client
    .from('lender_boxes')
    .upsert(payload, { onConflict: 'lender_id' })
    .select(LENDER_BOX_SELECT)
    .single();
  if (error) throw error;
  return data as LenderBox;
}

// Click-to-sign the partner agreement. Records the acceptance and
// its timestamp on the lender's own box. Verification is a separate
// step, done only by the operator, and the database CHECK refuses
// is_verified_partner = true while this is still false.
export async function acceptPartnerAgreement(boxId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('lender_boxes')
    .update({
      partner_agreement_accepted: true,
      partner_agreement_accepted_at: new Date().toISOString(),
    })
    .eq('id', boxId);
  if (error) throw error;
}

// Operator only. The client-side email check is a UI guard; the
// server-side RLS policy ("operator verifies lender boxes") is what
// actually allows the update, and the database CHECK still refuses
// verification for a box whose agreement was never accepted.
export async function setLenderVerified(
  boxId: string,
  verified: boolean,
  operatorEmail: string | null
): Promise<void> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can verify a lender.');
  }
  const client = requireSupabase();
  const { error } = await client
    .from('lender_boxes')
    .update({ is_verified_partner: verified })
    .eq('id', boxId);
  if (error) throw error;
}

// Operator only: every lender box, with the lender's email attached
// for the verification list. Emails are read from profiles by id —
// the join is done in two steps so no foreign-key name is assumed.
export async function loadAllLenderBoxesForOperator(
  operatorEmail: string | null
): Promise<LenderBoxWithEmail[]> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can list lender boxes for verification.');
  }
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('lender_boxes')
    .select(LENDER_BOX_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const boxes = (data || []) as LenderBox[];
  if (boxes.length === 0) return [];
  const ids = boxes.map((b) => b.lender_id).filter(Boolean) as string[];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', ids);
  const emailById = new Map(
    ((profiles || []) as { id: string; email: string }[]).map((p) => [p.id, p.email])
  );
  return boxes.map((b) => ({ ...b, lender_email: b.lender_id ? emailById.get(b.lender_id) || null : null }));
}
