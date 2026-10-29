import { supabase, supabaseConfigured } from './supabase';

// Slice 14 — disbursements, KPI scorecard, action plans, admin aggregates.
// KPIs are computed live from the user's own source rows (leads, call_logs,
// offers, deals). kpi_daily remains the rollup table for a future
// scheduled job — no rollup job exists yet, so nothing reads it as fact.

export type DisbursementMethod = 'wire' | 'online' | 'mailed_check';
export type DisbursementStatus = 'draft' | 'sent_to_title' | 'received';

export interface Disbursement {
  id?: string;
  deal_id?: string | null;
  amount: number;
  method: DisbursementMethod;
  instructions: { payee_name?: string };
  authorization_letter?: string | null;
  status: DisbursementStatus;
  sent_at?: string | null;
  received_at?: string | null;
  created_at?: string;
}

// The letter deliberately references instructions held by the title
// company — full bank account/routing numbers are never stored in the app.
export function authorizationLetter(d: Disbursement, dealAddress: string): string {
  const methodLine =
    d.method === 'wire'
      ? 'Method: WIRE TRANSFER — per wire instructions provided directly to the title company by the payee.'
      : d.method === 'online'
        ? 'Method: ONLINE PAYMENT — per payment details provided directly to the title company by the payee.'
        : 'Method: MAILED CHECK — payable to the payee, mailed per the address on file with the title company.';
  return [
    'DISBURSEMENT AUTHORIZATION',
    `Property: ${dealAddress}`,
    `Payee: ${d.instructions.payee_name || '[payee name]'}`,
    `Amount: $${Number(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    methodLine,
    '',
    'Please confirm receipt of this authorization before disbursing.',
    'Bank details are intentionally not recorded in WholesalingOS; they move only between the payee and the title company.',
  ].join('\n');
}

export async function loadDisbursements(userId: string): Promise<Disbursement[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('disbursements')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Disbursement[];
}

export async function saveDisbursement(userId: string, d: Disbursement): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('disbursements').insert({ owner_id: userId, ...d });
  if (error) throw error;
}

export async function setDisbursementStatus(d: Disbursement, status: DisbursementStatus): Promise<void> {
  if (!supabaseConfigured || !supabase || !d.id) return;
  const patch: Record<string, unknown> = { status };
  if (status === 'sent_to_title') patch.sent_at = new Date().toISOString();
  if (status === 'received') patch.received_at = new Date().toISOString();
  const { error } = await supabase.from('disbursements').update(patch).eq('id', d.id);
  if (error) throw error;
}

function weekWindow(offsetWeeks: number): { start: Date; end: Date } {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const end = new Date(monday);
  end.setDate(monday.getDate() + 7);
  return { start: monday, end };
}

const inWin = (iso: string | undefined, w: { start: Date; end: Date }) =>
  !!iso && new Date(iso) >= w.start && new Date(iso) < w.end;

export interface KpiData {
  leadsThisWeek: number;
  leadsLastWeek: number;
  callsThisWeek: number;
  callsLastWeek: number;
  conversationsThisWeek: number;
  offersThisWeek: number;
  offersAcceptedTotal: number;
  contractsSignedTotal: number;
  feesClosedTotal: number;
  overdueFollowUps: number;
  uncontactedNew: number;
  stale100: number;
  offersAwaiting: number;
  activeListings: number;
}

export async function loadKpis(userId: string): Promise<KpiData | null> {
  if (!supabaseConfigured || !supabase) return null;
  const tw = weekWindow(0);
  const lw = weekWindow(-1);
  const today = new Date().toISOString().slice(0, 10);
  const [leadsRes, callsRes, offersRes, dealsRes, listingsRes] = await Promise.all([
    supabase.from('leads').select('created_at, status, follow_up_date').eq('owner_id', userId).limit(1000),
    supabase.from('call_logs').select('called_at, outcome').eq('owner_id', userId).limit(1000),
    supabase.from('offers').select('created_at, status').eq('wholesaler_user', userId).limit(1000),
    supabase.from('deals').select('assignment_fee, actual_sale_price, documents').eq('owner_id', userId).limit(1000),
    supabase.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('listing_status', 'active'),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  const leads = (leadsRes.data || []) as { created_at?: string; status: string; follow_up_date?: string }[];
  const calls = (callsRes.data || []) as { called_at?: string; outcome: string }[];
  const offers = (offersRes.data || []) as { created_at?: string; status: string }[];
  const deals = (dealsRes.data || []) as { assignment_fee?: number; actual_sale_price?: number | null; documents?: { ab_status?: string } }[];
  const twoDaysAgo = Date.now() - 2 * 86400000;
  return {
    leadsThisWeek: leads.filter((l) => inWin(l.created_at, tw)).length,
    leadsLastWeek: leads.filter((l) => inWin(l.created_at, lw)).length,
    callsThisWeek: calls.filter((c) => inWin(c.called_at, tw)).length,
    callsLastWeek: calls.filter((c) => inWin(c.called_at, lw)).length,
    conversationsThisWeek: calls.filter(
      (c) => inWin(c.called_at, tw) && (c.outcome === 'motivated' || c.outcome === 'follow_up')
    ).length,
    offersThisWeek: offers.filter((o) => inWin(o.created_at, tw)).length,
    offersAcceptedTotal: offers.filter((o) => o.status === 'accepted').length,
    contractsSignedTotal: deals.filter((d) => d.documents?.ab_status === 'Signed').length,
    feesClosedTotal: deals
      .filter((d) => d.actual_sale_price != null)
      .reduce((s, d) => s + Number(d.assignment_fee || 0), 0),
    overdueFollowUps: leads.filter(
      (l) => l.follow_up_date && l.follow_up_date < today && l.status !== 'closed' && l.status !== 'dead'
    ).length,
    uncontactedNew: leads.filter((l) => l.status === 'new').length,
    stale100: leads.filter(
      (l) => l.created_at && Date.now() - new Date(l.created_at).getTime() >= 100 * 86400000 && l.status !== 'closed' && l.status !== 'dead'
    ).length,
    offersAwaiting: offers.filter((o) => o.status === 'sent' && o.created_at && new Date(o.created_at).getTime() < twoDaysAgo).length,
    activeListings: listingsRes.count ?? 0,
  };
}

// Action plans are generated from the user's real gaps above — no
// invented benchmarks, no generic filler that ignores their data.
export function buildActionPlans(k: KpiData): { sevenDay: string[]; thirtyDay: string[] } {
  const seven: string[] = [];
  if (k.overdueFollowUps > 0) seven.push(`Days 1-2: clear ${k.overdueFollowUps} overdue follow-up${k.overdueFollowUps > 1 ? 's' : ''} — they are the warmest conversations you own.`);
  if (k.uncontactedNew > 0) seven.push(`Days 2-4: first contact on ${k.uncontactedNew} new lead${k.uncontactedNew > 1 ? 's' : ''} still sitting untouched.`);
  if (k.offersAwaiting > 0) seven.push(`Day 3: chase ${k.offersAwaiting} buyer offer${k.offersAwaiting > 1 ? 's' : ''} waiting 2+ days for your answer in the offers inbox.`);
  if (k.stale100 > 0) seven.push(`Days 4-6: re-work ${k.stale100} lead${k.stale100 > 1 ? 's' : ''} aged 100+ days in your list — new circumstances are the oldest trick in this business.`);
  if (k.activeListings === 0) seven.push('Day 5: activate at least one public listing so buyers and the public deals page have something to bite on.');
  if (seven.length === 0) seven.push('Your pipeline is clean this week: no overdue follow-ups, no untouched leads, no stale listings. Spend the week adding new leads and driving for dollars.');
  seven.push('Day 7: log every call, win or lose — next week\u2019s scorecard is only as honest as this week\u2019s logs.');

  const thirty: string[] = [
    `Week 1: work the backlog — ${k.overdueFollowUps} overdue follow-ups and ${k.uncontactedNew} untouched leads are this month's cheapest deals.`,
    'Week 2: add 10+ fresh leads (lists plus two Driving for Dollars routes) and publish or refresh your buy-box demand signals.',
    `Week 3: push contracts — you have ${k.contractsSignedTotal} signed A-B agreement${k.contractsSignedTotal === 1 ? '' : 's'} so far; every signed contract is a listing buyers can offer on.`,
    'Week 4: close the loop — collect outstanding disbursements, record actuals on closed deals so the P&L and this scorecard stay true, and review which lead sources produced conversations.',
  ];
  return { sevenDay: seven, thirtyDay: thirty };
}

export interface AdminAggregates {
  profiles_total?: number;
  profiles_by_role?: Record<string, number>;
  subscriptions_by_status?: Record<string, number>;
  deals_total?: number;
  listings_active?: number;
  offers_total?: number;
  buy_boxes_total?: number;
}

// Counts only, owner-only on the database side (schema v3.4): the
// function returns an empty object to every non-owner account.
export async function loadAdminAggregates(): Promise<AdminAggregates | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('admin_aggregates');
  if (error) throw error;
  return (data || {}) as AdminAggregates;
}
