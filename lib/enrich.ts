import { loadLeads, saveLead, type Lead } from './leads';

// Slice 13 — stale-listing enrichment + Driving for Dollars helpers.
// Everything here computes from the user's own lead rows. Lookups are
// click-to-open search links only — nothing is scraped (site terms ban
// it), and there is no free bulk skip-trace API, so none is promised.

export type LeadRow = Lead & { created_at?: string };

export async function loadLeadRows(userId: string): Promise<LeadRow[]> {
  const rows = await loadLeads(userId);
  return (rows || []) as LeadRow[];
}

export function daysInList(lead: LeadRow, now = new Date()): number | null {
  if (!lead.created_at) return null;
  const ms = now.getTime() - new Date(lead.created_at).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function staleBadge(days: number | null): string {
  if (days === null) return '';
  if (days >= 180) return '180+ days';
  if (days >= 120) return '120+ days';
  if (days >= 100) return '100+ days';
  return '';
}

const norm = (s?: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

// Absentee owner: a mailing address on file that differs from the
// property address. A plain string comparison on the user's own data.
export function isAbsentee(lead: Lead): boolean {
  return !!lead.mailing_address && norm(lead.mailing_address) !== norm(lead.property_address);
}

export function googleLookupUrl(lead: Lead): string {
  const q = `"${lead.owner_name || ''}" ${lead.city || ''} ${lead.state || ''} property owner`;
  return `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`;
}

export function mapsUrl(address: string, city?: string, state?: string): string {
  const q = [address, city, state].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export const DISTRESS_FLAGS: { key: string; label: string; weight: number }[] = [
  { key: 'vacant', label: 'Looks vacant', weight: 3 },
  { key: 'boarded', label: 'Boarded / damaged windows', weight: 3 },
  { key: 'overgrown', label: 'Overgrown yard', weight: 2 },
  { key: 'mail_pileup', label: 'Mail / newspapers piled up', weight: 2 },
  { key: 'code_sticker', label: 'Code enforcement sticker', weight: 2 },
  { key: 'roof_damage', label: 'Roof / exterior damage', weight: 1 },
];
export const DISTRESS_MAX = DISTRESS_FLAGS.reduce((s, f) => s + f.weight, 0);

export function distressScore(flags: Record<string, boolean>): number {
  return DISTRESS_FLAGS.reduce((s, f) => s + (flags[f.key] ? f.weight : 0), 0);
}

export async function saveD4DLead(
  userId: string,
  address: string,
  city: string,
  state: string,
  flags: Record<string, boolean>
): Promise<Lead | null> {
  const score = distressScore(flags);
  const seen = DISTRESS_FLAGS.filter((f) => flags[f.key]).map((f) => f.label);
  const lead: Lead = {
    property_address: address,
    city: city || undefined,
    state: state || undefined,
    list_source: 'Driving for Dollars',
    status: 'new',
    motivation_score: Math.min(10, score),
    notes: seen.length ? `Driving for Dollars — observed: ${seen.join('; ')}` : 'Driving for Dollars pin',
    mctp: { distress_flags: seen, distress_score: score },
  };
  return saveLead(userId, lead);
}
