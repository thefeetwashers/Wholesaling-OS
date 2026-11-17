// Slice 133 — deal status values + owner read/write for the
// wholesaler's own published deals.
//
// The status column lives on public.published_deals (migration
// 20261117144000_slice133_deal_status.sql). No new policy was
// needed: the Slice 132 "owner updates own published deal" policy
// already allows the owner to update their own rows, and the
// public read stays scoped to published = true.
//
// This file does NOT touch lib/published-deals.ts (owned by a
// sibling builder): it selects '*' so it keeps working before
// that file's DEAL_SELECT gains the status column, and before
// the migration is applied (rows then simply carry no status and
// read as 'Active'). The fetch lists published deals only, which
// the existing public-read policy already serves; see the note in
// components/MyPublishedDeals.tsx about unpublished rows.

import { supabase, supabaseConfigured } from './supabase';
import type { PublishedDeal } from './published-deals';

export const DEAL_STATUSES = ['Active', 'Under Contract', 'Sold'] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

// A published deal row with the Slice 133 status column. The
// status field is optional here because rows read before the
// migration was applied carry none — they read as 'Active'.
export type PublishedDealWithStatus = PublishedDeal & {
  status?: string | null;
};

export function normalizeDealStatus(value: string | null | undefined): DealStatus {
  if (value === 'Under Contract' || value === 'Sold') return value;
  return 'Active';
}

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so the deal status could not be changed. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Slice 133 migration, then try again.'
    );
  }
  return supabase;
}

// The signed-in wholesaler's own published deals, newest first.
// Published only: the Slice 132 public-read policy serves
// published = true rows to any signed-in user, which is what this
// list is.
export async function fetchMyPublishedDeals(userId: string): Promise<PublishedDealWithStatus[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('published_deals')
    .select('*')
    .eq('user_id', userId)
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PublishedDealWithStatus[];
}

// Owner-only status change. RLS refuses anyone who does not own
// the deal (the Slice 132 owner-update policy), and the update
// selects its row back, so a refused save throws instead of
// looking changed. Pre-migration the write fails with a clear
// "status column does not exist" error from Supabase — the caller
// shows it rather than pretending the change saved.
export async function updateDealStatus(
  userId: string,
  dealId: string,
  status: DealStatus
): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('published_deals')
    .update({ status })
    .eq('id', dealId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'The deal status could not be changed — the deal may not exist, it may not be yours, or the Slice 133 migration has not been applied yet.'
    );
  }
}
