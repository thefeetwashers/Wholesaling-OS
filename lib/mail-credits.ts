import { supabase, supabaseConfigured } from './supabase';

// Slice 122 — Direct Mail Credits data layer. A user's balance is
// SUM(credits_delta) over their own rows in mail_credits_ledger.
// The ledger is append-only (no update or delete policy), and
// credits are NOT charged in this slice: mail sending is not wired
// to any print provider, so the app never writes a negative delta
// until sending is live. The $0.85/letter price is the user's own
// figure, displayed as the price — no letter is sent and no credit
// is deducted by this code.

export const MAIL_PRICE_PER_LETTER = 0.85;

export interface MailCreditRow {
  id?: string;
  user_id?: string;
  credits_delta: number;
  unit_price_paid?: number | null;
  description?: string | null;
  created_at?: string;
}

export async function loadMailBalance(userId: string): Promise<number> {
  if (!supabaseConfigured || !supabase) return 0;
  const { data, error } = await supabase
    .from('mail_credits_ledger')
    .select('credits_delta')
    .eq('user_id', userId);
  if (error) return 0;
  return ((data || []) as { credits_delta: number }[]).reduce(
    (sum, r) => sum + Number(r.credits_delta || 0),
    0
  );
}

export async function loadMailLedger(userId: string): Promise<MailCreditRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('mail_credits_ledger')
    .select('id, user_id, credits_delta, unit_price_paid, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as MailCreditRow[];
}
