import type { Lead } from './leads';
import type { BuyBox } from './portals';

// Slice 70 — lead ↔ buy-box matching for the Speed-to-Lead center.
// Same honesty rule as listingMatchesBox: a lead has no reliable price
// field, so matching is a PLAIN TEXT match on place (the box's
// cities / states / counties against the lead's city / state / county)
// and it is labeled as such wherever shown. A box with no place
// criteria counts as a general buyer and matches every lead.

export function leadMatchesBox(lead: Lead, box: BuyBox): boolean {
  if (!box.active) return false;
  const places = [...(box.cities || []), ...(box.states || []), ...(box.counties || [])]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!places.length) return true;
  const hay = [lead.city || '', lead.state || '', lead.county || ''].join(' ').toLowerCase();
  return places.some((p) => hay.includes(p));
}

export interface LeadMatchCount {
  buyers: number; // distinct buy-box owners
  boxes: number; // matching buy boxes
}

export function countLeadMatches(lead: Lead, boxes: BuyBox[]): LeadMatchCount {
  const matching = boxes.filter((b) => leadMatchesBox(lead, b));
  const owners = new Set(matching.map((b) => b.user_id || b.id || ''));
  return { buyers: owners.size, boxes: matching.length };
}

export function ageLabel(createdAt?: string): string {
  if (!createdAt) return '';
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min old`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr old`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day old' : `${days} days old`;
}
