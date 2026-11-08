import { supabase, supabaseConfigured } from './supabase';
import { loadLeads } from './leads';
import { loadDisbursements } from './money';
import { loadStaleMoney } from './stale-money';

// Slice 90 — the Weekly Report. An in-app, Monday-anchored
// summary built only from the wholesaler's own recorded rows:
// what came in, what got worked, what is due, what money moved.
// A quiet week reads as a quiet week — the report shows what the
// records show and invents nothing to fill the space. There is
// no email version: sending is human here, and the dashboard is
// where the week gets read.

export interface WeeklyReport {
  weekStart: string; // yyyy-mm-dd (Monday)
  leadsAdded: number;
  topSource: string | null;
  followUpsLogged: number;
  callsLogged: number;
  followUpsDue: number;
  closingsCounted: number;
  feesClosed: number;
  disbursedOut: number;
  pipeline: { status: string; count: number }[];
  staleTotal: number;
}

export function mondayOf(d: Date): string {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (day.getDay() + 6) % 7; // Monday = 0
  day.setDate(day.getDate() - dow);
  const m = `${day.getMonth() + 1}`.padStart(2, '0');
  const dd = `${day.getDate()}`.padStart(2, '0');
  return `${day.getFullYear()}-${m}-${dd}`;
}

function todayYmd(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

export async function loadWeeklyReport(userId: string, now: Date): Promise<WeeklyReport> {
  const weekStart = mondayOf(now);
  const today = todayYmd(now);
  const empty: WeeklyReport = {
    weekStart, leadsAdded: 0, topSource: null, followUpsLogged: 0, callsLogged: 0,
    followUpsDue: 0, closingsCounted: 0, feesClosed: 0, disbursedOut: 0, pipeline: [], staleTotal: 0,
  };
  if (!supabaseConfigured || !supabase) return empty;

  const [leads, outreachRes, callsRes, dealsRes, disbursements, stale] = await Promise.all([
    loadLeads(userId).catch(() => []),
    supabase.from('outreach').select('created_at').eq('owner_id', userId).gte('created_at', weekStart).limit(2000),
    supabase.from('call_logs').select('created_at').eq('owner_id', userId).gte('created_at', weekStart).limit(2000),
    supabase.from('deals').select('actual_sale_price, assignment_fee, updated_at').eq('owner_id', userId).not('actual_sale_price', 'is', null).limit(1000),
    loadDisbursements(userId).catch(() => []),
    loadStaleMoney(userId).catch(() => ({ items: [], total: 0 })),
  ]);

  const added = leads.filter((l) => (l.created_at || '').slice(0, 10) >= weekStart);
  const sourceCounts = new Map<string, number>();
  for (const l of added) sourceCounts.set(l.list_source || 'Not recorded', (sourceCounts.get(l.list_source || 'Not recorded') || 0) + 1);
  let topSource: string | null = null;
  let topCount = 0;
  Array.from(sourceCounts.entries()).forEach(([s, c]) => { if (c > topCount) { topSource = s; topCount = c; } });

  const pipelineMap = new Map<string, number>();
  for (const l of leads) pipelineMap.set(l.status, (pipelineMap.get(l.status) || 0) + 1);

  const closedThisWeek = ((dealsRes.data || []) as { actual_sale_price: number | null; assignment_fee: number | null; updated_at?: string }[])
    .filter((d) => (d.updated_at || '').slice(0, 10) >= weekStart);

  return {
    weekStart,
    leadsAdded: added.length,
    topSource,
    followUpsLogged: outreachRes.data?.length || 0,
    callsLogged: callsRes.data?.length || 0,
    followUpsDue: leads.filter((l) => l.follow_up_date && l.follow_up_date <= today && l.status !== 'closed' && l.status !== 'dead').length,
    closingsCounted: closedThisWeek.length,
    feesClosed: closedThisWeek.reduce((s, d) => s + Number(d.assignment_fee || 0), 0),
    disbursedOut: disbursements
      .filter((d) => ((d.sent_at || d.created_at || '').slice(0, 10) >= weekStart))
      .reduce((s, d) => s + Number(d.amount || 0), 0),
    pipeline: Array.from(pipelineMap.entries()).map(([status, count]) => ({ status, count })),
    staleTotal: stale.total,
  };
}
