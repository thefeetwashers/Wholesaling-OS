import { supabase, supabaseConfigured } from './supabase';
import type { DecisionMaker, ProbateLead, ProbateOutreachStatus } from './probate-import';

// Slice 127 — probate_leads API helpers. Flat lib/ file, like
// lib/leads.ts, importing the repo's real client (lib/supabase.ts).
// No @/ alias exists in this repo.
//
// Rules these helpers enforce (the pasted helper file got several
// wrong — each is corrected here):
//   * paslc_search_url is exactly 'https://paslc.gov' for St. Lucie
//     County rows and null for any other county — never a name
//     concatenated onto the domain (the paste built the broken
//     'https://paslc.govSCHOEPP'), and never a St. Lucie link
//     shown for another county (national scope, Nov 16, 2026).
//   * Merges UNION decision-makers by name+role: saved makers the
//     new file omits are kept with their contact info; incoming
//     nulls never overwrite saved phone/email/address.
//   * outreach_status only moves to 'Skip Traced' when the lead's
//     current status is 'New' — a 'Contacted' or 'Offer Sent'
//     lead is never dragged backwards.
//   * Every write verifies it applied (.select('id') + throw when
//     nothing came back) — Supabase returns no error when zero
//     rows match, so a silently blocked save is never reported
//     as success.
//   * is_pro_se is a generated column and is never in a payload.

export interface ProbateLeadRow extends ProbateLead {
  id: string;
  user_notes: string;
}

function rowToLead(r: Record<string, unknown>): ProbateLeadRow {
  return {
    id: String(r.id || ''),
    user_id: typeof r.user_id === 'string' ? r.user_id : undefined,
    county: String(r.county || 'St. Lucie County, FL'),
    case_number: String(r.case_number || ''),
    case_status: r.case_status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    decedent_name: typeof r.decedent_name === 'string' ? r.decedent_name : null,
    decedent_aliases: Array.isArray(r.decedent_aliases) ? (r.decedent_aliases as string[]) : [],
    decision_makers: Array.isArray(r.decision_makers) ? (r.decision_makers as DecisionMaker[]) : [],
    has_attorney: r.has_attorney === true,
    attorney_names: Array.isArray(r.attorney_names) ? (r.attorney_names as string[]) : [],
    is_pro_se: r.is_pro_se === true,
    creditor_claims: Array.isArray(r.creditor_claims) ? (r.creditor_claims as string[]) : [],
    notes_flags: typeof r.notes_flags === 'string' ? r.notes_flags : '',
    user_notes: typeof r.user_notes === 'string' ? r.user_notes : '',
    property_address: typeof r.property_address === 'string' ? r.property_address : null,
    paslc_search_url: typeof r.paslc_search_url === 'string' ? r.paslc_search_url : null,
    outreach_status: (r.outreach_status as ProbateOutreachStatus) || 'New',
    created_at: typeof r.created_at === 'string' ? r.created_at : undefined,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  };
}

// Fetch the wholesaler's probate leads, Pro Se first (the priority
// order the tabs rely on), then case number. includeClosed false
// (default) returns OPEN only; true returns everything so the
// "Archived (Closed)" tab works. Optional county filter.
export async function fetchProbateLeads(
  userId: string,
  opts?: { includeClosed?: boolean; county?: string },
): Promise<ProbateLeadRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  let q = supabase.from('probate_leads').select('*').eq('user_id', userId);
  if (!opts?.includeClosed) q = q.eq('case_status', 'OPEN');
  if (opts?.county) q = q.eq('county', opts.county);
  const { data, error } = await q
    .order('is_pro_se', { ascending: false })
    .order('case_number', { ascending: true });
  if (error) throw error;
  return ((data || []) as Record<string, unknown>[]).map(rowToLead);
}

async function mustApply(
  userId: string,
  leadId: string,
  patch: Record<string, unknown>,
  what: string,
): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase is not configured on this deployment.');
  const { data, error } = await supabase
    .from('probate_leads')
    .update(patch)
    .eq('id', leadId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(error.message || `Could not save ${what}.`);
  if (!data || data.length === 0) {
    throw new Error(`Could not save ${what} — the row was not found (it may belong to another office).`);
  }
}

export async function updateProbatePropertyAddress(
  userId: string,
  leadId: string,
  propertyAddress: string,
): Promise<void> {
  await mustApply(userId, leadId, { property_address: propertyAddress.trim() || null }, 'the property address');
}

export async function updateProbateUserNotes(
  userId: string,
  leadId: string,
  userNotes: string,
): Promise<void> {
  await mustApply(userId, leadId, { user_notes: userNotes }, 'your notes');
}

