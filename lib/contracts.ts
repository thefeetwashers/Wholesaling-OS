import { calculateMAO, totalMarketplaceCost } from './mao';

// Contract + signature rules, ported from the old prototype (verified Oct 24, 2026).
// A-B to seller: price ONLY, never the fee, buyer, or margin.
// JV between wholesalers: BEFORE marketing, attaches to the file, never emailed alone.
// B-C to buyer: ONLY after A-B is marked Signed, full breakdown + EMD + 24h deadline.
// Title package: A-B + B-C (+ JV if any) via email handoff, not an API.
// All sending is a mailto composer + manual status. No real e-sign here.
export type SigStatus = 'Draft' | 'Sent' | 'Signed';

export interface DealContract {
  property_address: string;
  city?: string;
  state?: string;
  seller_name: string;
  buyer_name: string;
  contract_price: number;
  arv: number;
  repairs: number;
  assignment_fee: number;
  emd_amount: number;
  jv_partner?: string;
  jv_split_pct?: number;
  ab_status: SigStatus;
  jv_status: SigStatus | 'Not a JV deal';
  bc_status: SigStatus;
}

export const CONTRACT_CLAUSES = [
  'A. Right to assign: Buyer may assign this contract, in whole or in part, to a third party.',
  'B. Equitable interest: Buyer holds an equitable interest in the property and may market that interest, not the property itself.',
  'C. Inspection contingency: Buyer may inspect the property and cancel within the inspection period stated in the signed contract.',
  'D. EMD non-refundability: Earnest money becomes non-refundable as stated in the signed contract once contingencies are removed.',
];

export function sellerView(c: DealContract): string {
  // Exactly one money value: the price. Fee, buyer, and margin are never interpolated here.
  return `Purchase Agreement — ${c.property_address}\nSeller: ${c.seller_name}\nPurchase price: $${c.contract_price.toLocaleString()}\n\n${CONTRACT_CLAUSES.join('\n')}\n\nATTORNEY REVIEW REQUIRED BEFORE USE. This is a template, not legal advice.`;
}

export function buyerView(c: DealContract): string {
  const total = totalMarketplaceCost(c.contract_price, c.assignment_fee);
  const mao = calculateMAO(c.arv, c.repairs, c.assignment_fee);
  return `Assignment Agreement — ${c.property_address}\nBuyer: ${c.buyer_name}\nContract price: $${c.contract_price.toLocaleString()}\nAssignment fee: $${c.assignment_fee.toLocaleString()}\nTotal Marketplace Cost: $${total.toLocaleString()}\nMAO: $${mao.toLocaleString()}\nEMD: $${c.emd_amount.toLocaleString()} due within 24 hours of signing\n\n${CONTRACT_CLAUSES.join('\n')}\n\nATTORNEY REVIEW REQUIRED BEFORE USE. This is a template, not legal advice.`;
}

export function canSignBC(c: DealContract): boolean {
  return c.ab_status === 'Signed';
}

export function titlePackage(c: DealContract): string {
  const parts = ['A-B Purchase Agreement', 'B-C Assignment Agreement'];
  if (c.jv_partner) parts.push(`JV Addendum — ${c.jv_partner} at ${c.jv_split_pct ?? 50}%`);
  const total = totalMarketplaceCost(c.contract_price, c.assignment_fee);
  return `Title package for ${c.property_address}\nIncludes: ${parts.join(', ')}\nDistribution: contract price $${c.contract_price.toLocaleString()} to seller, fee $${c.assignment_fee.toLocaleString()} to wholesaler, total $${total.toLocaleString()}.\nSend via email handoff to the title company. This is not an API or a filing.`;
}

export function emdCountdownText(deadlineIso: string, now: Date = new Date()): string {
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  if (Number.isNaN(ms)) return 'Set an EMD deadline to start the countdown.';
  if (ms <= 0) return 'EMD deadline passed.';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m remaining`;
}
