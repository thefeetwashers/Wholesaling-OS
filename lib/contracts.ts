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
  // Term sheet only (Slice 120, item 2). Interest rate and loan term
  // are NEVER invented: they arrive as "to be agreed" placeholders
  // unless the operator enters real values.
  financing_type?: string;
  interest_rate?: string | null;
  loan_term_months?: string | null;
  // True while the request has not reached term_sheet_issued: the
  // document is labelled DRAFT — terms to be agreed.
  term_sheet_draft?: boolean;
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
  '{{financing_type}}',
  '{{interest_rate}}',
  '{{loan_term_months}}',
  '{{maturity_date}}',
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

export function buildTermSheet(f: FundingPacketFields): string {
  // Maturity: transactional double closes mature at closing + 3
  // business days (the same helper the Note uses). Every other
  // program has no maturity in this template — it is agreed with
  // the lender, never assumed here.
  const maturity =
    f.financing_type === 'transactional'
      ? addBusinessDays(f.closing_date, 3)
      : '[to be agreed with the lender — the closing + 3 business days maturity applies to transactional double closes only]';
  const feePercentText =
    f.referral_fee_percent != null
      ? `${f.referral_fee_percent}%`
      : '1.5%–2.0% (exact percent agreed before closing)';
  const feeAmount = referralFeeAmount(f.loan_amount, f.referral_fee_percent);
  const draftLine = f.term_sheet_draft
    ? '\nDRAFT — TERMS TO BE AGREED. This term sheet is a draft until the request reaches term_sheet_issued. No term below is final.\n'
    : '';
  return `${ATTORNEY_REVIEW_BANNER}
${draftLine}
COMMERCIAL FUNDING TERM SHEET — DRAFT TERMS
(Template only — not a funding commitment, not a loan agreement)

Borrower (entity): ${f.borrower_entity || '[entity not given]'}, ${f.borrower_state || '[state not given]'}  (merge tags: {{borrower_entity}}, {{borrower_state}})
Property: ${f.property_address || '[address not given]'}  (merge tag: {{property_address}})
Financing type: ${f.financing_type || '[type not given]'}  (merge tag: {{financing_type}})
Loan amount requested: ${moneyOrBlank(f.loan_amount)}  (merge tag: {{loan_amount}})
Purchase price: ${moneyOrBlank(f.purchase_price)}
Estimated ARV: ${moneyOrBlank(f.estimated_arv)}
Target closing date: ${f.closing_date || '[date not given]'}  (merge tag: {{closing_date}})
Maturity: ${maturity}  (merge tag: {{maturity_date}})
Title company: ${f.title_company || '[title company not given]'}  (merge tag: {{title_company}})

1. Interest rate: ${f.interest_rate || 'TO BE AGREED — no rate is stated here'}  (merge tag: {{interest_rate}})
2. Loan term: ${f.loan_term_months || 'TO BE AGREED — no term is stated here'}  (merge tag: {{loan_term_months}})
3. Referral fee: ${feePercentText} of the funded loan amount = ${feeAmount}, shown on the HUD/ALTA settlement statement, payable to The Feet Washers, Inc.  (merge tags: {{fee_percentage}}, {{fee_amount}})
4. Commercial purpose only. This financing is strictly for a commercial, non-owner-occupied investment real estate purpose by an active business entity (LLC/Corporation). It is not a consumer loan, and no upfront borrower fee is charged.
5. Escrow conditions (summary — the full conditions are in the Title Company Conditional Escrow & Wire Instruction Letter): (a) A-to-B and B-to-C files at the same title company; (b) 100% of B-to-C cash-to-close verified in escrow with executed B-to-C documents; (c) simultaneous / same-day back-to-back disbursement; (d) direct payoff wire of principal plus the agreed return on the B-to-C HUD/ALTA; (e) immediate full wire return by 5:00 PM EST on the target closing date if both closings do not fund.
6. Rate cap — Florida Statutes Chapter 687. Any return charged under the final loan documents shall not exceed the maximum rate permitted under Florida Statutes Chapter 687 (usury).
7. This term sheet is not a commitment to fund. Funding is subject to the lender's own underwriting, the escrow conditions above, and each party's attorney review of the final loan documents before signing.

Borrower: ______________________________  Date: __________
Lender: ______________________________  Date: __________

${ATTORNEY_REVIEW_BANNER}`;
}

