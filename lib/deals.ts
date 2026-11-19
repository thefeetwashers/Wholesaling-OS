import { supabase, supabaseConfigured } from './supabase';
import type { DealContract } from './contracts';

// Deal shape follows the legacy public.deals table as dumped in
// ~/workspace/legacy-schema-dump-20261117.md ("### deals — 22 columns"),
// outside this repo — no production/ directory or schema.sql exists
// in the repo, so do not cite one.
// documents holds the signature-pipeline record (seller/buyer names and
// A-B / JV / B-C statuses) — the table has no separate contract-status
// columns, so the pipeline state lives there, honestly labeled.
export interface DealRow {
  id?: string;
  owner_id?: string;
  contract_type: string;
  contract_price?: number;
  arv?: number;
  repairs?: number;
  assignment_fee?: number;
  actual_sale_price?: number | null;
  emd_amount?: number;
  status: string;
  documents?: Record<string, unknown>;
  viewing_slots?: unknown[];
  confirmed_viewing?: Record<string, unknown>;
}

export function dealFromContract(userId: string, c: DealContract): DealRow {
  return {
    owner_id: userId,
    contract_type: c.buyer_name.trim() ? 'assignment' : 'purchase',
    // Slice 136 — money fields are null until entered; a null stays
    // unset on the row instead of being saved as 0 or a pre-filled
    // amount.
    contract_price: c.contract_price ?? undefined,
    arv: c.arv ?? undefined,
    repairs: c.repairs ?? undefined,
    assignment_fee: c.assignment_fee ?? undefined,
    emd_amount: c.emd_amount ?? undefined,
    status: c.ab_status === 'Signed' ? 'signed' : 'draft',
    documents: {
      property_address: c.property_address,
      city: c.city ?? null,
      state: c.state ?? null,
      seller_name: c.seller_name,
      buyer_name: c.buyer_name,
      ab_status: c.ab_status,
      jv_status: c.jv_status,
      bc_status: c.bc_status,
      jv_partner: c.jv_partner ?? null,
      jv_split_pct: c.jv_split_pct ?? null,
    },
  };
}

export async function loadDeals(userId: string): Promise<DealRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DealRow[];
}

export async function saveDeal(deal: DealRow): Promise<DealRow | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('deals')
    .insert(deal)
    .select()
    .single();
  if (error) throw error;
  return data as DealRow;
}

export async function updateDealViewing(
  dealId: string,
  viewing_slots: unknown[],
  confirmed_viewing: Record<string, unknown>,
): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('deals')
    .update({ viewing_slots, confirmed_viewing })
    .eq('id', dealId);
  if (error) throw error;
}
