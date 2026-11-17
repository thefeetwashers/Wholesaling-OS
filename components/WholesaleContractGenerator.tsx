// Slice 128 — WholesaleContractGenerator: A-to-B purchase agreement
// + B-to-C assignment, form + live preview + print / .txt export.
//
// The repo had a contract engine (lib/contracts.ts) but no A-to-B
// purchase agreement or B-to-C assignment template — this is new.
// The documents are built by buildPurchaseAgreement /
// buildAssignmentContract in lib/contracts.ts (merge-tag functions
// with the attorney-review banner top AND bottom).
//
// Rules:
//   * Wholesaler name/company/phone/email come from the SIGNED-IN
//     wholesaler's own storefront profile (loadMyStorefront) —
//     never hardcoded defaults. No profile means blank fields +
//     a note, never the operator's details.
//   * MONEY FIELDS ARE EMPTY BY DEFAULT — no invented purchase
//     price, earnest money, or assignment fee. The form will not
//     print until the price (and, for the assignment, the fee) is
//     entered, and says so plainly.
//   * The assignment EMD amount, refundability, and deadline are
//     editable form fields, empty by default — never a hardcoded
//     "$5,000 non-refundable within 24 hours".
//   * MAO is shown as a reference line only — a ceiling, never the
//     price. It is computed from ARV / repairs / fee the wholesaler
//     enters, or carried from a prefill when one is available.
//   * The probate authority clause (contingent on Letters / Summary
//     Administration) is kept when the deal is a probate deal.
//   * This is a template, not legal advice, and it is NOT claimed
//     to be "1-page" — a full purchase agreement prints multi-page.
//     The print dialog is the export; nothing here files, sends,
//     or signs anything.

import { useEffect, useMemo, useState } from 'react';
import {
  buildPurchaseAgreement,
  buildAssignmentContract,
  ATTORNEY_REVIEW_BANNER,
  type WholesaleContractFields,
} from '../lib/contracts';
import { calculateMAO } from '../lib/mao';
import { loadMyStorefront, type StorefrontProfile } from '../lib/storefront';

// Prefill from a dashboard row. Money comes ONLY from the
// wholesaler's own entered numbers: purchasePrice from
// lead.offer_amount when set (never from MAO — MAO is a ceiling,
// not the price), assignmentFee from the wholesaler's entered
// value only. Everything else is blank unless the row carries it.
export interface ContractPrefill {
  sellerName?: string;
  propertyAddress?: string;
  city?: string;
  county?: string;
  parcelId?: string;
  probateCaseNumber?: string;
  isProbate?: boolean;
  purchasePrice?: number | null;
  assignmentFee?: number | null;
  maoReference?: number | null;
  // Slice 133 — drafting the assignment from an ACCEPTED offer on
  // a published deal. The deal page hands the offer's real terms
  // here: the accepted price (purchasePrice), the offer's closing
  // date and EMD, and the offering buyer's public name/company as
  // the assignee. The assignment fee is NEVER carried in — the
  // wholesaler types it in the generator (see the deal page).
  // doc selects which document opens: 'assignment' for the
  // offer draft, unset for the existing purchase default.
  doc?: 'purchase' | 'assignment';
  endBuyerName?: string;
  endBuyerEntity?: string;
  closingDate?: string;
  assignmentEmdAmount?: number | null;
}

