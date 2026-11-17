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
  // Slice 120 — exact fee per deal (item 1) and fee-paid
  // confirmation (item 3). All start empty: fee_percentage NULL
  // means no exact percent agreed yet (the notice shows the range),
  // fee_paid false until the operator records the money arriving.
  fee_percentage?: number | null;
  fee_amount?: number | null;
  fee_paid?: boolean;
  fee_paid_at?: string | null;
  fee_paid_amount?: number | null;
  // Slice 130 — term sheet rate/term. Both start empty: NULL means
  // no rate/term agreed yet (the term sheet shows "TO BE AGREED"),
  // and the database CHECK refuses a rate or term of zero or less.
  interest_rate?: number | null;
  loan_term_months?: number | null;
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

// Slice 136 — PostgREST errors are plain objects ({ message, code,
// details, hint }), NOT Error instances. Throwing one raw means every
// `e instanceof Error` catch in the UI falls through to a generic
// string and the database's own words are lost — which is exactly
// how the lender desk ended up showing "Could not load packets."
// for every failure. Wrap it so the caller always gets a real Error
// carrying the database's message (e.g. "permission denied for
// table funding_requests" [42501], or a missing column [42703]).
function postgrestError(error: { message?: string; code?: string | null }): Error {
  const message = error?.message || 'The database refused this request.';
  const code = error?.code ? ` [${error.code}]` : '';
  return new Error(`${message}${code}`);
}

const FUNDING_SELECT =
  'id, requester_id, deal_id, financing_type, borrowing_entity_name, entity_state, business_purpose_certified, no_upfront_fee_acknowledged, property_address, property_state, purchase_price, loan_amount_requested, estimated_arv, rehab_budget, monthly_rent, target_closing_date, title_company_name, title_officer_email, routing_track, assigned_lender_id, status, fee_percentage, fee_amount, fee_paid, fee_paid_at, fee_paid_amount, interest_rate, loan_term_months, created_at, updated_at';

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
  // Slice 136 — throw a real Error carrying the database's own
  // message, not the raw PostgREST object (see postgrestError).
  if (error) throw postgrestError(error);
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
  const created = data as FundingRequest;
  // Slice 120, item 5: the submission itself is the first history
  // row (old status: none). Swallowed on failure — the request
  // stands even if the history table is not migrated yet.
  if (created?.id) {
    await logStatusChange(created.id, {
      oldStatus: null,
      newStatus: 'submitted',
      actorRole: 'requester',
      changedBy: userId,
      note: 'Funding request submitted.',
    }).catch(() => {});
  }
  return created;
}

export async function setFundingRequestStatus(
  requestId: string,
  status: FundingStatus,
  opts?: {
    oldStatus?: FundingStatus | null;
    actorRole?: 'requester' | 'operator' | 'lender';
    userId?: string;
    note?: string;
  }
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('funding_requests')
    .update({ status })
    .eq('id', requestId);
  if (error) throw error;
  // Slice 120, item 5: log the change. The log is audit, not the
  // update itself — if the history insert is refused (e.g. the
  // migration has not been applied yet), the status change still
  // stands and the failure is swallowed, never thrown.
  if (opts?.userId && opts?.actorRole) {
    await logStatusChange(requestId, {
      oldStatus: opts.oldStatus ?? null,
      newStatus: status,
      actorRole: opts.actorRole,
      changedBy: opts.userId,
      note: opts.note || null,
    }).catch(() => {});
  }
}

// Slice 120, item 5 — status history. One row per status change;
// the table has no update or delete policy, so rows are append-only.
export type HistoryActorRole = 'requester' | 'operator' | 'lender';

export interface FundingStatusHistory {
  id?: string;
  funding_request_id: string;
  changed_by?: string | null;
  actor_role?: HistoryActorRole | null;
  old_status?: string | null;
  new_status?: string | null;
  note?: string | null;
  created_at?: string;
}

const HISTORY_SELECT =
  'id, funding_request_id, changed_by, actor_role, old_status, new_status, note, created_at';

export async function logStatusChange(
  requestId: string,
  entry: {
    oldStatus: FundingStatus | string | null;
    newStatus: FundingStatus | string;
    actorRole: HistoryActorRole;
    changedBy: string;
    note?: string | null;
  }
): Promise<FundingStatusHistory> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('funding_request_history')
    .insert({
      funding_request_id: requestId,
      changed_by: entry.changedBy,
      actor_role: entry.actorRole,
      old_status: entry.oldStatus,
      new_status: entry.newStatus,
      note: entry.note || null,
    })
    .select(HISTORY_SELECT)
    .single();
  if (error) throw error;
  return data as FundingStatusHistory;
}

