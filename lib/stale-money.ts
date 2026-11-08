import { supabase, supabaseConfigured } from './supabase';
import { loadMyListings } from './portals';
import { loadDisbursements } from './money';

// Slice 76 — stale-money board. Money "sits still" in exactly three
// recorded situations, all read from the wholesaler's own rows:
//   1. an open escrow file whose target closing date has passed —
//      the deal's assignment fee is riding past its date;
//   2. an EMD deadline that passed without the money marked received;
//   3. a disbursement that left (or never left) more than 14 days
//      ago and is still not marked received.
// Amounts are the recorded figures only; an item with no recorded
// amount still lists, with no dollar figure invented for it.

export interface StaleItem {
  kind: 'closing_passed' | 'emd_overdue' | 'disbursement_waiting';
  label: string;
  amount: number | null;
  sinceISO: string;
  daysStale: number;
}

function daysBetween(fromISODate: string, toISODate: string): number {
  const a = new Date(`${fromISODate}T00:00:00Z`).getTime();
  const b = new Date(`${toISODate}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export async function loadStaleMoney(userId: string): Promise<{ items: StaleItem[]; total: number }> {
  if (!supabaseConfigured || !supabase) return { items: [], total: 0 };
  const todayISO = new Date().toISOString().slice(0, 10);
  const [filesRes, listings, disbursements] = await Promise.all([
    supabase
      .from('escrow_files')
      .select('listing_id, emd_status, emd_deadline, emd_amount_required, target_closing_date, outcome')
      .eq('owner_id', userId)
      .limit(500),
    loadMyListings(userId).catch(() => []),
    loadDisbursements(userId).catch(() => []),
  ]);
  if (filesRes.error) throw filesRes.error;
  const byListing: Record<string, { address: string; fee: number | null }> = {};
  for (const l of listings) {
    if (l.id) {
      byListing[l.id] = {
        address: l.deals?.documents?.property_address || 'Property',
        fee: l.deals?.assignment_fee != null ? Number(l.deals.assignment_fee) : null,
      };
    }
  }
  const items: StaleItem[] = [];
  for (const f of (filesRes.data || []) as {
    listing_id: string; emd_status?: string | null; emd_deadline?: string | null;
    emd_amount_required?: number | null; target_closing_date?: string | null; outcome?: string | null;
  }[]) {
    if (f.outcome && f.outcome !== 'open') continue;
    const info = byListing[f.listing_id] || { address: 'Property', fee: null };
    if (f.target_closing_date && f.target_closing_date.slice(0, 10) < todayISO) {
      const since = f.target_closing_date.slice(0, 10);
      items.push({
        kind: 'closing_passed', label: info.address, amount: info.fee,
        sinceISO: since, daysStale: daysBetween(since, todayISO),
      });
    }
    if (f.emd_deadline && f.emd_status !== 'received_verified' && f.emd_deadline.slice(0, 10) < todayISO) {
      const since = f.emd_deadline.slice(0, 10);
      items.push({
        kind: 'emd_overdue', label: info.address,
        amount: f.emd_amount_required != null ? Number(f.emd_amount_required) : null,
        sinceISO: since, daysStale: daysBetween(since, todayISO),
      });
    }
  }
  for (const d of disbursements) {
    if (d.status === 'received') continue;
    const stamp = (d.sent_at || d.created_at || '').slice(0, 10);
    if (!stamp) continue;
    const age = daysBetween(stamp, todayISO);
    if (age < 14) continue;
    items.push({
      kind: 'disbursement_waiting',
      label: d.instructions?.payee_name ? `Disbursement to ${d.instructions.payee_name}` : 'Disbursement',
      amount: d.amount != null ? Number(d.amount) : null,
      sinceISO: stamp, daysStale: age,
    });
  }
  items.sort((a, b) => b.daysStale - a.daysStale);
  const total = items.reduce((s, i) => s + (i.amount || 0), 0);
  return { items, total };
}
