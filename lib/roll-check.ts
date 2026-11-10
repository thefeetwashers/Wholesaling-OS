// Slice 114 — Check the roll: the verdict language.
//
// One tap on a lead asks the lit state roll about it and stamps
// the answer into the lead's notes. The stamp is written here, by
// rules that never claim more than the roll's answer established:
//
// - Parcel mode: the roll CONFIRMS a parcel when the route's
//   exact-ID pass produced the records (it answers `exact: true`),
//   or — for the rolls whose IDs are statewide-unique and need no
//   exact pass (FL, CT) — when a returned record carries the lead's
//   exact ID under separator/case normalization. Near matches alone
//   are reported as near matches, not as a verdict.
// - When several records carry the same ID (Massachusetts town
//   formats, Wisconsin county formats), the one at the lead's own
//   address is the one compared. If none is at that address, the
//   stamp says the ID repeats and the owner was NOT compared —
//   comparing against another town's parcel would invent a verdict.
// - Owner mode (a lead with no parcel ID): the stamp reports the
//   address being found on the roll under that name, or says
//   plainly that it was not among the roll's first matches — the
//   roll answers 25 at a time, and the stamp carries that limit.
// - Owner comparison tolerates the roll's fuller forms ("SMITH
//   JOHN" vs "SMITH JOHN TRUSTEE" match by containment); anything
//   else is reported as DIFFERS with both names printed.

import { STATE_SOURCES, type StateCode, type StateRecord } from './state-records';

export const ROLL_CHECK_STATES: Record<string, StateCode> = {
  FL: 'FL',
  CT: 'CT',
  MA: 'MA',
  WI: 'WI',
  DC: 'DC',
  CO: 'CO',
};

const STATE_NAMES: Record<StateCode, string> = {
  FL: 'Florida',
  CT: 'Connecticut',
  MA: 'Massachusetts',
  WI: 'Wisconsin',
  DC: 'District of Columbia',
  CO: 'Colorado',
};

export interface RollAnswer {
  records: StateRecord[];
  exact: boolean;
}

// The lit rolls that answer ADDRESS searches (their engines ship an
// address mode). Florida is the exception — its statewide index
// answers owner and parcel instantly and address not at all (Slice
// 104) — so a parcel-less Florida lead is checked by surname plus
// an address match among the answer, per surnameQuery below.
export const ROLL_ADDRESS_STATES: ReadonlySet<StateCode> = new Set<StateCode>(['CT', 'MA', 'WI', 'DC', 'CO']);

// The owner-name fallback query for rolls without an address mode.
// A full multi-token name ("HANCOCK-SMITH ANYALIESE DOMINI") makes
// Florida's index AND four leading-wildcard scans together — that
// timed out live (Slice 114 verification, Nov 10, 2026) where a
// single token answers in seconds. The surname token is the
// selective one (Florida's roll is surname-first), and the check
// then matches the lead's ADDRESS among the answer, which is the
// confirmation that matters.
export function surnameQuery(ownerName: string): string {
  const first = ownerName.trim().split(/\s+/)[0] || '';
  const part = first.split('-')[0] || first;
  const cleaned = part.replace(/[^A-Za-z]/g, '').toUpperCase();
  return cleaned || ownerName.trim().toUpperCase();
}

function normLoose(v: string): string {
  return v
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function strippedId(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function ownersMatch(leadOwner: string, rollOwner: string): boolean {
  const a = normLoose(leadOwner);
  const b = normLoose(rollOwner);
  if (!a || !b) return false;
  return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

function sameAddress(a: string, b: string): boolean {
  const x = normLoose(a);
  const y = normLoose(b);
  if (!x || !y) return false;
  return x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0;
}

function ownerVerdict(leadOwner: string, rec: StateRecord): string {
  if (!leadOwner.trim()) {
    return `parcel confirmed on the roll; owner of record: ${rec.ownerName || '— not on record'} (this lead has no owner name to compare).`;
  }
  if (ownersMatch(leadOwner, rec.ownerName)) {
    return `owner of record MATCHES this lead — ${rec.ownerName}.`;
  }
  return `owner of record DIFFERS — roll: ${rec.ownerName || '— not on record'}; this lead: ${leadOwner}.`;
}

export function buildRollStamp(args: {
  today: string;
  state: StateCode;
  mode: 'parcel' | 'owner' | 'address';
  leadParcel: string;
  leadOwner: string;
  leadAddress: string;
  // The exact text the roll was queried with — the stamp names what
  // was actually searched (a surname token is not the full name).
  queryLabel: string;
  answer: RollAnswer;
}): string {
  const info = STATE_SOURCES.find((x) => x.code === args.state);
  const yearNoun = info ? info.yearNoun : 'roll';
  const first = args.answer.records[0];
  const year = first && first.rollYear !== null ? String(first.rollYear) : 'not stated';
  const head = `Roll check ${args.today} (${STATE_NAMES[args.state]} roll, ${yearNoun} year ${year}): `;
  const records = args.answer.records;

  if (args.mode === 'address') {
    if (records.length === 0) {
      return `${head}no roll record at this address.`;
    }
    const rec = records[0];
    if (!args.leadOwner.trim()) {
      return `${head}the roll lists this address — parcel ${rec.parcelId || '—'}, owner of record ${rec.ownerName || '— not on record'}.`;
    }
    if (ownersMatch(args.leadOwner, rec.ownerName)) {
      return `${head}the roll lists this address — parcel ${rec.parcelId || '—'}; owner of record MATCHES this lead — ${rec.ownerName}.`;
    }
    return `${head}the roll lists this address — parcel ${rec.parcelId || '—'}; owner of record DIFFERS — roll: ${rec.ownerName || '— not on record'}; this lead: ${args.leadOwner}.`;
  }

  if (args.mode === 'owner') {
    if (records.length === 0) {
      return `${head}no roll records under the name searched (“${args.queryLabel}”).`;
    }
    const atAddress = records.find((r) => sameAddress(r.address, args.leadAddress));
    if (atAddress) {
      return `${head}owner search found this address on the roll — parcel ${atAddress.parcelId || '—'}, owner of record ${atAddress.ownerName || '— not on record'}.`;
    }
    return `${head}this address was not among the roll’s first ${records.length} matches for the name searched (“${args.queryLabel}”; the roll answers 25 at a time); verify in the State Records panel.`;
  }

  // Parcel mode.
  if (records.length === 0) {
    return `${head}no record on the current roll for parcel ${args.leadParcel}.`;
  }
  const candidates = args.answer.exact
    ? records
    : records.filter((r) => strippedId(r.parcelId) === strippedId(args.leadParcel));
  if (candidates.length === 0) {
    return `${head}the roll’s parcel search returned near matches only — no exact ID confirmation for parcel ${args.leadParcel}; verify in the State Records panel.`;
  }
  if (candidates.length > 1) {
    const atAddress = candidates.find((r) => sameAddress(r.address, args.leadAddress));
    if (!atAddress) {
      return `${head}parcel ${args.leadParcel} is confirmed on the roll, but ${candidates.length} records carry that ID and none is at this lead’s address — the owner was not compared; verify in the State Records panel.`;
    }
    return `${head}${ownerVerdict(args.leadOwner, atAddress)}`;
  }
  return `${head}${ownerVerdict(args.leadOwner, candidates[0])}`;
}
