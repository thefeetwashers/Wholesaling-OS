// Slice 115 — the courtesy hold.
//
// Some distress is grief. A lead the wholesaler has tagged
// probate/inherited or fire damage is a household in the worst
// weeks of its year, and the platform's answer is time: the lead
// carries a hold-until date — 45 days from the observed date for
// probate, 21 for fire — computed from the tag's own observed_on
// (the date the wholesaler's source reported it). Nothing is
// stored: the hold is a rule over the tag record, so it lifts
// itself when the date passes, and removing the tag ends it at
// once.
//
// Enforcement is the platform's usual kind: the hold is VISIBLE
// everywhere outreach happens — a chip on the lead, a line in the
// tags panel, a banner in the Comms Center, a warning by the
// letter — and the call queue holds the lead back entirely while
// it runs. Contact itself is never hard-blocked (the Do Not
// Contact list is the only hard stop, and it is a legal one); the
// hold states plainly that it is a courtesy convention, not a law,
// because a platform that cries "legal requirement" at its own
// manners would be lying about both.

import type { DistressTagRow } from './distress';

export const COURTESY_HOLDS: Record<string, { days: number; label: string }> = {
  probate_inherited: { days: 45, label: 'Probate / inherited' },
  fire_damage: { days: 21, label: 'Fire damage' },
};

export interface CourtesyHold {
  until: string; // yyyy-mm-dd — the first day outreach is courteous again
  label: string;
  tagKey: string;
  observedOn: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The active hold for a lead's tags, or null. When two qualifying
// tags run at once, the LATER until governs — the longer courtesy.
export function courtesyHold(tags: DistressTagRow[], todayISO: string): CourtesyHold | null {
  let best: CourtesyHold | null = null;
  for (const t of tags) {
    const rule = COURTESY_HOLDS[t.tag];
    if (!rule) continue;
    const until = addDays(t.observed_on, rule.days);
    if (until >= todayISO && (!best || until > best.until)) {
      best = { until, label: rule.label, tagKey: t.tag, observedOn: t.observed_on };
    }
  }
  return best;
}

export function courtesyHoldLine(h: CourtesyHold): string {
  return `Courtesy hold until ${h.until} — ${h.label}, observed ${h.observedOn}. A courtesy convention, not a law: give the household room. The hold lifts itself on that date; removing the tag ends it now.`;
}