// ---------------------------------------------------------------------------
// Slice 122 — JV Co-Wholesaling Split Agreement + Scout Finder's Fee
// Agreement. Templates only, not legal advice. Both carry the
// attorney-review banner top and bottom. Neither document is ever
// signed in-app: signing happens between the two parties, and
// generating a document confirms nothing — no deal, no funding, no
// payout. The JV agreement is generated only after a JV match (both
// sides opted in); the property address is entered by the originator
// at generation time and is never shown in the JV Room before a
// match. The Scout agreement is generated only for a CLAIMED scout
// lead, never an unclaimed one. All URLs say
// https://wholesalingos.thefeetwashers.com — never the home-care
// site.
// ---------------------------------------------------------------------------

export interface JVSplitAgreementFields {
  effective_date: string;
  party_a_entity: string;
  party_a_state: string;
  party_a_address: string;
  party_a_email: string;
  party_a_phone: string;
  party_b_entity: string;
  party_b_state: string;
  party_b_address: string;
  party_b_email: string;
  party_b_phone: string;
  contract_date: string;
  property_address: string;
  contract_price: number | null;
  title_company: string;
  title_officer_email: string;
  closing_date: string;
  party_a_split_percent: number | null;
  party_b_split_percent: number | null;
  approved_expenses: number | null;
  property_state: string;
  party_a_signer: string;
  party_a_title: string;
  party_b_signer: string;
  party_b_title: string;
}

export const JV_SPLIT_MERGE_TAGS = [
  '{{effective_date}}',
  '{{party_a_entity}}',
  '{{party_a_state}}',
  '{{party_a_address}}',
  '{{party_a_email}}',
  '{{party_a_phone}}',
  '{{party_b_entity}}',
  '{{party_b_state}}',
  '{{party_b_address}}',
  '{{party_b_email}}',
  '{{party_b_phone}}',
  '{{contract_date}}',
  '{{property_address}}',
  '{{contract_price}}',
  '{{title_company}}',
  '{{title_officer_email}}',
  '{{closing_date}}',
  '{{party_a_split_percent}}',
  '{{party_b_split_percent}}',
  '{{approved_expenses}}',
  '{{property_state}}',
  '{{party_a_signer}}',
  '{{party_a_title}}',
  '{{party_b_signer}}',
  '{{party_b_title}}',
] as const;

