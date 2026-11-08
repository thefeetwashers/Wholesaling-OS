import { supabase, supabaseConfigured } from './supabase';
import { loadMyListings } from './portals';

// Slice 76 — closing calendar entries. The month grid plots only
// dates the wholesaler actually recorded: EMD deadlines and target
// closing dates from open escrow files, and follow-up dates from
// open leads. Nothing is fetched from a title company, nothing is
// projected, and a received EMD leaves the calendar (it is done).

export interface CalendarEntry {
  dateISO: string; // yyyy-mm-dd
  kind: 'emd' | 'closing' | 'followup';
  label: string;
}

export async function loadCalendarEntries(userId: string): Promise<CalendarEntry[]> {
  if (!supabaseConfigured || !supabase) return [];
  const [filesRes, leadsRes, listings] = await Promise.all([
    supabase
      .from('escrow_files')
      .select('listing_id, emd_status, emd_deadline, target_closing_date, outcome')
      .eq('owner_id', userId)
      .limit(500),
    supabase
      .from('leads')
      .select('property_address, city, status, follow_up_date')
      .eq('owner_id', userId)
      .limit(1000),
    loadMyListings(userId).catch(() => []),
  ]);
  if (filesRes.error) throw filesRes.error;
  const addressByListing: Record<string, string> = {};
  for (const l of listings) {
    if (l.id) addressByListing[l.id] = l.deals?.documents?.property_address || 'Property';
  }
  const entries: CalendarEntry[] = [];
  for (const f of (filesRes.data || []) as {
    listing_id: string; emd_status?: string | null; emd_deadline?: string | null;
    target_closing_date?: string | null; outcome?: string | null;
  }[]) {
    if (f.outcome && f.outcome !== 'open') continue;
    const address = addressByListing[f.listing_id] || 'Property';
    if (f.emd_deadline && f.emd_status !== 'received_verified') {
      entries.push({ dateISO: f.emd_deadline.slice(0, 10), kind: 'emd', label: address });
    }
    if (f.target_closing_date) {
      entries.push({ dateISO: f.target_closing_date.slice(0, 10), kind: 'closing', label: address });
    }
  }
  if (!leadsRes.error) {
    for (const l of (leadsRes.data || []) as {
      property_address: string; city?: string; status: string; follow_up_date?: string | null;
    }[]) {
      if (!l.follow_up_date) continue;
      if (l.status === 'closed' || l.status === 'dead') continue;
      entries.push({
        dateISO: l.follow_up_date.slice(0, 10),
        kind: 'followup',
        label: l.city ? `${l.property_address}, ${l.city}` : l.property_address,
      });
    }
  }
  entries.sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : 0));
  return entries;
}
