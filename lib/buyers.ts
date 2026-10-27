import { supabase, supabaseConfigured } from './supabase';

// Buyer shape matches production/schema.sql public.buyers exactly.
// states is a text[] in the database; the UI edits it as a comma list.
export interface BuyerRow {
  id?: string;
  owner_id?: string;
  name: string;
  buyer_type?: string;
  states: string[];
  buy_box?: string;
  tier?: number;
  verified_pof: boolean;
}

export function statesFromInput(input: string): string[] {
  return input.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function loadBuyers(userId: string): Promise<BuyerRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BuyerRow[];
}

export async function saveBuyer(userId: string, buyer: BuyerRow): Promise<BuyerRow | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('buyers')
    .insert({ ...buyer, owner_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as BuyerRow;
}
