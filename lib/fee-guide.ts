// Slice 50 — the assignment fee guide. The owner's rule, made into
// honest math: for a HOUSE the suggested fee starts at $10,000 and
// rises with the room in the deal; for LAND it starts at $5,000.
// "Room" is what is left between the contract price and what an
// end buyer paying the 70% rule would pay (ARV x 0.70 - repairs),
// i.e. exactly the space the fee has to fit inside (see lib/mao.ts).
// The suggestion is 25% of the room once that beats the starting
// point, rounded to the nearest $500, and it can never exceed the
// room itself. It is a STARTING POINT the wholesaler edits up or
// down — the analyzer's fee field stays fully theirs.

export type PropertyKind = 'house' | 'land';

export interface FeeSuggestion {
  room: number;
  suggested: number;
  note: string;
}

export function feeRoom(arv: number, repairs: number, contractPrice: number): number {
  return arv * 0.7 - repairs - contractPrice;
}

export function suggestAssignmentFee(
  kind: PropertyKind,
  arv: number,
  repairs: number,
  contractPrice: number,
): FeeSuggestion {
  const room = feeRoom(arv, repairs, contractPrice);
  if (room <= 0) {
    return {
      room,
      suggested: 0,
      note: 'No room in this deal at the 70% rule — the contract price already eats the whole buyer budget. Renegotiate the price before thinking about a fee.',
    };
  }
  const base = kind === 'house' ? 10000 : 5000;
  const pct = Math.round((room * 0.25) / 500) * 500;
  let suggested = Math.max(base, pct);
  if (suggested > room) suggested = Math.max(0, Math.floor(room / 500) * 500) || room;
  if (room < base && suggested >= room) {
    return {
      room,
      suggested,
      note: `Tight deal: the whole room is ${'$'}${Math.round(room).toLocaleString('en-US')}, less than the ${kind === 'house' ? '$10,000 house' : '$5,000 land'} starting point — the suggestion takes what's there. A lower price buys you a real fee.`,
    };
  }
  return {
    room,
    suggested,
    note: kind === 'house'
      ? 'House rule: starts at $10,000 and rises at 25% of the room. Edit it up or down — it is your fee, not the platform\u2019s.'
      : 'Land rule: starts at $5,000 and rises at 25% of the room. Edit it up or down — it is your fee, not the platform\u2019s.',
  };
}
