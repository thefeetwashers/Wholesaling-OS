import { supabase, supabaseConfigured } from './supabase';
import { loadDisbursements, type Disbursement } from './money';

// Slice 82 — tax-season export. Two CSVs an accountant actually
// asks for, built only from recorded rows:
//   1. Closed deals — the platform's standing definition of closed
//      (an actual sale price is recorded on the deal, the same one
//      the KPI scorecard uses), with the recorded fee.
//   2. Disbursements — every money-out record with its payee,
//      amount, method and status.
// The year filter uses the record's own dates (deal last-updated;
// disbursement received/sent/created). The panel states plainly
// that lines must be matched against closing statements — this is
// bookkeeping, not tax advice, and nothing is estimated.

export interface ClosedDeal {
  address: string;
  city: string;
  state: string;
  contractPrice: number | null;
  assignmentFee: number | null;
  actualSalePrice: number | null;
  updatedAt: string;
}

export interface TaxData {
  deals: ClosedDeal[];
  disbursements: Disbursement[];
}

const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const yearOf = (iso?: string | null) => (iso ? Number(iso.slice(0, 4)) : NaN);

export async function loadTaxData(userId: string): Promise<TaxData> {
  if (!supabaseConfigured || !supabase) return { deals: [], disbursements: [] };
  const [dealsRes, disbursements] = await Promise.all([
    supabase
      .from('deals')
      .select('contract_price, assignment_fee, actual_sale_price, documents, updated_at')
      .eq('owner_id', userId)
      .not('actual_sale_price', 'is', null)
      .limit(1000),
    loadDisbursements(userId).catch(() => [] as Disbursement[]),
  ]);
  if (dealsRes.error) throw dealsRes.error;
  const deals: ClosedDeal[] = ((dealsRes.data || []) as {
    contract_price?: number | null; assignment_fee?: number | null; actual_sale_price?: number | null;
    documents?: { property_address?: string; city?: string; state?: string } | null; updated_at?: string;
  }[]).map((d) => ({
    address: d.documents?.property_address || 'Property',
    city: d.documents?.city || '',
    state: d.documents?.state || '',
    contractPrice: d.contract_price ?? null,
    assignmentFee: d.assignment_fee ?? null,
    actualSalePrice: d.actual_sale_price ?? null,
    updatedAt: d.updated_at || '',
  }));
  return { deals, disbursements };
}

export function taxYears(data: TaxData, currentYear: number): number[] {
  const set = new Set<number>([currentYear]);
  for (const d of data.deals) { const y = yearOf(d.updatedAt); if (Number.isFinite(y)) set.add(y); }
  for (const d of data.disbursements) {
    const y = yearOf(d.received_at || d.sent_at || d.created_at);
    if (Number.isFinite(y)) set.add(y);
  }
  return Array.from(set).sort((a, b) => b - a);
}

export function closedDealsCsv(deals: ClosedDeal[], year: number): string {
  const rows = deals.filter((d) => yearOf(d.updatedAt) === year).map((d) => [
    esc(d.address), esc(d.city), esc(d.state),
    esc(d.contractPrice), esc(d.assignmentFee), esc(d.actualSalePrice), esc(d.updatedAt.slice(0, 10)),
  ].join(','));
  return ['property_address,city,state,contract_price,assignment_fee,actual_sale_price,record_last_updated', ...rows].join('\n');
}

export function disbursementsCsv(list: Disbursement[], year: number): string {
  const rows = list
    .map((d) => ({ d, date: (d.received_at || d.sent_at || d.created_at || '').slice(0, 10) }))
    .filter((x) => yearOf(x.date) === year)
    .map(({ d, date }) => [
      esc(date), esc(d.instructions?.payee_name || ''), esc(d.amount), esc(d.method), esc(d.status),
    ].join(','));
  return ['date,payee,amount,method,status', ...rows].join('\n');
}

export function yearSummary(data: TaxData, year: number): { deals: number; fees: number; disbursements: number; out: number } {
  const deals = data.deals.filter((d) => yearOf(d.updatedAt) === year);
  const disb = data.disbursements.filter((d) => yearOf(d.received_at || d.sent_at || d.created_at) === year);
  return {
    deals: deals.length,
    fees: deals.reduce((s, d) => s + Number(d.assignmentFee || 0), 0),
    disbursements: disb.length,
    out: disb.reduce((s, d) => s + Number(d.amount || 0), 0),
  };
}
