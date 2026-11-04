import { supabase, supabaseConfigured } from './supabase';
import { updateLeadFields, type Lead } from './leads';

// Slice 47 — the dead-lead watchlist, wired to real leads. The
// schema has carried watched + recheck_date on leads and the
// lead_events table since v2, and an old prototype panel demonstrated
// the flow with local state only — it saved nothing. This lib is the
// real thing: watched/dead leads with a manual re-check date, and a
// wholesaler-logged public-record event (foreclosure, eviction, lien,
// code violation — the lead_events CHECK list) that resurrects the
// lead. Re-checks are MANUAL (the wholesaler looks at the county
// clerk record themselves, via the Counties & Title links); nothing
// is scraped and nobody is auto-contacted — resurrection only moves
// the lead back into the working pipeline with today's follow-up.

export const LEAD_EVENT_TYPES = [
  { key: 'foreclosure', label: 'Foreclosure filing' },
  { key: 'eviction', label: 'Eviction' },
  { key: 'lien', label: 'Lien' },
  { key: 'code_violation', label: 'Code violation' },
  { key: 'other', label: 'Other public-record event' },
] as const;

export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number]['key'];

export async function loadWatchlist(userId: string): Promise<Lead[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('owner_id', userId)
    .or('watched.eq.true,status.eq.dead')
    .order('recheck_date', { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return (data || []) as Lead[];
}

export async function setWatch(userId: string, leadId: string, recheckDate: string | null): Promise<void> {
  await updateLeadFields(userId, leadId, { watched: true, recheck_date: recheckDate });
}

export async function clearWatch(userId: string, leadId: string): Promise<void> {
  await updateLeadFields(userId, leadId, { watched: false, recheck_date: null });
}

export async function logEventAndResurrect(
  userId: string,
  leadId: string,
  eventType: LeadEventType,
  notes: string,
): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Office is not connected.');
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('lead_events').insert({
    owner_id: userId,
    lead_id: leadId,
    event_type: eventType,
    event_date: today,
    notes: notes || null,
  });
  if (error) throw error;
  await updateLeadFields(userId, leadId, {
    status: 'new',
    follow_up_date: today,
  });
}
