import { supabase, supabaseConfigured } from './supabase';

// Slice 67 — Deal Autopsy + follow-up streaks.
// The autopsy is a 2-minute structured debrief saved when an escrow
// file ends (closed or fell through). It belongs to the wholesaler
// alone and feeds their own lessons list — the platform never reads
// or ranks anyone's lessons.
// The streak counts DISTINCT days in the last 7 with at least one
// logged outreach touch (outreach rows are written by the Comms
// Center's channel opens and by in-app sends). It counts work the
// user actually logged — nothing inferred, nothing simulated.

export interface DealAutopsy {
  id?: string;
  owner_id?: string;
  escrow_file_id: string;
  outcome: 'closed' | 'fell_through';
  fee_amount?: number | null;
  worked: string;
  killed: string;
  lesson: string;
  created_at?: string;
}

export async function loadAutopsyForFile(escrowFileId: string): Promise<DealAutopsy | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('deal_autopsies')
    .select('*')
    .eq('escrow_file_id', escrowFileId)
    .maybeSingle();
  if (error) return null;
  return (data as DealAutopsy) || null;
}

export async function loadMyAutopsies(userId: string): Promise<DealAutopsy[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('deal_autopsies')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []) as DealAutopsy[];
}

export async function saveAutopsy(userId: string, a: DealAutopsy): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { error } = await supabase.from('deal_autopsies').upsert(
    {
      owner_id: userId,
      escrow_file_id: a.escrow_file_id,
      outcome: a.outcome,
      fee_amount: a.fee_amount ?? null,
      worked: a.worked,
      killed: a.killed,
      lesson: a.lesson,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'escrow_file_id' }
  );
  return !error;
}

export async function loadFollowUpStreak(userId: string): Promise<number | null> {
  if (!supabaseConfigured || !supabase) return null;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('outreach')
    .select('created_at')
    .eq('owner_id', userId)
    .gte('created_at', since)
    .limit(500);
  if (error || !data) return null;
  const days = new Set<string>();
  for (const r of data as { created_at: string }[]) {
    days.add(new Date(r.created_at).toDateString());
  }
  return days.size;
}