function emptyFields(): WholesaleContractFields {
  return {
    buyer_name: '',
    buyer_entity: '',
    buyer_address: '',
    buyer_email: '',
    buyer_phone: '',
    seller_name: '',
    seller_address: '',
    property_address: '',
    city: '',
    county: '',
    state: 'FL',
    parcel_id: '',
    purchase_price: null,
    earnest_money: null,
    earnest_money_refundable: false,
    earnest_money_deadline: '',
    inspection_days: null,
    // 30 days out, as a date string (split("T")[0] — an array is
    // not a date; the paste's .split("T") without [0] broke this).
    closing_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    title_company: '',
    end_buyer_name: '',
    end_buyer_entity: '',
    assignment_fee: null,
    assignment_emd_amount: null,
    assignment_emd_refundable: false,
    assignment_emd_deadline: '',
    is_probate: false,
    probate_case_number: '',
    mao_reference: null,
  };
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

export default function WholesaleContractGenerator({ userId, prefill }: { userId: string; prefill?: ContractPrefill | null }) {
  const [fields, setFields] = useState<WholesaleContractFields>(emptyFields);
  const [doc, setDoc] = useState<'purchase' | 'assignment'>('purchase');
  const [profile, setProfile] = useState<StorefrontProfile | null>(null);
  const [arv, setArv] = useState('');
  const [repairs, setRepairs] = useState('');
  const [printMsg, setPrintMsg] = useState('');

  useEffect(() => {
    loadMyStorefront(userId).then((p) => {
      setProfile(p);
      if (p) {
        setFields((prev) => ({
          ...prev,
          buyer_name: prev.buyer_name || p.display_name || '',
          buyer_entity: prev.buyer_entity || p.company_name || '',
          buyer_email: prev.buyer_email || p.public_email || '',
          buyer_phone: prev.buyer_phone || p.public_phone || '',
        }));
      }
    }).catch(() => setProfile(null));
  }, [userId]);

  // A prefill from a dashboard row (probate or inbound lead) fills
  // only the fields the row actually carries — money only from the
  // wholesaler's own entered offer_amount, never from MAO.
  useEffect(() => {
    if (!prefill) return;
    setFields((prev) => ({
      ...prev,
      seller_name: prefill.sellerName || prev.seller_name,
      property_address: prefill.propertyAddress || prev.property_address,
      city: prefill.city || prev.city,
      county: prefill.county || prev.county,
      parcel_id: prefill.parcelId || prev.parcel_id,
      probate_case_number: prefill.probateCaseNumber || prev.probate_case_number,
      is_probate: prefill.isProbate === true ? true : prev.is_probate,
      purchase_price: prefill.purchasePrice != null ? prefill.purchasePrice : prev.purchase_price,
      assignment_fee: prefill.assignmentFee != null ? prefill.assignmentFee : prev.assignment_fee,
      mao_reference: prefill.maoReference != null ? prefill.maoReference : prev.mao_reference,
      // Slice 133 — accepted-offer draft: the assignee is the buyer
      // who made the accepted offer, the closing date and the
      // assignment EMD are the offer's own terms. The assignment
      // fee is deliberately NOT set here — the wholesaler enters
      // it, and the form will not print without it.
      end_buyer_name: prefill.endBuyerName || prev.end_buyer_name,
      end_buyer_entity: prefill.endBuyerEntity || prev.end_buyer_entity,
      closing_date: prefill.closingDate || prev.closing_date,
      assignment_emd_amount:
        prefill.assignmentEmdAmount != null ? prefill.assignmentEmdAmount : prev.assignment_emd_amount,
    }));
    if (prefill.isProbate) setDoc('purchase');
    if (prefill.doc) setDoc(prefill.doc);
  }, [prefill]);

  const set = <K extends keyof WholesaleContractFields>(key: K, value: WholesaleContractFields[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  // MAO reference: from the prefill when one was carried in, else
  // computed from ARV / repairs / fee the wholesaler enters here.
  // It is a ceiling shown for reference — never the price.
  const computedMao = useMemo(() => {
    const a = numOrNull(arv);
    const r = numOrNull(repairs);
    const fee = fields.assignment_fee;
    if (a == null || r == null || fee == null) return null;
    return calculateMAO(a, r, fee);
  }, [arv, repairs, fields.assignment_fee]);
  const maoReference = fields.mao_reference ?? computedMao;
  const docFields: WholesaleContractFields = { ...fields, mao_reference: maoReference };

  const docText = doc === 'purchase' ? buildPurchaseAgreement(docFields) : buildAssignmentContract(docFields);

  const missing: string[] = [];
  if (fields.purchase_price == null) missing.push('the agreed purchase price');
  if (doc === 'assignment' && fields.assignment_fee == null) missing.push('the agreed assignment fee');
  if (!fields.seller_name.trim()) missing.push('the seller name');
  if (!fields.property_address.trim()) missing.push('the property address');

  function printDoc() {
    if (missing.length > 0) {
      setPrintMsg(`Enter ${missing.join(', ')} before printing — this form never prints with blank money terms.`);
      return;
    }
    setPrintMsg('');
    window.print();
  }

  function downloadTxt() {
    if (missing.length > 0) {
      setPrintMsg(`Enter ${missing.join(', ')} before downloading — this form never exports with blank money terms.`);
      return;
    }
    setPrintMsg('');
    const blob = new Blob([docText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc === 'purchase' ? 'purchase-agreement-a-to-b.txt' : 'assignment-contract-b-to-c.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontSize: 13 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 10 };

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-contract, #printable-contract * { visibility: visible !important; }
          #printable-contract { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>📝 Wholesale Contract Generator</h2>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 4px' }}>
        A-to-B purchase agreement + B-to-C assignment. Templates only — have licensed real estate
        counsel in your state review and approve them before signing or submitting to title.
        Nothing here files, sends, or signs anything.
      </p>
      <p style={{ fontSize: 13, color: '#92400e', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px' }}>
        {ATTORNEY_REVIEW_BANNER}
      </p>
      {!profile && (
        <p style={{ fontSize: 13, color: '#fcd34d', margin: '0 0 12px' }}>
          Fill in Storefront Settings to add your name, company, and number — this form leaves them
          blank rather than using anyone else&apos;s details.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setDoc('purchase')} style={{ padding: '8px 14px', borderRadius: 999, border: doc === 'purchase' ? '2px solid #0f172a' : '1px solid #cbd5e1', background: doc === 'purchase' ? '#0f172a' : '#fff', color: doc === 'purchase' ? '#fff' : '#0f172a', cursor: 'pointer', fontSize: 13 }}>
          A-to-B Purchase Agreement
        </button>
        <button type="button" onClick={() => setDoc('assignment')} style={{ padding: '8px 14px', borderRadius: 999, border: doc === 'assignment' ? '2px solid #0f172a' : '1px solid #cbd5e1', background: doc === 'assignment' ? '#0f172a' : '#fff', color: doc === 'assignment' ? '#fff' : '#0f172a', cursor: 'pointer', fontSize: 13 }}>
          B-to-C Assignment
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Buyer (you — the wholesaler)</h3>
          <label style={labelStyle}>Your name<input style={inputStyle} value={fields.buyer_name} onChange={(e) => set('buyer_name', e.target.value)} placeholder="Your full name" /></label>
          <label style={labelStyle}>Entity / company<input style={inputStyle} value={fields.buyer_entity} onChange={(e) => set('buyer_entity', e.target.value)} placeholder="Your company / LLC" /></label>
          <label style={labelStyle}>Your address<input style={inputStyle} value={fields.buyer_address} onChange={(e) => set('buyer_address', e.target.value)} placeholder="Your mailing address" /></label>
          <label style={labelStyle}>Your email<input style={inputStyle} value={fields.buyer_email} onChange={(e) => set('buyer_email', e.target.value)} placeholder="Your email" /></label>
          <label style={labelStyle}>Your phone<input style={inputStyle} value={fields.buyer_phone} onChange={(e) => set('buyer_phone', e.target.value)} placeholder="Your phone" /></label>
        </div>
        <div>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Seller</h3>
          <label style={labelStyle}>Seller name *<input style={inputStyle} value={fields.seller_name} onChange={(e) => set('seller_name', e.target.value)} placeholder="Seller full name" /></label>
          <label style={labelStyle}>Seller address<input style={inputStyle} value={fields.seller_address} onChange={(e) => set('seller_address', e.target.value)} placeholder="Seller mailing address" /></label>
          <h3 style={{ fontSize: 14, margin: '12px 0 8px' }}>Property</h3>
          <label style={labelStyle}>Property address *<input style={inputStyle} value={fields.property_address} onChange={(e) => set('property_address', e.target.value)} placeholder="Street address" /></label>
          <label style={labelStyle}>City<input style={inputStyle} value={fields.city} onChange={(e) => set('city', e.target.value)} placeholder="City" /></label>
          <label style={labelStyle}>County<input style={inputStyle} value={fields.county} onChange={(e) => set('county', e.target.value)} placeholder="County" /></label>
          <label style={labelStyle}>Parcel / APN<input style={inputStyle} value={fields.parcel_id} onChange={(e) => set('parcel_id', e.target.value)} placeholder="Parcel ID (from the appraiser)" /></label>
        </div>
        <div>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Money &amp; terms — empty until you enter them</h3>
          <label style={labelStyle}>Purchase price (agreed) *<input style={inputStyle} value={fields.purchase_price ?? ''} onChange={(e) => set('purchase_price', numOrNull(e.target.value))} placeholder="e.g. 135000" inputMode="decimal" /></label>
          <label style={labelStyle}>Earnest money<input style={inputStyle} value={fields.earnest_money ?? ''} onChange={(e) => set('earnest_money', numOrNull(e.target.value))} placeholder="Agreed EMD amount" inputMode="decimal" /></label>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={fields.earnest_money_refundable} onChange={(e) => set('earnest_money_refundable', e.target.checked)} />
            Earnest money is refundable
          </label>
          <label style={labelStyle}>EMD deadline<input style={inputStyle} value={fields.earnest_money_deadline} onChange={(e) => set('earnest_money_deadline', e.target.value)} placeholder="e.g. within 48 hours of acceptance" /></label>
          <label style={labelStyle}>Inspection days<input style={inputStyle} value={fields.inspection_days ?? ''} onChange={(e) => set('inspection_days', numOrNull(e.target.value))} placeholder="Agreed inspection days" inputMode="numeric" /></label>
          <label style={labelStyle}>Closing date<input style={inputStyle} type="date" value={fields.closing_date} onChange={(e) => set('closing_date', e.target.value)} /></label>
          <label style={labelStyle}>Title company<input style={inputStyle} value={fields.title_company} onChange={(e) => set('title_company', e.target.value)} placeholder="Title company name" /></label>
        </div>
        <div>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>B-to-C assignment</h3>
          <label style={labelStyle}>End buyer name<input style={inputStyle} value={fields.end_buyer_name} onChange={(e) => set('end_buyer_name', e.target.value)} placeholder="End buyer full name" /></label>
          <label style={labelStyle}>End buyer entity<input style={inputStyle} value={fields.end_buyer_entity} onChange={(e) => set('end_buyer_entity', e.target.value)} placeholder="End buyer company / LLC" /></label>
          <label style={labelStyle}>Assignment fee (agreed) *<input style={inputStyle} value={fields.assignment_fee ?? ''} onChange={(e) => set('assignment_fee', numOrNull(e.target.value))} placeholder="Agreed assignment fee" inputMode="decimal" /></label>
          <label style={labelStyle}>Assignment EMD amount<input style={inputStyle} value={fields.assignment_emd_amount ?? ''} onChange={(e) => set('assignment_emd_amount', numOrNull(e.target.value))} placeholder="Agreed assignment EMD" inputMode="decimal" /></label>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={fields.assignment_emd_refundable} onChange={(e) => set('assignment_emd_refundable', e.target.checked)} />
            Assignment EMD is refundable
          </label>
          <label style={labelStyle}>Assignment EMD deadline<input style={inputStyle} value={fields.assignment_emd_deadline} onChange={(e) => set('assignment_emd_deadline', e.target.value)} placeholder="e.g. within 24 hours of signing" /></label>
          <h3 style={{ fontSize: 14, margin: '12px 0 8px' }}>MAO reference (ceiling, never the price)</h3>
          <label style={labelStyle}>ARV (for the MAO reference)<input style={inputStyle} value={arv} onChange={(e) => setArv(e.target.value)} placeholder="ARV from comps" inputMode="decimal" /></label>
          <label style={labelStyle}>Estimated repairs<input style={inputStyle} value={repairs} onChange={(e) => setRepairs(e.target.value)} placeholder="Estimated repair costs" inputMode="decimal" /></label>
          {maoReference != null && (
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 8px' }}>
              MAO reference: ${maoReference.toLocaleString()} — a ceiling from your own numbers, shown
              for reference only. It is never the purchase price.
            </p>
          )}
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={fields.is_probate} onChange={(e) => set('is_probate', e.target.checked)} />
            Probate deal — sale contingent on court authority
          </label>
          {fields.is_probate && (
            <label style={labelStyle}>Probate case number<input style={inputStyle} value={fields.probate_case_number} onChange={(e) => set('probate_case_number', e.target.value)} placeholder="e.g. 2026CP001433" /></label>
          )}
        </div>
      </div>

      {printMsg && <p style={{ fontSize: 13, color: '#fca5a5', margin: '0 0 8px' }}>{printMsg}</p>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={printDoc} disabled={missing.length > 0} title={missing.length > 0 ? `Enter ${missing.join(', ')} first` : 'Print this document'} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: missing.length > 0 ? 'not-allowed' : 'pointer', opacity: missing.length > 0 ? 0.5 : 1 }}>
          Print
        </button>
        <button type="button" onClick={downloadTxt} disabled={missing.length > 0} title={missing.length > 0 ? `Enter ${missing.join(', ')} first` : 'Download as .txt'} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: missing.length > 0 ? 'not-allowed' : 'pointer', opacity: missing.length > 0 ? 0.5 : 1 }}>
          Download .txt
        </button>
        {missing.length > 0 && (
          <span style={{ fontSize: 13, color: '#cbd5e1', alignSelf: 'center' }}>
            Enter {missing.join(', ')} before printing.
          </span>
        )}
      </div>

      <div id="printable-contract" style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, background: '#fff', color: '#0f172a' }}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{docText}</pre>
      </div>
    </div>
  );
}
