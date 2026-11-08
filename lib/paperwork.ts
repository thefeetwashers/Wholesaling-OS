import type { LetterIdentity } from './letter-identity';

// Slice 80 — money paperwork text builders. The offer letter is an
// expression of interest, deliberately NOT a contract: the contract
// engine (lib/contracts.ts) owns agreements, with its attorney-
// review gate. The letter carries the same gate line, the buyer's
// own letter identity, and only the figures the wholesaler typed.

export interface OfferInput {
  sellerName: string;
  propertyAddress: string;
  city?: string;
  state?: string;
  price: number;
  emd: number;
  closingDays: number;
  inspectionDays: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function offerLetter(o: OfferInput, id: LetterIdentity, today: Date): string {
  const where = [o.propertyAddress, [o.city, o.state].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  const dateLine = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const from = id.biz || id.you || '[your name / company]';
  const contact = [id.phone, id.email].filter(Boolean).join(' · ') || '[your phone] · [your email]';
  return [
    dateLine,
    '',
    `Dear ${o.sellerName || 'Homeowner'},`,
    '',
    `I am writing to offer to purchase your property at ${where}.`,
    '',
    `Purchase price: ${money(o.price)}`,
    `Earnest money deposit: ${money(o.emd)}, delivered to the title company on signing`,
    `Closing: within ${o.closingDays} days of a signed agreement`,
    `Inspection period: ${o.inspectionDays} days from signing`,
    '',
    'I buy in as-is condition — you make no repairs and pay no agent commissions. If we reach ' +
      'agreement, the purchase is documented in a written contract that you can have your own ' +
      'attorney review before signing. That contract may allow me to assign my interest to a ' +
      'partner or buyer; the price and terms to you do not change if it does.',
    '',
    'This letter is an expression of interest only — it is not a contract and binds neither of us. ' +
      'If the terms work for you, call me and we will put the agreement in writing.',
    '',
    'Thank you for your time,',
    from,
    contact,
    '',
    'ATTORNEY REVIEW REQUIRED BEFORE USE. This is a template, not legal advice.',
  ].join('\n');
}
