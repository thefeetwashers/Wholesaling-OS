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

// ---------------------------------------------------------------------------
// Capital & Lending Module — transactional funding packet templates.
// Templates only, not legal advice. Every document carries the
// attorney-review flag. Merge tags are the field names in
// FundingPacketFields; buildTransactionalNote / buildTitleEscrowLetter
// fill them from a funding_requests row + the deal it belongs to.
// No signature is ever rendered here, and no funding is ever
// confirmed by generating these documents.
// ---------------------------------------------------------------------------

export const ATTORNEY_REVIEW_BANNER =
  '⚖️ ATTORNEY REVIEW REQUIRED BEFORE USE. This is a template, not legal advice.';

export interface FundingPacketFields {
  loan_amount: number | null;
  effective_date: string;
  closing_date: string;
  property_address: string;
  borrower_entity: string;
  borrower_state: string;
  title_company: string;
  title_officer_email: string;
  // Optional, shown only when present — never invented.
  purchase_price?: number | null;
  estimated_arv?: number | null;
  referral_fee_percent?: number | null;
  // Recipient of the referral-fee notice alongside the title company.
  // Direct track: The Feet Washers, Inc. itself. ISO track: the assigned
  // lender's company, when known — otherwise left as not given.
  lender_company?: string;
}

export const FUNDING_MERGE_TAGS = [
  '{{loan_amount}}',
  '{{effective_date}}',
  '{{closing_date}}',
  '{{property_address}}',
  '{{borrower_entity}}',
  '{{borrower_state}}',
  '{{title_company}}',
  '{{title_officer_email}}',
  '{{lender_company}}',
  '{{fee_percentage}}',
  '{{fee_amount}}',
] as const;

// Referral / origination fee math for the disbursement notice.
// The agreed range is 1.5%–2.0% of the gross loan amount. When an exact
// percent was agreed, the amount is exact; otherwise the notice states
// the range and the amount as a range — never a fixed percent invented here.
export function referralFeeAmount(
  loanAmount: number | null | undefined,
  feePercent: number | null | undefined,
): string {
  if (loanAmount == null) return '[amount not given]';
  if (feePercent == null) {
    const low = (Number(loanAmount) * 1.5) / 100;
    const high = (Number(loanAmount) * 2.0) / 100;
    return `$${low.toLocaleString('en-US')}–$${high.toLocaleString('en-US')} (1.5%–2.0% range)`;
  }
  return `$${((Number(loanAmount) * Number(feePercent)) / 100).toLocaleString('en-US')}`;
}

const moneyOrBlank = (n: number | null | undefined) =>
  n == null ? '[amount not given]' : `$${Number(n).toLocaleString('en-US')}`;

// Maturity is the closing date + 3 BUSINESS days (Mon–Fri, skipping
// Sat/Sun). Not "+3 days": a Friday closing matures the following
// Wednesday, not Monday.
export function addBusinessDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '[closing date not given]';
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return d.toISOString().slice(0, 10);
}

