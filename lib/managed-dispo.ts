import { supabase, supabaseConfigured } from './supabase';
import { OPERATOR_EMAIL } from './funding';

// Slice 132 — Managed disposition requests. A REQUEST for the
// operator to market one of the wholesaler's deals to the buyer
// network for them. A request is NOT a booking: the fee is AGREED
// IN WRITING before work starts (no fee is stored here, and no
// percentage or flat fee is invented), the work is governed by a
// separate signed agreement, and no sale is guaranteed. No email
// is sent (no email service is wired) — the operator sees
// requests in their operator view, in-app only. Same pattern as
// the seller-advance request (lib/seller-advance.ts).

export type ManagedDispoStatus =
  | 'requested'
  | 'under_review'
  | 'accepted'
  | 'declined'
  | 'completed';

export const MANAGED_DISPO_STATUSES: ManagedDispoStatus[] = [
  'requested',
  'under_review',
  'accepted',
  'declined',
  'completed',
];

export const MANAGED_DISPO_STATUS_LABELS: Record<ManagedDispoStatus, string> = {
  requested: 'Requested',
  under_review: 'Under review',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
};

export interface ManagedDispoRequest {
  id?: string;
  user_id?: string;
  property_address?: string | null;
  city?: string | null;
  state?: string | null;
  asking_price?: number | null;
  arv?: number | null;
  repair_estimate?: number | null;
  notes?: string | null;
  status?: ManagedDispoStatus;
  created_at?: string;
  updated_at?: string;
}

const DISPO_SELECT =
  'id, user_id, property_address, city, state, asking_price, arv, repair_estimate, notes, status, created_at, updated_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so nothing was submitted. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Slice 132 migration, then try again. No submission was faked.'
    );
  }
  return supabase;
}

export async function submitManagedDispoRequest(
  userId: string,
  req: Omit<ManagedDispoRequest, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>
): Promise<ManagedDispoRequest> {
  const client = requireSupabase();
  if (!req.property_address?.trim() && !req.city?.trim()) {
    throw new Error('Add the property address or at least the city — the operator needs to know which deal this is.');
  }
  const num = (v: number | null | undefined): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const { data, error } = await client
    .from('managed_dispo_requests')
    .insert({
      user_id: userId,
      property_address: req.property_address?.trim() || null,
      city: req.city?.trim() || null,
      state: req.state?.trim() || null,
      asking_price: num(req.asking_price),
      arv: num(req.arv),
      repair_estimate: num(req.repair_estimate),
      notes: req.notes?.trim() || '',
      status: 'requested',
    })
    .select(DISPO_SELECT)
    .single();
  if (error) throw error;
  return data as ManagedDispoRequest;
}

export async function fetchMyManagedDispoRequests(userId: string): Promise<ManagedDispoRequest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('managed_dispo_requests')
    .select(DISPO_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ManagedDispoRequest[];
}

// Operator only: every request, newest first. The operator email
// is checked in-app AND by RLS — a non-operator gets an empty
// result (or an error), never another wholesaler's requests.
export async function fetchAllManagedDispoRequests(
  operatorEmail: string | null
): Promise<ManagedDispoRequest[]> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can list managed disposition requests.');
  }
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('managed_dispo_requests')
    .select(DISPO_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ManagedDispoRequest[];
}

// Operator only: move a request's status. Verified write — the
// update selects its row back, so a refused save throws.
export async function setManagedDispoStatus(
  requestId: string,
  status: ManagedDispoStatus,
  operatorEmail: string | null
): Promise<void> {
  if (operatorEmail !== OPERATOR_EMAIL) {
    throw new Error('Only the operator account can move a managed disposition request.');
  }
  const client = requireSupabase();
  const { data, error } = await client
    .from('managed_dispo_requests')
    .update({ status })
    .eq('id', requestId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'The status did not save — the request may not exist, or the Slice 132 migration has not been applied yet.'
    );
  }
}
