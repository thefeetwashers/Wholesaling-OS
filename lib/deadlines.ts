import { supabase, supabaseConfigured } from './supabase';
import { loadMyListings } from './portals';

// Slice 45 — deadline radar. Deals die quietly on missed dates, so
// the dates already recorded on escrow files (EMD deadline, target
// closing date) are surfaced as countdowns. Only OPEN files count,
// and an EMD counts only while it is not marked received. Nothing
// is fetched from a title company and nothing is projected — these
// are the wholesaler's own recorded dates, sorted worst-first.

export interface DeadlineItem {
  kind: 'emd' | 'closing';
  address: string;
  dateISO: string;
  daysLeft: number; // negative = overdue
  detail: string;
}

export interface DeadlineFile {
  listing_id: string;
  emd_status?: string | null;
  emd_deadline?: string | null;
  emd_amount_required?: number | null;
  target_closing_date?: string | null;
  outcome?: string | null;
}

function daysBetween(fromISODate: string, toISODate: string): number {
  const a = new Date(`${fromISODate}T00:00:00Z`).getTime();
  const b = new Date(`${toISODate}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function summarizeDeadlines(
  files: DeadlineFile[],
  addressByListing: Record<string, string>,
  now: Date,
): DeadlineItem[] {
  const todayISO = now.toISOString().slice(0, 10);
  const items: DeadlineItem[] = [];
  for (const f of files) {
    if (f.outcome && f.outcome !== 'open') continue;
    const address = addressByListing[f.listing_id] || 'Property';
    if (f.emd_deadline && f.emd_status !== 'received_verified') {
      const dateISO = f.emd_deadline.slice(0, 10);
      items.push({
        kind: 'emd',
        address,
        dateISO,
        daysLeft: daysBetween(todayISO, dateISO),
        detail: f.emd_amount_required ? `EMD $${Math.round(Number(f.emd_amount_required)).toLocaleString('en-US')} not yet marked received` : 'EMD not yet marked received',
      });
    }
    if (f.target_closing_date) {
      items.push({
        kind: 'closing',
        address,
        dateISO: f.target_closing_date,
        daysLeft: daysBetween(todayISO, f.target_closing_date),
        detail: 'Target closing date',
      });
    }
  }
  items.sort((a, b) => a.daysLeft - b.daysLeft);
  return items;
}

export async function loadDeadlines(userId: string): Promise<DeadlineItem[]> {
  if (!supabaseConfigured || !supabase) return [];
  const [filesRes, listings] = await Promise.all([
    supabase
      .from('escrow_files')
      .select('listing_id, emd_status, emd_deadline, emd_amount_required, target_closing_date, outcome')
      .eq('owner_id', userId)
      .limit(500),
    loadMyListings(userId).catch(() => []),
  ]);
  if (filesRes.error) throw filesRes.error;
  const addressByListing: Record<string, string> = {};
  for (const l of listings) {
    if (l.id) addressByListing[l.id] = l.deals?.documents?.property_address || 'Property';
  }
  return summarizeDeadlines((filesRes.data || []) as DeadlineFile[], addressByListing, new Date());
}