export function buildTransactionalNote(f: FundingPacketFields): string {
  const maturity = addBusinessDays(f.closing_date, 3);
  const referralLine =
    f.referral_fee_percent != null
      ? `Referral fee: ${f.referral_fee_percent}% of the funded loan amount, shown on the HUD/ALTA settlement statement.`
      : 'Referral fee: 1.5%–2.0% of the funded loan amount, shown on the HUD/ALTA settlement statement. The exact percent within that range is agreed before closing — no fixed percent is stated here.';
  return `${ATTORNEY_REVIEW_BANNER}

COMMERCIAL TRANSACTIONAL PROMISSORY NOTE
(1–3 Day Double-Close Financing)

Principal Amount: ${moneyOrBlank(f.loan_amount)}  (merge tag: {{loan_amount}})
Effective Date: ${f.effective_date || '[date not given]'}  (merge tag: {{effective_date}})
Maturity Date: ${maturity} — the closing date plus 3 business days  (merge tag: {{closing_date}} + 3 business days)
Property Address: ${f.property_address || '[address not given]'}  (merge tag: {{property_address}})

Borrower (entity): ${f.borrower_entity || '[entity not given]'}, ${f.borrower_state || '[state not given]'}  (merge tags: {{borrower_entity}}, {{borrower_state}})
Lender: The Feet Washers, Inc., 4848 NW 24th Court, Unit 428, Lauderdale Lakes, FL 33313

1. Commercial / business-purpose warranty. Borrower warrants that it is an active business entity
(LLC/Corporation), that the loan is strictly for a commercial, non-owner-occupied investment real
estate purpose, and that no part of the proceeds will be used for personal, family, or household
purposes. This is not a consumer loan.
2. Repayment. Principal plus the agreed return is repaid directly from the B-to-C closing proceeds
at ${f.title_company || '[title company not given]'}  (merge tag: {{title_company}}), on the B-to-C
closing date, and in no event later than the Maturity Date above.
3. Rate cap — Florida Statutes Chapter 687. The return charged under this Note shall not exceed
the maximum rate permitted under Florida Statutes Chapter 687 (usury). If any provision of this
Note would charge more than that cap allows, the charge is reduced to the cap by operation of
this paragraph, and no excess is due.
4. ${referralLine}
5. Default. Failure to repay in full by the Maturity Date, any false statement in the
business-purpose warranty in section 1, or any failure of the B-to-C closing to fund is an event
of default. On default, the Lender may demand immediate repayment in full and pursue all remedies
available at law or in equity, including recovery of collection costs and reasonable attorney's
fees to the extent permitted by Florida law.
6. Governing law. This Note is governed by the laws of the State of Florida, and venue for any
dispute lies in Broward County, FL.

Borrower: ______________________________  Date: __________
Lender (The Feet Washers, Inc.): ______________________________  Date: __________

${ATTORNEY_REVIEW_BANNER}`;
}

export function buildTitleEscrowLetter(f: FundingPacketFields): string {
  return `${ATTORNEY_REVIEW_BANNER}

TITLE COMPANY CONDITIONAL ESCROW & WIRE INSTRUCTION LETTER

To: ${f.title_company || '[title company not given]'}  (merge tag: {{title_company}})
Title Officer: ${f.title_officer_email || '[title officer email not given]'}  (merge tag: {{title_officer_email}})
From: The Feet Washers, Inc. (thefeetwashers@gmail.com | 772-971-6129)
Re: Conditional wire release — double-close financing
Property: ${f.property_address || '[address not given]'}  (merge tag: {{property_address}})
Borrower entity: ${f.borrower_entity || '[entity not given]'}, ${f.borrower_state || '[state not given]'}  (merge tags: {{borrower_entity}}, {{borrower_state}})
Loan amount: ${moneyOrBlank(f.loan_amount)}  (merge tag: {{loan_amount}})
Target closing date: ${f.closing_date || '[date not given]'}  (merge tag: {{closing_date}})

The Feet Washers, Inc. will wire the loan amount above only on ALL of the following conditions:

(a) Both the A-to-B file and the B-to-C file are held at the same title company named above.
(b) 100% of the B-to-C end-buyer's cash-to-close funds are already verified in escrow, with
    the executed B-to-C closing documents in hand.
(c) Disbursement is simultaneous / same-day back-to-back: the A-to-B and B-to-C closings fund
    on the same day, with the back-to-back disbursement held until both are ready to fund.
(d) Payoff is by direct wire of principal plus the agreed return, shown on the B-to-C
    HUD/ALTA settlement statement. The referral fee of 1.5%–2.0% (range, exact percent agreed
    before closing) also appears on the HUD/ALTA settlement statement.
(e) If both closings do not fund, the full wired amount is returned immediately by wire, in
    full, by 5:00 PM EST on the target closing date.

If any condition above is not met, do not release the wire. Contact The Feet Washers, Inc.
at thefeetwashers@gmail.com or 772-971-6129 before taking any other step.

The Feet Washers, Inc.

${ATTORNEY_REVIEW_BANNER}`;
}

