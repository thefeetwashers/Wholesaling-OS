import { supabase, supabaseConfigured } from './supabase';
import { loadLeads, type Lead } from './leads';

// Slice 12 — scripts, call logging, outreach composer plumbing.
// The composer NEVER sends anything itself: email opens the user's own
// mail client (mailto:), other channels copy the merged text. Every
// prepared outreach is logged to public.outreach.

export async function loadMyLeads(userId: string): Promise<Lead[]> {
  const rows = await loadLeads(userId);
  return rows || [];
}

export type CallOutcome =
  | 'motivated' | 'not_interested' | 'follow_up'
  | 'no_answer' | 'wrong_number' | 'do_not_call';

export const CALL_OUTCOMES: CallOutcome[] = [
  'motivated', 'not_interested', 'follow_up', 'no_answer', 'wrong_number', 'do_not_call',
];

export interface CallLogInput {
  lead_id?: string | null;
  duration_seconds?: number | null;
  outcome: CallOutcome;
  notes?: string;
  next_step?: string;
  next_step_date?: string | null;
}

export async function logCall(userId: string, input: CallLogInput): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('call_logs').insert({ owner_id: userId, ...input });
  if (error) throw error;
}

export interface FollowUpRow {
  id: string;
  lead_id?: string | null;
  outcome: string;
  next_step?: string | null;
  next_step_date: string;
}

export async function loadFollowUpQueue(userId: string): Promise<FollowUpRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('call_logs')
    .select('id, lead_id, outcome, next_step, next_step_date')
    .eq('owner_id', userId)
    .not('next_step_date', 'is', null)
    .order('next_step_date', { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data || []) as unknown as FollowUpRow[];
}

export type OutreachChannel = 'sms' | 'whatsapp' | 'email' | 'call' | 'mail' | 'door';

export async function logOutreach(
  userId: string,
  leadId: string | null,
  channel: OutreachChannel,
  templateKey: string
): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('outreach').insert({
    owner_id: userId,
    lead_id: leadId,
    channel,
    template: templateKey,
    status: 'prepared',
  });
  if (error) throw error;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type BlocklistResult = 'clear' | 'blocked' | 'unconfigured' | 'error';

// Mirrors the server route's contract: SHA-256 hex of the normalized
// address (lowercase, trimmed, single-spaced) or the digits-only phone.
// FAIL CLOSED: anything other than an explicit { blocked: false } from the
// server stops the composer — the check is never skipped or assumed.
export async function checkBlocklist(address?: string, phone?: string): Promise<BlocklistResult> {
  const body: Record<string, string> = {};
  if (address && address.trim()) {
    body.hashed_address = await sha256Hex(address.toLowerCase().trim().replace(/\s+/g, ' '));
  } else if (phone && phone.trim()) {
    body.hashed_phone = await sha256Hex(phone.replace(/\D/g, ''));
  } else {
    return 'error';
  }
  try {
    const res = await fetch('/api/check-blocklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 500) return 'unconfigured';
    if (!res.ok) return 'error';
    const data = (await res.json()) as { blocked?: boolean };
    return data.blocked ? 'blocked' : 'clear';
  } catch {
    return 'error';
  }
}
