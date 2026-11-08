import { supabase, supabaseConfigured } from './supabase';

// Slice 77 — campaign tracker. Groups the wholesaler's own logged
// work by the lead's list source: how many leads came from each
// source, how much outreach was logged against them (by channel),
// how many calls were logged, and how many of those calls became
// conversations — the platform's standing definition (Slice 14):
// a call logged with outcome 'motivated' or 'follow_up'. The logs
// are separate records of separate acts, so the counts are shown
// as recorded, never merged into an estimated funnel.

export interface CampaignRow {
  source: string;
  leads: number;
  outreach: number;
  letters: number;
  messages: number;
  callsLogged: number;
  conversations: number;
  moved: number;
}

const MOVED = ['qualified', 'under_contract', 'assigned', 'closed'];

export async function loadCampaigns(userId: string): Promise<CampaignRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const [leadsRes, outreachRes, callsRes] = await Promise.all([
    supabase.from('leads').select('id, list_source, status').eq('owner_id', userId).limit(2000),
    supabase.from('outreach').select('lead_id, channel').eq('owner_id', userId).limit(5000),
    supabase.from('call_logs').select('lead_id, outcome').eq('owner_id', userId).limit(5000),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  const sourceByLead: Record<string, string> = {};
  const rows: Record<string, CampaignRow> = {};
  const rowFor = (source: string): CampaignRow => {
    if (!rows[source]) {
      rows[source] = { source, leads: 0, outreach: 0, letters: 0, messages: 0, callsLogged: 0, conversations: 0, moved: 0 };
    }
    return rows[source];
  };
  for (const l of (leadsRes.data || []) as { id: string; list_source?: string | null; status: string }[]) {
    const source = (l.list_source || '').trim() || 'Not recorded';
    sourceByLead[l.id] = source;
    const r = rowFor(source);
    r.leads += 1;
    if (MOVED.includes(l.status)) r.moved += 1;
  }
  if (!outreachRes.error) {
    for (const o of (outreachRes.data || []) as { lead_id?: string | null; channel: string }[]) {
      if (!o.lead_id || !sourceByLead[o.lead_id]) continue;
      const r = rowFor(sourceByLead[o.lead_id]);
      r.outreach += 1;
      if (o.channel === 'mail') r.letters += 1;
      if (o.channel === 'sms' || o.channel === 'whatsapp' || o.channel === 'email') r.messages += 1;
    }
  }
  if (!callsRes.error) {
    for (const c of (callsRes.data || []) as { lead_id?: string | null; outcome: string }[]) {
      if (!c.lead_id || !sourceByLead[c.lead_id]) continue;
      const r = rowFor(sourceByLead[c.lead_id]);
      r.callsLogged += 1;
      if (c.outcome === 'motivated' || c.outcome === 'follow_up') r.conversations += 1;
    }
  }
  return Object.values(rows).sort((a, b) => b.leads - a.leads || b.outreach - a.outreach);
}
