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
  // Slice 56 (schema v4.5): property facts the wholesaler reads off
  // the county record and enters — parcel/APN, year built, and the
  // mailing city/state/ZIP that powers the out-of-state owner flag.
  parcel_id?: string;
  assessed_value?: number | null;
  liens_amount?: number | null;
  // Slice 81 (schema v5.1): the property's monthly rent and the
  // seller's asking price, both typed by the wholesaler from the
  // lease or the listing — the pair behind the 1% rule flag.
  monthly_rent?: number | null;
  asking_price?: number | null;
  year_built?: number;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  phones?: string[];
  emails?: string[];
  // Slice 129 — owner contact saved from a Google lookup
  // (components/GoogleSkipTraceModal.tsx): the single phone/email
  // the wholesaler chose for this lead. The phones[]/emails[]
  // arrays above are the lead's full contact lists; these two are
  // the skip-traced pair. Added by migration
  // 20261115180000_leads_owner_contact.sql; null until set.
  owner_phone?: string | null;
  owner_email?: string | null;
  list_source?: string;
  created_at?: string;
  motivation_score?: number;
  mctp?: Record<string, unknown>;
  status: LeadStatus;
  notes?: string;
  follow_up_date?: string;
  // Slice 123: distress-list facts. distress_tag is the signal
  // the list itself carries (one of the six tags below); the
  // migration 20261115120000 adds both columns — until it is
  // applied, the importer stamps the tag into the lead's notes
  // instead and says so in its result.
  distress_tag?: string | null;
  is_absentee_owner?: boolean;
  // Slice 124: two-step seller form facts. is_partial is true
  // while the seller has finished step 1 (address + contact) but
  // not step 2; the dashboard shows these as "Partial — step 1
  // only". property_type / condition / occupancy / timeline are
  // the step-2 toggles. Consent already has columns above.
  is_partial?: boolean;
  property_type?: string | null;
  condition?: string | null;
  occupancy?: string | null;
  timeline?: string | null;
  // Slice 125: seller-firsts. tracker_token is the unguessable
  // key for the seller's private tracking link (/track/<token>);
  // seller_status is the seller-facing progress (separate from
  // the wholesaler's internal status above — the seller sees
  // only their own progress, never the CRM status). offer_* are
  // the wholesaler's own numbers for the Offer Receipt — the
  // seller sees exactly these, with "not provided" for any piece
  // the wholesaler left blank; nothing is computed or invented.
  // preferred_closing_date is the day the seller picked.
  // inherited_home + estate_* are the fast-lane answers.
  // Slice 127: probate_case_number is the ?case= tag from a
  // probate storefront link (/sell/<slug>?case=2026CP001433) —
  // the court file the seller came from, if any.
  tracker_token?: string | null;
  seller_status?: SellerStatus | null;
  preferred_closing_date?: string | null;
  offer_amount?: number | null;
  offer_comp_low?: number | null;
  offer_comp_high?: number | null;
  offer_repairs?: number | null;
  offer_resale_costs?: number | null;
  offer_note?: string | null;
  inherited_home?: boolean;
  estate_role?: string | null;
  letters_issued?: string | null;
  court_approval?: string | null;
  estate_notes?: string | null;
  probate_case_number?: string | null;
  // Slice 24 (schema v4.1): consent + do-not-contact state.
  do_not_contact?: boolean;
  consent_status?: ConsentStatus;
  consent_at?: string | null;
  consent_source?: string | null;
  // Dead-lead watchlist (schema v2 columns; UI wired in Slice 47):
  // watched leads carry a manual re-check date; a logged public-record
  // event (public.lead_events) resurrects them.
  watched?: boolean;
  recheck_date?: string | null;
}

// What contact permission is on file for a lead. 'unknown' is the
// default and means human one-to-one outreach only — the platform
// offers no automated sending or dialing at any consent level.
export type ConsentStatus = 'unknown' | 'requested_contact' | 'express_consent' | 'opted_out';

export const LEAD_STATUSES: LeadStatus[] = [
  'new', 'contacted', 'qualified', 'under_contract', 'assigned', 'closed', 'dead',
];

// Slice 125 — the seller-facing progress shown on the private
// tracking link (/track/<token>). This is NOT the wholesaler's
// internal CRM status above: the seller sees only these five
// steps, in this order, and nothing else about the lead.
export type SellerStatus = 'received' | 'reviewed' | 'offer_made' | 'closing_scheduled' | 'closed';

