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
}

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
