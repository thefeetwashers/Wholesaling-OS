import { supabase, supabaseConfigured } from './supabase';
import { OPERATOR_EMAIL } from './funding';

// Slice 122 — Fast-Cash Seller Moving Advance data layer. A REQUEST
// for operator review only. No advance is promised or guaranteed by
// a row here, and no money moves through the platform: the operator
// reviews the request, and any advance is agreed outside this
// table and repaid out of closing proceeds. Amount is constrained
// to $1,500–$3,000 by the database CHECK. The operator sees
// requests in the Escrow desk; no email is sent (no email service
// is wired). The operator account is thefeetwashers@gmail.com.

export type SellerAdvanceStatus = 'requested' | 'under_review' | 'approved' | 'declined' | 'repaid';

export const ADVANCE_MIN = 1500;
export const ADVANCE_MAX = 3000;

export interface SellerAdvanceRequest {
  id?: string;
  requester_id?: string;
  deal_id?: string | null;
  amount_requested: number;
  seller_name?: string | null;
  reason?: string | null;
  status?: SellerAdvanceStatus;
  created_at?: string;
}

const ADVANCE_SELECT =
  'id, requester_id, deal_id, amount_requested, seller_name, reason, status, created_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so nothing was submitted. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Slice 122 migration, then try again. No submission was faked.'
    );
  }
  return supabase;
}

export async function requestSellerAdvance(
  userId: string,
  req: Omit<SellerAdvanceRequest, 'id' | 'requester_id' | 'status' | 'created_at'>
): Promise<SellerAdvanceRequest> {
  const client = requireSupabase();
  const amount = Number(req.amount_requested);
  if (!Number.isFinite(amount) || amount < ADVANCE_MIN || amount > ADVANCE_MAX) {
    throw new Error(`The advance request must be between $${ADVANCE_MIN.toLocaleString()} and $${ADVANCE_MAX.toLocaleString()}.`);
  }
  const { data, error } = await client
    .from('seller_advance_requests')
    .insert({
      requester_id: userId,
      deal_id: req.deal_id || null,
      amount_requested: amount,
      seller_name: req.seller_name?.trim() || null,
      reason: req.reason?.trim() || null,
      status: 'requested',
    })
    .select(ADVANCE_SELECT)
    .single();
  if (error) throw error;
  return data as SellerAdvanceRequest;
}

export async function loadMyAdvanceRequests(userId: string): Promise<SellerAdvanceRequest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('seller_advance_requests')
    .select(ADVANCE_SELECT)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SellerAdvanceRequest[];
}

export async function loadAllAdvanceRequestsForOperator(
  operatorEmail: string | null
): Promise<SellerAdvanceRequest[]> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can list seller advance requests.');
  }
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('seller_advance_requests')
    .select(ADVANCE_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SellerAdvanceRequest[];
}

export async function setAdvanceStatus(
  requestId: string,
  status: SellerAdvanceStatus,
  operatorEmail: string | null
): Promise<void> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can move an advance request.');
  }
  const client = requireSupabase();
  const { error } = await client
    .from('seller_advance_requests')
    .update({ status })
    .eq('id', requestId);
  if (error) throw error;
}
