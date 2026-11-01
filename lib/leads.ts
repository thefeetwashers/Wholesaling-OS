import { supabase, supabaseConfigured } from './supabase';

// Lead shape matches production/schema.sql public.leads exactly.
// status must be one of: new, contacted, qualified, under_contract,
// assigned, closed, dead. No other status is used anywhere.
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'under_contract' | 'assigned' | 'closed' | 'dead';

export interface Lead {
  id?: string;
  owner_id?: string;
  property_address: string;
  city?: string;
  state?: string;
  county?: string;
  zip?: string;
  owner_name?: string;
  mailing_address?: string;
  phones?: string[];
  emails?: string[];
  list_source?: string;
  motivation_score?: number;
  mctp?: Record<string, unknown>;
  status: LeadStatus;
  notes?: string;
  follow_up_date?: string;
  // Slice 24 (schema v4.1): consent + do-not-contact state.
  do_not_contact?: boolean;
  consent_status?: ConsentStatus;
  consent_at?: string | null;
  consent_source?: string | null;
}

// What contact permission is on file for a lead. 'unknown' is the
// default and means human one-to-one outreach only — the platform
// offers no automated sending or dialing at any consent level.
export type ConsentStatus = 'unknown' | 'requested_contact' | 'express_consent' | 'opted_out';

export const LEAD_STATUSES: LeadStatus[] = [
  'new', 'contacted', 'qualified', 'under_contract', 'assigned', 'closed', 'dead',
];

// Supabase load/save. Returns null when Supabase is not configured,
// so the caller can fall back to local session state honestly.
export async function loadLeads(userId: string): Promise<Lead[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Lead[];
}

export async function saveLead(userId: string, lead: Lead): Promise<Lead | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('leads')
    .insert({ ...lead, owner_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

// Slice 30 — batch import for the import inbox. Inserts in chunks of
// 100. If a chunk fails, it falls back to one-by-one inserts so a single
// bad row cannot sink the batch, and it reports the database's real
// error message (PostgREST errors are plain objects, not Errors — the
// first live test's failure was invisible until this surfaced them).
export async function importLeads(
  userId: string,
  rows: Lead[],
): Promise<{ inserted: number; error?: string }> {
  if (!supabaseConfigured || !supabase) return { inserted: 0, error: 'not configured' };
  let inserted = 0;
  let firstError: string | undefined;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100).map((r) => ({ ...r, owner_id: userId }));
    const { error } = await supabase.from('leads').insert(chunk);
    if (!error) { inserted += chunk.length; continue; }
    if (!firstError) firstError = error.message || 'database insert failed';
    for (const row of chunk) {
      const single = await supabase.from('leads').insert(row);
      if (single.error) { if (!firstError) firstError = single.error.message || firstError; }
      else inserted += 1;
    }
  }
  return firstError && inserted < rows.length ? { inserted, error: firstError } : { inserted };
}

// Partial update of the caller's own lead (RLS enforces ownership).
// Used by the comms center for consent / do-not-contact changes.
export async function updateLeadFields(
  userId: string,
  leadId: string,
  patch: Partial<Lead>
): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', leadId)
    .eq('owner_id', userId);
  if (error) throw error;
}

export function leadsToCsv(leads: Lead[]): string {
  const esc = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = leads.map((l) => [
    esc(l.property_address), esc(l.city), esc(l.state), esc(l.zip),
    esc(l.owner_name), esc(l.status), esc(l.follow_up_date), esc(l.list_source),
  ].join(','));
  return ['property_address,city,state,zip,owner_name,status,follow_up_date,list_source', ...rows].join('\n');
}

export function isOverdue(lead: Lead, today: string): boolean {
  return Boolean(lead.follow_up_date && lead.follow_up_date < today && lead.status !== 'closed' && lead.status !== 'dead');
}

export function isDueToday(lead: Lead, today: string): boolean {
  return lead.follow_up_date === today;
}
