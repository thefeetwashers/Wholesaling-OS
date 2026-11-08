import { supabase, supabaseConfigured } from './supabase';
import type { Lead } from './leads';

// Slice 42 — distress tags, the human call queue, and manual contact
// provenance (schema v4.4; spec: distress-call-queue-spec.md).
// A tag is the wholesaler's own record of what THEIR source said,
// stamped with the date they observed it. The platform never scrapes
// anything to assign a tag and never computes a distress score —
// the queue sorts only by the tags and follow-up dates the
// wholesaler entered. Contact entries record phone/email values the
// wholesaler found themselves and typed in, with source + date; the
// platform never fetches contact details for anyone.

export const DISTRESS_TAGS = [
  { key: 'tax_delinquency', label: 'Tax delinquency / lien' },
  { key: 'code_violation', label: 'Code violation' },
  { key: 'vacant', label: 'Vacant' },
  { key: 'probate_inherited', label: 'Probate / inherited' },
  { key: 'pre_foreclosure', label: 'Pre-foreclosure' },
  { key: 'auction', label: 'Auction' },
  { key: 'divorce_partition', label: 'Divorce / partition' },
  { key: 'stale_listing', label: 'Stale listing' },
  { key: 'out_of_area_owner', label: 'Out-of-area owner' },
] as const;

export type DistressTagKey = (typeof DISTRESS_TAGS)[number]['key'];

export function distressLabel(key: string): string {
  const found = DISTRESS_TAGS.find((t) => t.key === key);
  return found ? found.label : key;
}

export interface DistressTagRow {
  id: string;
  lead_id: string;
  tag: string;
  observed_on: string;
}

export interface ContactEntryRow {
  id: string;
  lead_id: string;
  kind: 'phone' | 'email';
  value: string;
  source: string;
  entered_on: string;
}

export async function loadAllTags(userId: string): Promise<Record<string, DistressTagRow[]>> {
  if (!supabaseConfigured || !supabase) return {};
  const { data, error } = await supabase
    .from('lead_distress_tags')
    .select('id, lead_id, tag, observed_on')
    .eq('owner_id', userId)
    .order('observed_on', { ascending: true });
  if (error) throw error;
  const out: Record<string, DistressTagRow[]> = {};
  for (const r of (data || []) as DistressTagRow[]) {
    (out[r.lead_id] = out[r.lead_id] || []).push(r);
  }
  return out;
}

export async function addTag(userId: string, leadId: string, tag: string, observedOn: string): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Not connected.');
  const { error } = await supabase.from('lead_distress_tags').insert({
    owner_id: userId, lead_id: leadId, tag, observed_on: observedOn,
  });
  if (error) throw error;
}

export async function removeTag(userId: string, tagRowId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Not connected.');
  const { error } = await supabase.from('lead_distress_tags').delete().eq('id', tagRowId).eq('owner_id', userId);
  if (error) throw error;
}

export async function loadContactEntries(userId: string, leadId: string): Promise<ContactEntryRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('lead_contact_entries')
    .select('id, lead_id, kind, value, source, entered_on')
    .eq('owner_id', userId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as ContactEntryRow[];
}

export async function addContactEntry(
  userId: string, leadId: string, kind: 'phone' | 'email', value: string, source: string,
): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Not connected.');
  const { error } = await supabase.from('lead_contact_entries').insert({
    owner_id: userId, lead_id: leadId, kind, value, source,
  });
  if (error) throw error;
}

// Writes the lead's phones/emails arrays after a manual contact add.
export async function updateLeadContacts(
  userId: string, leadId: string, phones: string[], emails: string[],
): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Not connected.');
  const { error } = await supabase.from('leads').update({ phones, emails }).eq('id', leadId).eq('owner_id', userId);
  if (error) throw error;
}

// Slice 54 — the Distress Radar summary for the dashboard: tag
// counts across the wholesaler's open leads, plus a WORK-FIRST
// ranking of which tagged leads to touch first. This is not a
// distress score and says nothing about any person: the "heat" is
// computed only from tags and follow-up dates the wholesaler
// themselves entered, and the formula is printed wherever the
// number appears: +10 per distress tag on the lead, +15 when the
// follow-up is due today, +2 per day a follow-up is overdue
// (capped at +30).
export interface HeatEntry {
  lead: Lead;
  heat: number;
  reasons: string[];
}

export interface DistressSummary {
  counts: Record<string, number>;
  taggedLeads: number;
  hottest: HeatEntry[];
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00Z`).getTime();
  const b = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function leadHeat(lead: Lead, tags: DistressTagRow[], todayISO: string): HeatEntry {
  let heat = 0;
  const reasons: string[] = [];
  const n = tags.length;
  if (n > 0) {
    heat += n * 10;
    reasons.push(`${n} distress tag${n === 1 ? '' : 's'} (+${n * 10})`);
  }
  if (lead.follow_up_date) {
    if (lead.follow_up_date < todayISO) {
      const days = daysBetweenISO(lead.follow_up_date, todayISO);
      const pts = Math.min(30, days * 2);
      heat += pts;
      reasons.push(`follow-up ${days} day${days === 1 ? '' : 's'} overdue (+${pts})`);
    } else if (lead.follow_up_date === todayISO) {
      heat += 15;
      reasons.push('follow-up due today (+15)');
    }
  }
  return { lead, heat, reasons };
}

export function summarizeDistress(
  leads: Lead[],
  tagsByLead: Record<string, DistressTagRow[]>,
  todayISO: string,
): DistressSummary {
  const counts: Record<string, number> = {};
  for (const t of DISTRESS_TAGS) counts[t.key] = 0;
  const open = leads.filter((l) => l.status !== 'closed' && l.status !== 'dead');
  let taggedLeads = 0;
  const heated: HeatEntry[] = [];
  for (const l of open) {
    const tags = tagsByLead[l.id || ''] || [];
    if (tags.length > 0) {
      taggedLeads += 1;
      for (const t of tags) counts[t.tag] = (counts[t.tag] || 0) + 1;
      heated.push(leadHeat(l, tags, todayISO));
    }
  }
  heated.sort((a, b) => b.heat - a.heat);
  return { counts, taggedLeads, hottest: heated.slice(0, 5) };
}

// The human call queue: only leads the wholesaler tagged, worked in
// follow-up order — overdue first, then due today, then upcoming by
// date, then no follow-up date; ties break toward more tags (more
// observed signals first). Nothing here is scored or inferred: the
// order comes only from dates and tags the wholesaler entered.
export function sortCallQueue(
  leads: Lead[], tagsByLead: Record<string, DistressTagRow[]>, todayISO: string,
): Lead[] {
  const bucket = (l: Lead): number => {
    if (!l.follow_up_date) return 3;
    if (l.follow_up_date < todayISO) return 0;
    if (l.follow_up_date === todayISO) return 1;
    return 2;
  };
  return [...leads].sort((a, b) => {
    const ba = bucket(a); const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    const da = a.follow_up_date || '9999-12-31'; const db = b.follow_up_date || '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    const ta = (tagsByLead[a.id || ''] || []).length; const tb = (tagsByLead[b.id || ''] || []).length;
    return tb - ta;
  });
}
