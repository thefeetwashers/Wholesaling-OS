import { loadLeads } from './leads';
import { DISTRESS_TAGS, loadAllTags, type DistressTagKey } from './distress';

// Slice 83 — Market Watch. The platform never pulls the county
// lists itself; the wholesaler pulls them by hand (the playbooks)
// and stamps what they found with a distress tag + the date they
// observed it. This board turns those stamps into the one thing a
// working wholesaler actually needs to see: for each list type,
// when did I last work it, how many open leads came out of it,
// and is it due for a fresh pull. The rhythms are the platform's
// suggested routine, printed as suggestions — not claims about
// any county's publication schedule, which varies by county.

export interface WatchCard {
  tag: DistressTagKey;
  label: string;
  openLeads: number;
  lastObserved: string; // yyyy-mm-dd
  daysAgo: number;
  rhythmDays: number;
  due: boolean;
}

const RHYTHM_DAYS: Record<DistressTagKey, number> = {
  tax_delinquency: 30,
  code_violation: 14,
  vacant: 14,
  probate_inherited: 30,
  fire_damage: 7,
  pre_foreclosure: 14,
  auction: 7,
  divorce_partition: 30,
  stale_listing: 14,
  out_of_area_owner: 30,
};

function daysBetween(fromYmd: string, todayYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${todayYmd}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export async function loadMarketWatch(userId: string, todayYmd: string): Promise<{ cards: WatchCard[]; untouched: string[] }> {
  const [leads, tagsByLead] = await Promise.all([loadLeads(userId), loadAllTags(userId)]);
  const statusById = new Map(leads.map((l) => [l.id, l.status]));
  const byTag = new Map<string, { leads: Set<string>; last: string }>();
  for (const [leadId, rows] of Object.entries(tagsByLead)) {
    const status = statusById.get(leadId);
    if (status === 'closed' || status === 'dead') continue;
    for (const r of rows) {
      const entry = byTag.get(r.tag) || { leads: new Set<string>(), last: '' };
      entry.leads.add(leadId);
      if (r.observed_on > entry.last) entry.last = r.observed_on;
      byTag.set(r.tag, entry);
    }
  }
  const cards: WatchCard[] = [];
  const untouched: string[] = [];
  for (const t of DISTRESS_TAGS) {
    const entry = byTag.get(t.key);
    if (!entry || entry.leads.size === 0) { untouched.push(t.label); continue; }
    const daysAgo = daysBetween(entry.last, todayYmd);
    cards.push({
      tag: t.key,
      label: t.label,
      openLeads: entry.leads.size,
      lastObserved: entry.last,
      daysAgo,
      rhythmDays: RHYTHM_DAYS[t.key],
      due: daysAgo > RHYTHM_DAYS[t.key],
    });
  }
  cards.sort((a, b) => Number(b.due) - Number(a.due) || b.daysAgo - a.daysAgo);
  return { cards, untouched };
}