export const SELLER_STATUSES: SellerStatus[] = [
  'received', 'reviewed', 'offer_made', 'closing_scheduled', 'closed',
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

// Slice 61 — edit an existing lead. The Leads form was add-only
// through Slice 60, which meant a lead's facts (county above all —
// Your Markets reads it) could never be corrected in the app.
// Updates are fenced to the owner's own row twice: by id AND by
// owner_id, on top of the table's RLS.
export async function updateLead(userId: string, lead: Lead): Promise<Lead | null> {
  if (!supabaseConfigured || !supabase || !lead.id) return null;
  const fields: Record<string, unknown> = { ...(lead as unknown as Record<string, unknown>) };
  delete fields.id;
  delete fields.created_at;
  delete fields.owner_id;
  const { data, error } = await supabase
    .from('leads')
    .update(fields)
    .eq('id', lead.id)
    .eq('owner_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

// Slice 30 — batch import for the import inbox. Inserts in chunks.
// Slice 123 — the chunk size is now a parameter: the distress-list
// importer inserts in 250-row batches; the default 100 keeps the
// inbox's proven behavior. If a chunk fails, it falls back to
// one-by-one inserts so a single bad row cannot sink the batch, and
// it reports the database's real error message (PostgREST errors
// are plain objects, not Errors — the first live test's failure was
// invisible until this surfaced them).
export async function importLeads(
  userId: string,
  rows: Lead[],
  chunkSize = 100,
): Promise<{ inserted: number; error?: string }> {
  if (!supabaseConfigured || !supabase) return { inserted: 0, error: 'not configured' };
  let inserted = 0;
  let firstError: string | undefined;
  const size = chunkSize > 0 ? chunkSize : 100;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size).map((r) => ({ ...r, owner_id: userId }));
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

// Slice 33 — delete one of the caller's own leads (RLS enforces
// ownership). Exposed after the Slice 31 verification found the app
// had no lead-delete control anywhere and cleanup needed raw SQL.
export async function deleteLead(userId: string, leadId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .eq('owner_id', userId);
  if (error) throw error;
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
    esc(l.parcel_id), esc(l.year_built), esc(l.mailing_address), esc(l.mailing_city), esc(l.mailing_state), esc(l.mailing_zip),
    esc(l.assessed_value), esc(l.liens_amount), esc(l.monthly_rent), esc(l.asking_price),
  ].join(','));
  return ['property_address,city,state,zip,owner_name,status,follow_up_date,list_source,parcel_id,year_built,mailing_address,mailing_city,mailing_state,mailing_zip,assessed_value,liens_amount,monthly_rent,asking_price', ...rows].join('\n');
}

// Slice 81 — the rent-to-price flag: monthly rent as a percentage of
// the seller's asking price, the classic 1% rule of thumb landlord
// buyers screen with. Computed only when BOTH figures were entered;
// it is a screening flag on the wholesaler's own numbers, never a
// valuation, and it never hides or ranks a lead.
export function rentFlag(l: Lead): { pct: number; clears: boolean } | null {
  if (!l.monthly_rent || !l.asking_price || l.asking_price <= 0) return null;
  const pct = (l.monthly_rent / l.asking_price) * 100;
  return { pct, clears: pct >= 1 };
}

// Slice 56 — the out-of-state owner flag: the property sits in one
// state and the owner's tax bills go to another, computed only from
// the two state fields the wholesaler entered. Both must be present
// and different; anything less is not a flag.
// Slice 59 — estimated equity, a SCREENING FLAG on the wholesaler's
// own numbers: assessed value (the county's figure) minus the liens
// they recorded. It is never used to hide or drop a lead — the
// wholesaler sees the flag and decides. Assessed value is not
// market value; the analyzer is where real numbers get run.
export function estimatedEquity(lead: Lead): { equity: number; pct: number } | null {
  const a = lead.assessed_value; const l = lead.liens_amount;
  if (a == null || l == null || !isFinite(a) || !isFinite(l) || a <= 0) return null;
  const equity = a - l;
  return { equity, pct: Math.round((equity / a) * 100) };
}

export function isOutOfStateOwner(lead: Lead): boolean {
  const ps = (lead.state || '').trim().toUpperCase();
  const ms = (lead.mailing_state || '').trim().toUpperCase();
  return !!ps && !!ms && ps !== ms;
}

export function isOverdue(lead: Lead, today: string): boolean {
  return Boolean(lead.follow_up_date && lead.follow_up_date < today && lead.status !== 'closed' && lead.status !== 'dead');
}

export function isDueToday(lead: Lead, today: string): boolean {
  return lead.follow_up_date === today;
}