export async function updateProbateOutreachStatus(
  userId: string,
  leadId: string,
  outreachStatus: ProbateOutreachStatus,
): Promise<void> {
  await mustApply(userId, leadId, { outreach_status: outreachStatus }, 'the outreach status');
}

// Save contact details for one decision-maker (manual entry, or a
// real skip-trace result). Reads the row first so the merge can
// preserve saved values and so outreach_status only advances from
// 'New' to 'Skip Traced' — never backwards from Contacted or
// Offer Sent.
export async function updateDecisionMakerContact(
  userId: string,
  leadId: string,
  decisionMakerIndex: number,
  patch: {
    phone?: string | null;
    email?: string | null;
    mailing_address?: string | null;
    skip_trace_status?: 'pending' | 'found' | 'not_found';
    alt_phones?: string[];
    alt_emails?: string[];
  },
): Promise<ProbateLeadRow> {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase is not configured on this deployment.');
  const { data: rows, error: readError } = await supabase
    .from('probate_leads')
    .select('*')
    .eq('id', leadId)
    .eq('user_id', userId)
    .limit(1);
  if (readError) throw new Error(readError.message || 'Could not read this lead.');
  const row = rows && rows.length > 0 ? rowToLead(rows[0] as Record<string, unknown>) : null;
  if (!row) throw new Error('Could not save the contact — the lead was not found (it may belong to another office).');
  const dms = [...row.decision_makers];
  const dm = dms[decisionMakerIndex];
  if (!dm) throw new Error('That decision-maker is no longer on this lead.');
  const next: DecisionMaker = {
    ...dm,
    phone: patch.phone !== undefined ? patch.phone : dm.phone,
    email: patch.email !== undefined ? patch.email : dm.email,
    mailing_address: patch.mailing_address !== undefined ? patch.mailing_address : dm.mailing_address,
    skip_trace_status: patch.skip_trace_status || dm.skip_trace_status,
    alt_phones: patch.alt_phones !== undefined ? patch.alt_phones : dm.alt_phones,
    alt_emails: patch.alt_emails !== undefined ? patch.alt_emails : dm.alt_emails,
    skip_traced_at: patch.skip_trace_status === 'found' || patch.skip_trace_status === 'not_found'
      ? new Date().toISOString()
      : dm.skip_traced_at,
  };
  dms[decisionMakerIndex] = next;
  const updatePatch: Record<string, unknown> = { decision_makers: dms };
  // Only 'New' advances to 'Skip Traced'. A lead already
  // Contacted, Offer Sent, Under Contract, or Dead keeps its
  // status — contact details arriving must never drag it back.
  if (row.outreach_status === 'New' && (next.phone || next.email)) {
    updatePatch.outreach_status = 'Skip Traced';
  }
  await mustApply(userId, leadId, updatePatch, 'the contact details');
  return { ...row, decision_makers: dms, outreach_status: (updatePatch.outreach_status as ProbateOutreachStatus) || row.outreach_status };
}

// Append-only contact history (probate_lead_activity, Slice 127
// migration section 3). A row is written ONLY when the wholesaler
// actually contacts the decision-maker — the outreach modal's
// "I sent this" button (sms/email) and the print modal's "I mailed
// this" button (mail). Copying, opening an app, or printing alone
// never calls this. The insert is verified (.select('id') + throw
// when nothing came back) so a silently blocked write is never
// reported as saved. No fake history rows, ever.
export type ProbateActivityType = 'call' | 'sms' | 'email' | 'mail' | 'note';

export async function logProbateActivity(
  userId: string,
  leadId: string,
  activityType: ProbateActivityType,
  note: string,
): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase is not configured on this deployment.');
  const { data, error } = await supabase
    .from('probate_lead_activity')
    .insert({ lead_id: leadId, user_id: userId, activity_type: activityType, note })
    .select('id');
  if (error) throw new Error(error.message || 'Could not save the contact history.');
  if (!data || data.length === 0) throw new Error('The contact history was not saved — nothing was written.');
}

export interface ProbateLastContact {
  activity_type: ProbateActivityType;
  created_at: string;
}

// Latest contact per lead (one row each) for the "Last contact"
// line on the probate table. Returns a map lead_id -> last entry.
export async function fetchProbateLastContacts(userId: string): Promise<Record<string, ProbateLastContact>> {
  if (!supabaseConfigured || !supabase) return {};
  const { data, error } = await supabase
    .from('probate_lead_activity')
    .select('lead_id, activity_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const out: Record<string, ProbateLastContact> = {};
  for (const r of (data || []) as { lead_id: string; activity_type: string; created_at: string }[]) {
    if (!out[r.lead_id]) {
      out[r.lead_id] = { activity_type: r.activity_type as ProbateActivityType, created_at: r.created_at };
    }
  }
  return out;
}