export function buildJVSplitAgreement(f: JVSplitAgreementFields): string {
  const blank = (v: string | null | undefined) => (v && v.trim() ? v : '[not given]');
  const splitA = f.party_a_split_percent != null ? `${f.party_a_split_percent}%` : '[percent not given]';
  const splitB = f.party_b_split_percent != null ? `${f.party_b_split_percent}%` : '[percent not given]';
  return `${ATTORNEY_REVIEW_BANNER}

JOINT VENTURE (JV) CO-WHOLESALING SPLIT AGREEMENT

This template is software-generated for operational convenience and carries an attorney-review flag. Wholesaling and joint venture laws differ by state. Have licensed real estate counsel in your state review and approve this agreement before signing or submitting to title.

Effective date: ${f.effective_date || '[date not given]'}  (merge tag: {{effective_date}})

PARTIES
Party A (Originating Wholesaler — holds the Underlying Contract):
  Entity: ${blank(f.party_a_entity)}  (merge tag: {{party_a_entity}})
  State of organization: ${blank(f.party_a_state)}  (merge tag: {{party_a_state}})
  Address: ${blank(f.party_a_address)}  (merge tag: {{party_a_address}})
  Email: ${blank(f.party_a_email)}  (merge tag: {{party_a_email}})
  Phone: ${blank(f.party_a_phone)}  (merge tag: {{party_a_phone}})

Party B (JV Partner — disposition / dispo):
  Entity: ${blank(f.party_b_entity)}  (merge tag: {{party_b_entity}})
  State of organization: ${blank(f.party_b_state)}  (merge tag: {{party_b_state}})
  Address: ${blank(f.party_b_address)}  (merge tag: {{party_b_address}})
  Email: ${blank(f.party_b_email)}  (merge tag: {{party_b_email}})
  Phone: ${blank(f.party_b_phone)}  (merge tag: {{party_b_phone}})

SECTION 1 — SUBJECT PROPERTY & UNDERLYING PURCHASE CONTRACT
1.1 Subject Property: ${blank(f.property_address)}  (merge tag: {{property_address}})
1.2 Underlying Contract: the purchase contract dated ${f.contract_date || '[date not given]'}  (merge tag: {{contract_date}}), under which Party A holds equitable interest in the Subject Property, at a contract price of ${moneyOrBlank(f.contract_price)}  (merge tag: {{contract_price}}).
1.3 Title company: ${blank(f.title_company)}  (merge tag: {{title_company}}); title officer email: ${blank(f.title_officer_email)}  (merge tag: {{title_officer_email}}).
1.4 Target closing date: ${f.closing_date || '[date not given]'}  (merge tag: {{closing_date}}).
1.5 The property address in this agreement is shared only between the two parties to it. It was not shown in the JV Deal Room before the match.

SECTION 2 — DIVISION OF RESPONSIBILITIES
2.1 Party A shall: (a) maintain the Underlying Contract in good standing and comply with its terms; (b) coordinate seller communications, property access, and any addenda; (c) provide Party B with the executed Underlying Contract and confirmation that a clear title order has been placed.
2.2 Party B shall: (a) market the equitable contract rights ONLY — never advertising ownership of the physical property — to vetted cash buyers, in strict compliance with the wholesaling and advertising laws of the state where the Subject Property sits; (b) secure a qualified End-Buyer; (c) collect the End-Buyer's non-refundable earnest money deposit into escrow with ${blank(f.title_company)}; (d) deliver a signed Assignment of Contract or B-to-C Purchase Agreement for closing.
2.3 Neither party shall advertise, list, or represent the Subject Property as property it owns.

SECTION 3 — NET PROFIT SPLIT & CLOSING TABLE DISBURSEMENT
3.1 Net JV Profit means the gross assignment fee or double-close spread actually received at closing, minus documented, mutually approved third-party transaction costs — such as transactional funding fees, double-close title and recording costs, or approved scout referral payouts — totaling ${moneyOrBlank(f.approved_expenses)}  (merge tag: {{approved_expenses}}).
3.2 The Net JV Profit is split as follows: Party A ${splitA}  (merge tag: {{party_a_split_percent}}), Party B ${splitB}  (merge tag: {{party_b_split_percent}}). The two shares total 100%.
3.3 The title company shall disburse each party's share as a separate line item on the HUD-1 / ALTA settlement statement, wired directly to each party. No party collects the other's share.
3.4 Platform Fee Disclaimer: In accordance with WholesalingOS (https://wholesalingos.thefeetwashers.com) terms, 0% of the Net JV Profit is payable to the software platform. The platform takes no cut of any JV split, assignment fee, or closing.

SECTION 4 — NON-CIRCUMVENTION & CONFIDENTIALITY ("SEALED OFFICE" PROTECTION)
4.1 For 24 months from the Effective Date, Party B shall not contact, negotiate with, or bypass to the Seller (or the Seller's heirs, successors, or assigns) regarding the Subject Property, and Party A shall not bypass Party B to market to an End-Buyer introduced by Party B.
4.2 Each party shall keep the other's business information, buyer lists, and the terms of this agreement confidential, and shall not disclose them except to its own attorney, title company, or as required by law.
4.3 Liquidated damages for a breach of this Section 4: the full profit share the non-breaching party would have earned under Section 3, plus reasonable attorneys' fees and collection costs. The parties agree this is a genuine pre-estimate of the loss, not a penalty.

SECTION 5 — INDEPENDENT CONTRACTORS & GOVERNING LAW
5.1 This agreement is solely for the Subject Property. It creates no general partnership, agency, employment, or joint liability between the parties beyond this one transaction.
5.2 Each party is responsible for its own taxes, including any Form 1099 reporting on amounts it receives.
5.3 This agreement is governed by the laws of ${blank(f.property_state)}  (merge tag: {{property_state}}). Any dispute is resolved under the laws of that state.

SIGNATURES
Party A:
  Signed: ______________________________  Date: __________
  Name: ${blank(f.party_a_signer)}  (merge tag: {{party_a_signer}})
  Title: ${blank(f.party_a_title)}  (merge tag: {{party_a_title}})

Party B:
  Signed: ______________________________  Date: __________
  Name: ${blank(f.party_b_signer)}  (merge tag: {{party_b_signer}})
  Title: ${blank(f.party_b_title)}  (merge tag: {{party_b_title}})

${ATTORNEY_REVIEW_BANNER}`;
}

