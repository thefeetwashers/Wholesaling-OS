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
  liveBuyers: number; // Slice 116: distinct owners with a live box
  liveBoxes: number; // Slice 116: matching boxes confirmed live
}

// Slice 116 — buy-box liveness. A box speaks for its buyer until
// it is confirmed again: the confirmed-on date is the box's
// updated_at (created_at until first confirmation), and a box not
// confirmed within 120 days is STALE. Stale boxes still match —
// criteria are criteria — but every count that quotes buyers now
// leads with the confirmed-live number, and stale boxes are
// flagged wherever they are listed, because a match count that
// cannot tell a live buyer from a four-month-old form is a small
// lie told at scale.
export const BUY_BOX_STALE_DAYS = 120;

export interface BoxLiveness {
  confirmedOn: string; // yyyy-mm-dd, '' when the row carries no dates
  ageDays: number | null;
  live: boolean;
}

export function boxLiveness(box: BuyBox, todayISO: string): BoxLiveness {
  const raw = box.updated_at || box.created_at || '';
  const confirmedOn = raw ? raw.slice(0, 10) : '';
  if (!confirmedOn) return { confirmedOn: '', ageDays: null, live: false };
  const ageDays = Math.floor(
    (Date.parse(`${todayISO}T00:00:00Z`) - Date.parse(`${confirmedOn}T00:00:00Z`)) / 86400000,
  );
  return { confirmedOn, ageDays, live: ageDays <= BUY_BOX_STALE_DAYS };
}

export function countLeadMatches(lead: Lead, boxes: BuyBox[]): LeadMatchCount {
  const todayISO = new Date().toISOString().slice(0, 10);
  const matching = boxes.filter((b) => leadMatchesBox(lead, b));
  const owners = new Set(matching.map((b) => b.user_id || b.id || ''));
  const liveMatching = matching.filter((b) => boxLiveness(b, todayISO).live);
  const liveOwners = new Set(liveMatching.map((b) => b.user_id || b.id || ''));
  return {
    buyers: owners.size,
    boxes: matching.length,
    liveBuyers: liveOwners.size,
    liveBoxes: liveMatching.length,
  };
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
