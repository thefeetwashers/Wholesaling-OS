'use client';

import { useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import {
  routingFor,
  routingLabel,
  submitFundingRequest,
  countMatchedLenders,
  US_STATES,
  type FundingType,
} from '../lib/funding';

// Opt-in commercial funding request. Commercial only, business
// entities only, no upfront fees. Submission is hard-blocked until
// the borrowing entity is named AND both attestations are checked —
// the database also refuses a row without them, so the block is
// enforced in two places, not just in this form. Routing is
// automatic and shown on the form: transactional goes direct to the
// operator; fix-and-flip, DSCR, and bridge go to the ISO network of
// verified partner lenders. The packet contains only the fields
// below — no leads, no seller contacts, no assignment fees.

export interface FundingPrefill {
  financingType: FundingType;
  dealId?: string;
  propertyAddress?: string;
  propertyState?: string;
  purchasePrice?: number;
  monthlyRent?: number;
  titleCompanyName?: string;
}

const input = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 14, width: '100%' } as const;

export default function RequestFundingModal({
  userId,
  prefill,
  onClose,
  onSubmitted,
}: {
  userId: string;
  prefill: FundingPrefill;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [financingType, setFinancingType] = useState<FundingType>(prefill.financingType);
  const [borrowingEntity, setBorrowingEntity] = useState('');
  const [entityState, setEntityState] = useState(prefill.propertyState || 'FL');
  const [propertyAddress, setPropertyAddress] = useState(prefill.propertyAddress || '');
  const [propertyState, setPropertyState] = useState(prefill.propertyState || 'FL');
  const [purchasePrice, setPurchasePrice] = useState(prefill.purchasePrice ? String(prefill.purchasePrice) : '');
  const [loanAmount, setLoanAmount] = useState('');
  const [estimatedArv, setEstimatedArv] = useState('');
  const [rehabBudget, setRehabBudget] = useState('');
  const [monthlyRent, setMonthlyRent] = useState(prefill.monthlyRent ? String(prefill.monthlyRent) : '');
  const [targetClosing, setTargetClosing] = useState('');
  const [titleCompany, setTitleCompany] = useState(prefill.titleCompanyName || '');
  const [titleOfficerEmail, setTitleOfficerEmail] = useState('');
  const [certified, setCertified] = useState(false);
  const [noFeeAck, setNoFeeAck] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const track = routingFor(financingType);
  const canSubmit =
    borrowingEntity.trim().length > 0 && certified && noFeeAck && !busy;
  const numOrNull = (v: string) => {
    const n = parseFloat(v.replace(/[$,]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const submit = async () => {
    if (!canSubmit) {
      setMessage(
        'This request cannot be sent yet: enter the borrowing entity name (LLC/Corp) and check both boxes below.'
      );
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await submitFundingRequest(userId, {
        financing_type: financingType,
        deal_id: prefill.dealId || null,
        borrowing_entity_name: borrowingEntity,
        entity_state: entityState,
        property_address: propertyAddress.trim() || null,
        property_state: propertyState,
        purchase_price: numOrNull(purchasePrice),
        loan_amount_requested: numOrNull(loanAmount),
        estimated_arv: numOrNull(estimatedArv),
        rehab_budget: numOrNull(rehabBudget),
        monthly_rent: numOrNull(monthlyRent),
        target_closing_date: targetClosing || null,
        title_company_name: titleCompany.trim() || null,
        title_officer_email: titleOfficerEmail.trim() || null,
      });
      setMessage(
        `Request submitted — routed ${track === 'direct_feet_washers' ? 'direct to The Feet Washers, Inc.' : 'to verified partner lenders in the ISO network'}. Status: submitted.`
      );
      // Slice 120, item 4: right after an ISO submission, tell the
      // requester how many verified lenders cover this state and
      // program — a count only, never names or contacts. Counted
      // from the real lender boxes; a failed count is simply omitted.
      if (track !== 'direct_feet_washers') {
        countMatchedLenders(propertyState, financingType)
          .then((n) => {
            setMessage(
              `Request submitted — routed to verified partner lenders in the ISO network. Status: submitted. ${n} verified lender(s) cover this state and program.`
            );
          })
          .catch(() => {});
      }
      onSubmitted?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Submission failed — nothing was sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ background: '#0f172a', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 12, padding: 16, marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Request commercial funding — opt-in</h3>
      <p style={{ fontSize: 13, color: '#cbd5e1' }}>
        Routing: <strong>{routingLabel(track)}</strong>
        {financingType === 'transactional'
          ? ' — transactional funding is direct from The Feet Washers, Inc.'
          : ' — fix-and-flip, bridge, and DSCR requests go only to verified partner lenders whose lending box covers your state and program.'}
        {' '}Only the packet below is shared. Your leads, seller contacts, and assignment fees are never in it.
      </p>
      {!supabaseConfigured && (
        <p style={{ fontSize: 13, color: '#fbbf24' }}>
          Supabase is not configured on this deployment, so this request cannot be submitted yet. Nothing here is faked — set up Supabase and run the Capital &amp; Lending migration first.
        </p>
      )}
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label style={{ fontSize: 13 }}>
          Financing type{' '}
          <select style={input} value={financingType} onChange={(e) => setFinancingType(e.target.value as FundingType)}>
            <option value="transactional">Transactional (1–3 day double close)</option>
            <option value="fix_and_flip">Fix-and-Flip</option>
            <option value="dscr">DSCR (rental)</option>
            <option value="bridge">Bridge</option>
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Borrowing entity name (LLC/Corp) — required{' '}
          <input style={input} placeholder="e.g. Main Street Holdings LLC" value={borrowingEntity} onChange={(e) => setBorrowingEntity(e.target.value)} />
        </label>
        <label style={{ fontSize: 13 }}>
          Entity state{' '}
          <select style={input} value={entityState} onChange={(e) => setEntityState(e.target.value)}>
            {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Property address{' '}
          <input style={input} value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />
        </label>
        <label style={{ fontSize: 13 }}>
          Property state{' '}
          <select style={input} value={propertyState} onChange={(e) => setPropertyState(e.target.value)}>
            {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>Purchase price $ <input style={input} inputMode="numeric" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>Loan amount requested $ <input style={input} inputMode="numeric" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>Estimated ARV $ <input style={input} inputMode="numeric" value={estimatedArv} onChange={(e) => setEstimatedArv(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>Rehab budget $ <input style={input} inputMode="numeric" value={rehabBudget} onChange={(e) => setRehabBudget(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>Monthly rent $ <input style={input} inputMode="numeric" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>Target closing date <input style={input} type="date" value={targetClosing} onChange={(e) => setTargetClosing(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>Title company name <input style={input} value={titleCompany} onChange={(e) => setTitleCompany(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>Title officer email <input style={input} value={titleOfficerEmail} onChange={(e) => setTitleOfficerEmail(e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: 13 }}>
        <label>
          <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} />{' '}
          <strong>Business-Purpose Certification (required):</strong> the borrower is an active business
          entity (LLC/Corporation) and this financing is for a non-owner-occupied investment property
          only — not a personal residence, not a consumer loan.
        </label>
        <label>
          <input type="checkbox" checked={noFeeAck} onChange={(e) => setNoFeeAck(e.target.checked)} />{' '}
          <strong>No Upfront Fee &amp; Attorney-Review Acknowledgment (required):</strong> no upfront
          borrower fee is charged for this request, and I will have my own attorney review any loan
          documents before I sign them.
        </label>
      </div>
      {message && <p style={{ fontSize: 13 }}>{message}</p>}
      <div style={{ marginTop: 12 }}>
        <button onClick={submit} disabled={!canSubmit}>
          Submit funding request
        </button>{' '}
        <button onClick={onClose}>Cancel</button>
        {!canSubmit && !busy && (
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            The submit button stays off until the entity name is entered and both boxes above are checked.
          </p>
        )}
      </div>
    </section>
  );
}
