import { supabase, supabaseConfigured } from './supabase';

// Escrow data model, matching schema-v2-additions.sql exactly:
// deals -> marketplace_listings -> escrow_files -> escrow_milestones.
// Milestones are append-only: insert only, never update or delete.
// privacy_blocklist is deliberately NOT touched here (service role only).
export interface EscrowFileRow {
  id?: string;
  owner_id?: string;
  listing_id: string;
  emd_amount_required?: number;
  emd_status?: string;
  emd_deadline?: string | null;
  file_status?: string;
  target_closing_date?: string | null;
  outcome?: string;
  outcome_at?: string | null;
}

export type EscrowOutcome = 'open' | 'closed' | 'fell_through';

// The wholesaler who owns the escrow file records how it ended. This
// outcome feeds the buyer's earned record (buyer_record, schema v3.8).
export async function setEscrowOutcome(fileId: string, outcome: EscrowOutcome): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('escrow_files')
    .update({ outcome, outcome_at: outcome === 'open' ? null : new Date().toISOString() })
    .eq('id', fileId);
  if (error) throw error;
}

export async function createListingForDeal(
  userId: string,
  dealId: string,
  totalMarketplaceCost: number,
): Promise<{ id: string } | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({ owner_id: userId, deal_id: dealId, total_marketplace_cost: totalMarketplaceCost, visibility: 'public', listing_status: 'draft' })
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function createEscrowFile(
  userId: string,
  listingId: string,
  emdAmountRequired: number,
  emdDeadline: string | null,
): Promise<EscrowFileRow | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('escrow_files')
    .insert({ owner_id: userId, listing_id: listingId, emd_amount_required: emdAmountRequired, emd_deadline: emdDeadline, file_status: 'opened' })
    .select()
    .single();
  if (error) throw error;
  return data as EscrowFileRow;
}

export async function loadEscrowFilesForDeal(
  userId: string,
  dealId: string,
): Promise<EscrowFileRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data: listings, error: lErr } = await supabase
    .from('marketplace_listings')
    .select('id')
    .eq('owner_id', userId)
    .eq('deal_id', dealId);
  if (lErr) throw lErr;
  const ids = (listings || []).map((l: { id: string }) => l.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('escrow_files')
    .select('*')
    .eq('owner_id', userId)
    .in('listing_id', ids)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as EscrowFileRow[];
}

export async function addEscrowMilestone(
  userId: string,
  fileId: string,
  milestoneName: string,
): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('escrow_milestones')
    .insert({ owner_id: userId, file_id: fileId, milestone_name: milestoneName });
  if (error) throw error;
}
