// Slice 113 — the First-10-Days Sprint's evidence.
//
// The Sprint (components/Sprint.tsx) is the Command Center
// activation path: five firsts that turn a new account into a
// working office. Its one rule: a step checks off ONLY from a real
// record, never from a click on the checklist.
//
// Three steps read the account's own database rows (counties
// claimed, seller page published, lead count). Two steps are
// actions no database row captures — the first state-roll search
// and the first records request sent — so they are evidenced the
// way this platform already evidences such things (the Records
// Request Desk's log, the letter identity): a localStorage record
// on this device, written BY THE ACTION ITSELF when it happens
// (a search that returns records; a Desk entry marked sent), and
// labeled "(this device)" wherever it is shown. Nothing here can
// be checked off by tapping the Sprint card.

import { loadUserCounties } from './directories';
import { loadSellerPageSettings } from './portals';
import { loadLeads } from './leads';
import { loadRequestLog } from './records-request';

const ROLL_STAMP_KEY = 'ws_sprint_roll_search_v1';

export interface RollSearchStamp {
  at: string; // ISO date (yyyy-mm-dd)
  state: string;
}

export function stampRollSearch(state: string): void {
  try {
    const stamp: RollSearchStamp = { at: new Date().toISOString().slice(0, 10), state };
    window.localStorage.setItem(ROLL_STAMP_KEY, JSON.stringify(stamp));
  } catch {
    // Storage unavailable (private mode, etc.) — the stamp is
    // evidence, not machinery; the search itself already worked.
  }
}

export function readRollSearchStamp(): RollSearchStamp | null {
  try {
    const raw = window.localStorage.getItem(ROLL_STAMP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RollSearchStamp>;
    if (typeof parsed.at === 'string' && typeof parsed.state === 'string') {
      return { at: parsed.at, state: parsed.state };
    }
    return null;
  } catch {
    return null;
  }
}

export interface SprintState {
  countiesClaimed: number;
  rollStamp: RollSearchStamp | null;
  deskSent: boolean;
  sellerPageLive: boolean;
  leadCount: number;
}

export async function loadSprint(userId: string): Promise<SprintState> {
  const [counties, settings, leads] = await Promise.all([
    loadUserCounties(userId).catch(() => []),
    loadSellerPageSettings(userId).catch(() => null),
    loadLeads(userId).catch(() => null),
  ]);
  const log = loadRequestLog();
  return {
    countiesClaimed: counties.length,
    rollStamp: readRollSearchStamp(),
    deskSent: log.some((e) => e.status === 'sent' || e.status === 'received'),
    sellerPageLive: settings ? settings.seller_page_enabled : false,
    leadCount: leads ? leads.length : 0,
  };
}