export interface ScoutFinderFeeFields {
  effective_date: string;
  wholesaler_entity: string;
  wholesaler_state: string;
  wholesaler_address: string;
  wholesaler_email: string;
  wholesaler_phone: string;
  scout_name: string;
  scout_address: string;
  scout_email: string;
  scout_phone: string;
  property_address: string;
  submission_date: string;
  title_company: string;
  title_officer_email: string;
  payout_amount: number | null;
  property_state: string;
  wholesaler_signer: string;
}

export const SCOUT_FINDER_MERGE_TAGS = [
  '{{effective_date}}',
  '{{wholesaler_entity}}',
  '{{wholesaler_state}}',
  '{{wholesaler_address}}',
  '{{wholesaler_email}}',
  '{{wholesaler_phone}}',
  '{{scout_name}}',
  '{{scout_address}}',
  '{{scout_email}}',
  '{{scout_phone}}',
  '{{property_address}}',
  '{{submission_date}}',
  '{{title_company}}',
  '{{title_officer_email}}',
  '{{payout_amount}}',
  '{{property_state}}',
  '{{wholesaler_signer}}',
] as const;

export function buildScoutFinderFeeAgreement(f: ScoutFinderFeeFields): string {
  const blank = (v: string | null | undefined) => (v && v.trim() ? v : '[not given]');
  const payout =
    f.payout_amount != null
      ? `$${Number(f.payout_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '$1,000.00';
  return `${ATTORNEY_REVIEW_BANNER}

PROPERTY SCOUT / REFERRER FINDER'S FEE AGREEMENT

This template is provided for operational convenience and carries an attorney-review flag. Real estate licensing and finder's fee laws vary strictly by state (including Florida Statutes Chapter 475). Have a licensed real estate attorney in your state review and approve this agreement before executing or submitting to a title company.

Effective date: ${f.effective_date || '[date not given]'}  (merge tag: {{effective_date}})

PARTIES
Principal (acquiring wholesaler):
  Entity: ${blank(f.wholesaler_entity)}  (merge tag: {{wholesaler_entity}})
  State: ${blank(f.wholesaler_state)}  (merge tag: {{wholesaler_state}})
  Address: ${blank(f.wholesaler_address)}  (merge tag: {{wholesaler_address}})
  Email: ${blank(f.wholesaler_email)}  (merge tag: {{wholesaler_email}})
  Phone: ${blank(f.wholesaler_phone)}  (merge tag: {{wholesaler_phone}})

Scout (referrer):
  Name: ${blank(f.scout_name)}  (merge tag: {{scout_name}})
  Address: ${blank(f.scout_address)}  (merge tag: {{scout_address}})
  Email: ${blank(f.scout_email)}  (merge tag: {{scout_email}})
  Phone: ${blank(f.scout_phone)}  (merge tag: {{scout_phone}})

SECTION 1 — SUBMITTED PROPERTY INFORMATION
1.1 Property: ${blank(f.property_address)}  (merge tag: {{property_address}})
1.2 Submission date / timestamp: ${f.submission_date || '[date not given]'}  (merge tag: {{submission_date}})
1.3 Title company: ${blank(f.title_company)}  (merge tag: {{title_company}}); title officer email: ${blank(f.title_officer_email)}  (merge tag: {{title_officer_email}})

SECTION 2 — STRICT SCOPE OF SCOUT'S ROLE
2.1 The Scout's role is information only: providing the street address and publicly visible condition notes and photos of the property.
2.2 The Scout is PROHIBITED from: contacting or soliciting the property owner; negotiating with the owner; quoting prices; drafting or presenting contracts; showing or marketing the property; or performing any other act that requires a real estate broker or sales associate license.
2.3 The Principal handles 100% of owner outreach, valuation, negotiation, and contracting. The Scout has no authority to speak for, bind, or represent the Principal in any way.

SECTION 3 — CONTINGENT $1,000 FINDER'S FEE & CLOSING TABLE PAYOUT
3.1 Flat fee: ${payout}  (merge tag: {{payout_amount}}), payable ONLY if this submitted lead — an unclaimed, actionable lead at submission — results in a closed acquisition or assignment by the Principal within 180 days of the submission date.
3.2 The fee is 100% contingent on closing and funding. If the transaction fails to close for any reason, $0 is owed.
3.3 Payment is made by direct title disbursement as a HUD-1 / ALTA settlement statement line item at the closing table, upon receipt of the Scout's completed IRS Form W-9.
3.4 Prior-knowledge exclusion: no fee is owed if the Principal already held this property in its active pipeline before the submission, as verified by timestamped database records. The submission timestamp in Section 1.2 is the record that decides it.

SECTION 4 — INDEPENDENT CONTRACTOR & TAX RESPONSIBILITY
4.1 The Scout is an independent contractor, not an employee, partner, or agent of the Principal or of THE FEET WASHERS, INC.
4.2 The Scout is responsible for their own taxes on any fee received. The Principal will issue IRS Form 1099-NEC for $600 or more paid to the Scout in a calendar year, as required by law.

SECTION 5 — GOVERNING LAW
5.1 This agreement is governed by the laws of ${blank(f.property_state)}  (merge tag: {{property_state}}).

SIGNATURES
Principal (Wholesaler):
  Signed: ______________________________  Date: __________
  Name: ${blank(f.wholesaler_signer)}  (merge tag: {{wholesaler_signer}})

Scout:
  Signed: ______________________________  Date: __________
  Name: ${blank(f.scout_name)}  (merge tag: {{scout_name}})

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

// ---------------------------------------------------------------------------
// Slice 128 — Wholesale Contract Generator: A-to-B purchase agreement
// + B-to-C assignment. Templates only, not legal advice. Every
// document carries the attorney-review banner top AND bottom.
// Merge tags are the field names in WholesaleContractFields.
// Money fields are EMPTY by default in the form — no invented
// prices, earnest money, or fees are ever baked in. The assignment
// EMD amount, refundability, and deadline are editable form fields,
// never a hardcoded "$5,000 non-refundable within 24 hours". The
// MAO, when shown, is a reference ceiling only — never the price.
// The B-to-C assignment is effective only once the A-to-B purchase
// agreement is signed (canSignBC / ab_status in this same file).
// Print / .txt export happens in the generator component; nothing
// here files, sends, or signs anything.
// ---------------------------------------------------------------------------

export interface WholesaleContractFields {
  // Wholesaler (Buyer under the A-to-B, Assignor under the B-to-C).
  buyer_name: string;
  buyer_entity: string;
  buyer_address: string;
  buyer_email: string;
  buyer_phone: string;
  // Seller under the A-to-B.
  seller_name: string;
  seller_address: string;
  // Property.
  property_address: string;
  city: string;
  county: string;
  state: string;
  parcel_id: string;
  // A-to-B money + terms. All empty by default in the form.
  purchase_price: number | null;
  earnest_money: number | null;
  earnest_money_refundable: boolean;
  earnest_money_deadline: string;
  inspection_days: number | null;
  closing_date: string;
  title_company: string;
  // B-to-C money + terms. All empty by default in the form.
  end_buyer_name: string;
  end_buyer_entity: string;
  assignment_fee: number | null;
  assignment_emd_amount: number | null;
  assignment_emd_refundable: boolean;
  assignment_emd_deadline: string;
  // Probate authority (kept from the platform's probate strategy).
  is_probate: boolean;
  probate_case_number: string;
  // MAO reference only — a ceiling, never the price.
  mao_reference: number | null;
}

export const PURCHASE_AGREEMENT_MERGE_TAGS = [
  '{{buyer_name}}', '{{buyer_entity}}', '{{buyer_address}}', '{{buyer_email}}', '{{buyer_phone}}',
  '{{seller_name}}', '{{seller_address}}',
  '{{property_address}}', '{{city}}', '{{county}}', '{{state}}', '{{parcel_id}}',
  '{{purchase_price}}', '{{earnest_money}}', '{{earnest_money_refundable}}', '{{earnest_money_deadline}}',
  '{{inspection_days}}', '{{closing_date}}', '{{title_company}}',
  '{{is_probate}}', '{{probate_case_number}}',
] as const;

export const ASSIGNMENT_CONTRACT_MERGE_TAGS = [
  '{{buyer_name}}', '{{buyer_entity}}', '{{end_buyer_name}}', '{{end_buyer_entity}}',
  '{{property_address}}', '{{city}}', '{{county}}', '{{state}}', '{{parcel_id}}',
  '{{purchase_price}}', '{{assignment_fee}}',
  '{{assignment_emd_amount}}', '{{assignment_emd_refundable}}', '{{assignment_emd_deadline}}',
  '{{closing_date}}', '{{title_company}}', '{{mao_reference}}',
] as const;

const contractBlank = (v: string | null | undefined) => (v && v.trim() ? v : '[not given]');

function probateAuthorityClause(f: WholesaleContractFields): string {
  if (!f.is_probate) return '';
  const caseLine = f.probate_case_number.trim()
    ? ` Probate case: ${f.probate_case_number.trim()}.`
    : '';
  return `\nPROBATE AUTHORITY — This sale is contingent on the Seller having authority to sell: Letters Testamentary, Letters of Administration, or a Summary Administration order, as the court requires.${caseLine} Where the court must approve the sale, closing waits for that approval — the Buyer never asks the Seller to skip a step the court requires. If the court does not approve the sale, this agreement ends and any earnest money is returned as the court directs.`;
}

export function buildPurchaseAgreement(f: WholesaleContractFields): string {
  const emdLine = f.earnest_money != null
    ? `Earnest money: ${moneyOrBlank(f.earnest_money)}, ${f.earnest_money_refundable ? 'refundable' : 'non-refundable'} as stated here, due ${contractBlank(f.earnest_money_deadline)}.`
    : 'Earnest money: [amount not given] — enter the agreed amount, whether it is refundable, and the deadline before printing.';
  const inspectionLine = f.inspection_days != null
    ? `Inspection period: ${f.inspection_days} day(s) from acceptance. Buyer may inspect and cancel within that period.`
    : 'Inspection period: [not given] — enter the agreed number of days before printing.';
  return `${ATTORNEY_REVIEW_BANNER}

RESIDENTIAL PURCHASE AGREEMENT (A-to-B — Wholesaler buys from Seller)

This template is software-generated for operational convenience and carries an attorney-review flag. Real estate contracts differ by state. Have licensed real estate counsel in your state review and approve this agreement before signing or submitting to title.

BUYER (Wholesaler):
  Name: ${contractBlank(f.buyer_name)}  (merge tag: {{buyer_name}})
  Entity: ${contractBlank(f.buyer_entity)}  (merge tag: {{buyer_entity}})
  Address: ${contractBlank(f.buyer_address)}  (merge tag: {{buyer_address}})
  Email: ${contractBlank(f.buyer_email)}  (merge tag: {{buyer_email}})
  Phone: ${contractBlank(f.buyer_phone)}  (merge tag: {{buyer_phone}})

SELLER:
  Name: ${contractBlank(f.seller_name)}  (merge tag: {{seller_name}})
  Address: ${contractBlank(f.seller_address)}  (merge tag: {{seller_address}})

PROPERTY:
  Address: ${contractBlank(f.property_address)}  (merge tag: {{property_address}})
  City: ${contractBlank(f.city)}  (merge tag: {{city}}), County: ${contractBlank(f.county)}  (merge tag: {{county}}), State: ${contractBlank(f.state)}  (merge tag: {{state}})
  Parcel / APN: ${contractBlank(f.parcel_id)}  (merge tag: {{parcel_id}})

1. PURCHASE PRICE: ${moneyOrBlank(f.purchase_price)}  (merge tag: {{purchase_price}}). The Seller sees this price only — no assignment fee, buyer, or margin appears in this agreement.
2. ${emdLine}  (merge tags: {{earnest_money}}, {{earnest_money_refundable}}, {{earnest_money_deadline}})
3. ${inspectionLine}  (merge tag: {{inspection_days}})
4. CLOSING: on or before ${f.closing_date || '[date not given]'}  (merge tag: {{closing_date}}), at ${contractBlank(f.title_company)}  (merge tag: {{title_company}}). The Seller picks the closing date; the date above is the agreed target.
5. AS-IS: the property is sold as-is. No repairs, no cleanout, no agent commissions are promised by either side unless written here.
6. RIGHT TO ASSIGN: Buyer may assign this contract, in whole or in part, to a third party. The Buyer holds an equitable interest in the property and may market that interest, not the property itself.
7. TITLE: Seller shall deliver marketable title, subject only to matters of record and any court approval required below.${probateAuthorityClause(f)}
8. This agreement is the whole agreement for this property. Changes must be written and signed by both sides.

SIGNATURES
Buyer:
  Signed: ______________________________  Date: __________
  Name: ${contractBlank(f.buyer_name)}
Seller:
  Signed: ______________________________  Date: __________
  Name: ${contractBlank(f.seller_name)}

${ATTORNEY_REVIEW_BANNER}`;
}

export function buildAssignmentContract(f: WholesaleContractFields): string {
  const total =
    f.purchase_price != null && f.assignment_fee != null
      ? `$${(f.purchase_price + f.assignment_fee).toLocaleString('en-US')}`
      : '[total not given — enter both the purchase price and the assignment fee]';
  const emdLine = f.assignment_emd_amount != null
    ? `Earnest money deposit: ${moneyOrBlank(f.assignment_emd_amount)}, ${f.assignment_emd_refundable ? 'refundable' : 'non-refundable'} as stated here, due ${contractBlank(f.assignment_emd_deadline)}.`
    : 'Earnest money deposit: [amount not given] — enter the agreed amount, whether it is refundable, and the deadline before printing.';
  const maoLine = f.mao_reference != null
    ? `MAO reference: $${Number(f.mao_reference).toLocaleString('en-US')} (merge tag: {{mao_reference}}). This is a ceiling from the wholesaler's own numbers — it is NOT the purchase price and is shown here for reference only.`
    : '';
  return `${ATTORNEY_REVIEW_BANNER}

ASSIGNMENT OF CONTRACT (B-to-C — Wholesaler assigns to End Buyer)

This template is software-generated for operational convenience and carries an attorney-review flag. Real estate contracts differ by state. Have licensed real estate counsel in your state review and approve this assignment before signing or submitting to title.

EFFECTIVE ONLY WHEN SIGNED: this assignment takes effect only once the underlying A-to-B purchase agreement for the same property is signed. It assigns the Assignor's equitable interest in that contract — not the property itself.

ASSIGNOR (Wholesaler — Buyer under the A-to-B):
  Name: ${contractBlank(f.buyer_name)}  (merge tag: {{buyer_name}})
  Entity: ${contractBlank(f.buyer_entity)}  (merge tag: {{buyer_entity}})

ASSIGNEE (End Buyer):
  Name: ${contractBlank(f.end_buyer_name)}  (merge tag: {{end_buyer_name}})
  Entity: ${contractBlank(f.end_buyer_entity)}  (merge tag: {{end_buyer_entity}})

PROPERTY (same property as the A-to-B):
  Address: ${contractBlank(f.property_address)}  (merge tag: {{property_address}})
  City: ${contractBlank(f.city)}  (merge tag: {{city}}), County: ${contractBlank(f.county)}  (merge tag: {{county}}), State: ${contractBlank(f.state)}  (merge tag: {{state}})
  Parcel / APN: ${contractBlank(f.parcel_id)}  (merge tag: {{parcel_id}})

1. UNDERLYING CONTRACT: the A-to-B purchase agreement for this property, at a contract price of ${moneyOrBlank(f.purchase_price)}  (merge tag: {{purchase_price}}), closing on or before ${f.closing_date || '[date not given]'}  (merge tag: {{closing_date}}) at ${contractBlank(f.title_company)}  (merge tag: {{title_company}}).
2. ASSIGNMENT FEE: ${moneyOrBlank(f.assignment_fee)}  (merge tag: {{assignment_fee}}), payable to the Assignor at closing and shown on the settlement statement.
3. TOTAL TO ASSIGNEE AT CLOSING: ${total} (contract price + assignment fee).
4. ${emdLine}  (merge tags: {{assignment_emd_amount}}, {{assignment_emd_refundable}}, {{assignment_emd_deadline}})
5. ASSIGNEE'S DUTIES: the Assignee steps into the Assignor's position under the A-to-B contract and closes on its terms, including any court approval the estate still needs.
6. NO REPRESENTATION OF OWNERSHIP: the Assignor does not own the property. This assignment transfers only the Assignor's rights under the A-to-B contract.
${maoLine ? `7. ${maoLine}\n\n` : ''}SIGNATURES
Assignor:
  Signed: ______________________________  Date: __________
  Name: ${contractBlank(f.buyer_name)}
Assignee:
  Signed: ______________________________  Date: __________
  Name: ${contractBlank(f.end_buyer_name)}

${ATTORNEY_REVIEW_BANNER}`;
}