// RLS decides what this account may see — the requester sees their
// own requests' history, the operator direct-track history, matched
// lenders ISO-track history. Anything else comes back empty.
export async function loadFundingRequestHistory(
  requestId: string
): Promise<FundingStatusHistory[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('funding_request_history')
    .select(HISTORY_SELECT)
    .eq('funding_request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []) as FundingStatusHistory[];
}

// Slice 120, item 4 — matched-lender COUNT only. Returns a number,
// never names, companies, emails, or criteria: the query counts
// verified, agreement-accepted boxes covering this state and program
// and returns only the count. A requester learns how many lenders
// can see their packet — never who they are.
export async function countMatchedLenders(
  propertyState: string | null | undefined,
  financingType: FundingType
): Promise<number> {
  if (!supabaseConfigured || !supabase || !propertyState) return 0;
  const { count, error } = await supabase
    .from('lender_boxes')
    .select('id', { count: 'exact', head: true })
    .eq('is_verified_partner', true)
    .eq('partner_agreement_accepted', true)
    .contains('states_covered', [propertyState])
    .contains('lending_types', [financingType]);
  if (error) return 0;
  return count ?? 0;
}

// Slice 120, item 1 — operator only: set the exact agreed fee
// percent (1.5–2.0) on a request. The dollar amount is computed
// here from the request's own loan amount — never typed in by hand,
// never invented. The client-side email check is a UI guard; the
// database CHECK refuses anything outside 1.5–2.0 regardless.
export async function setFundingFee(
  requestId: string,
  feePercentage: number,
  operatorEmail: string | null
): Promise<number> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can set the agreed fee.');
  }
  if (!Number.isFinite(feePercentage) || feePercentage < 1.5 || feePercentage > 2.0) {
    throw new Error('The agreed fee must be between 1.5% and 2.0%.');
  }
  const client = requireSupabase();
  const { data, error } = await client
    .from('funding_requests')
    .select('loan_amount_requested')
    .eq('id', requestId)
    .single();
  if (error) throw error;
  const loanAmount = (data as { loan_amount_requested?: number | null } | null)?.loan_amount_requested;
  const feeAmount =
    loanAmount != null ? (Number(loanAmount) * feePercentage) / 100 : null;
  const { error: updateError } = await client
    .from('funding_requests')
    .update({ fee_percentage: feePercentage, fee_amount: feeAmount })
    .eq('id', requestId);
  if (updateError) throw updateError;
  return feeAmount ?? 0;
}

// Slice 120, item 3 — operator only: mark the referral fee received
// after closing, with the amount actually received and the date it
// arrived. Defaults are set by the UI (amount = fee_amount, date =
// today); nothing here claims a fee arrived before it is recorded.
export async function markFeePaid(
  requestId: string,
  amount: number | null,
  paidAt: string | null,
  operatorEmail: string | null
): Promise<void> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can mark a fee received.');
  }
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter the fee amount actually received.');
  }
  const client = requireSupabase();
  const { error } = await client
    .from('funding_requests')
    .update({
      fee_paid: true,
      fee_paid_amount: amount,
      fee_paid_at: paidAt || new Date().toISOString(),
    })
    .eq('id', requestId);
  if (error) throw error;
}

// Slice 130 — operator only: set the term sheet's interest rate
// (% per year) and loan term (months) on a request. Either may be
// left blank — a blank input clears that field back to NULL, and
// the term sheet shows "TO BE AGREED" for it. The client-side
// checks are UI guards; the database CHECK refuses a rate or term
// of zero or less regardless.
export async function setFundingRateTerm(
  requestId: string,
  rate: number | null,
  termMonths: number | null,
  operatorEmail: string | null
): Promise<void> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can set the term sheet rate and term.');
  }
  if (rate != null && (!Number.isFinite(rate) || rate <= 0)) {
    throw new Error('The interest rate must be above 0% when it is set.');
  }
  if (termMonths != null && (!Number.isInteger(termMonths) || termMonths <= 0)) {
    throw new Error('The loan term must be a whole number of months above 0 when it is set.');
  }
  const client = requireSupabase();
  const { error } = await client
    .from('funding_requests')
    .update({ interest_rate: rate, loan_term_months: termMonths })
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