export function buildReferralFeeNotice(f: FundingPacketFields): string {
  const feePercentText =
    f.referral_fee_percent != null
      ? `${f.referral_fee_percent}%`
      : '1.5%–2.0% (exact percent agreed before closing)';
  const feeAmount = referralFeeAmount(f.loan_amount, f.referral_fee_percent);
  return `${ATTORNEY_REVIEW_BANNER}

COMMISSION / REFERRAL FEE DISBURSEMENT NOTICE & WIRE AUTHORIZATION

DATE: ${f.effective_date || '[date not given]'}  (merge tag: {{effective_date}})
TO: ${f.title_company || '[title company not given]'} (${f.title_officer_email || '[title officer email not given]'}) & ${f.lender_company || '[lender company not given]'}  (merge tags: {{title_company}}, {{title_officer_email}}, {{lender_company}})
FROM: THE FEET WASHERS, INC. — Operator of WholesalingOS (https://wholesalingos.thefeetwashers.com/)
RE: Commercial Loan Referral / Origination Fee Disbursement on Settlement Statement
BORROWER ENTITY: ${f.borrower_entity || '[entity not given]'}  (merge tag: {{borrower_entity}})
SUBJECT PROPERTY: ${f.property_address || '[address not given]'}  (merge tag: {{property_address}})
GROSS LOAN AMOUNT: ${moneyOrBlank(f.loan_amount)}  (merge tag: {{loan_amount}})
TARGET CLOSING DATE: ${f.closing_date || '[date not given]'}  (merge tag: {{closing_date}})

Dear Closing Officer / Account Executive:

Please accept this formal notice and disbursement instruction regarding the commercial loan closing referenced above.

Pursuant to our executed Wholesale Lender & Commercial Referral Partner Agreement, THE FEET WASHERS, INC. (https://wholesalingos.thefeetwashers.com/) is entitled to a Commercial Loan Referral / Origination Fee in the amount of:

• Referral / Origination Fee: ${feePercentText} of Gross Loan Amount = ${feeAmount}  (merge tags: {{fee_percentage}}, {{fee_amount}})

Settlement & Disbursement Instructions:
1. Place on HUD-1 / ALTA Settlement Statement: Please list ${feeAmount} payable to THE FEET WASHERS, INC. as a "Commercial Loan Referral / Origination Fee" on the final settlement statement.
2. Disbursement Upon Funding: Immediately upon loan closing and funding, please wire or ACH the fee directly to THE FEET WASHERS, INC. using the corporate banking coordinates provided on our attached Corporate Wire Sheet & IRS Form W-9. (For security, bank account numbers are transmitted exclusively via signed PDF attachment and never stored inside platform software.)

Payee Contact & Verification:
• Payee Legal Name: THE FEET WASHERS, INC.
• Platform URL: https://wholesalingos.thefeetwashers.com/
• Authorized Officer: Erna Julien
• Phone: (772) 971-6129
• Email: thefeetwashers@gmail.com
• Corporate Address: 4848 NW 24th Court, Unit 428, Lauderdale Lakes, FL 33313

Please send a draft copy of the ALTA Settlement Statement to thefeetwashers@gmail.com at least 24 hours prior to closing to confirm this line item.

AUTHORIZED BY:
THE FEET WASHERS, INC.
By: ________________________________
Name: Erna Julien, Authorized Officer
Date: ${f.effective_date || '[date not given]'}

No bank account number is printed in this notice. Bank coordinates travel only on the signed Corporate Wire Sheet & IRS Form W-9 attachment, never inside the platform.

${ATTORNEY_REVIEW_BANNER}`;
}

export function emdCountdownText(deadlineIso: string, now: Date = new Date()): string {
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  if (Number.isNaN(ms)) return 'Set an EMD deadline to start the countdown.';
  if (ms <= 0) return 'EMD deadline passed.';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m remaining`;
}
