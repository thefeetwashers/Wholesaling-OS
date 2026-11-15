'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { dealFromContract, loadDeals, saveDeal, type DealRow } from '../lib/deals';
import { sellerView, buyerView, titlePackage, canSignBC, buildTransactionalNote, buildTitleEscrowLetter, buildReferralFeeNotice, referralFeeAmount, FUNDING_MERGE_TAGS, type DealContract, type SigStatus, type FundingPacketFields } from '../lib/contracts';
import { loadMyFundingRequests, loadDirectFundingRequests, OPERATOR_EMAIL, type FundingRequest } from '../lib/funding';

const EMPTY: DealContract = {
  property_address: '', city: '', state: '', seller_name: '', buyer_name: '',
  contract_price: 150000, arv: 300000, repairs: 50000,
  assignment_fee: 10000, emd_amount: 1000,
  ab_status: 'Draft', jv_status: 'Not a JV deal', bc_status: 'Draft',
};

export default function Contracts({ userId, userEmail }: { userId: string | null; userEmail?: string | null }) {
  const [c, setC] = useState<DealContract>(EMPTY);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [mode, setMode] = useState<'local' | 'synced'>('local');
  const [savedMsg, setSavedMsg] = useState('');
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>([]);
  const [packetFor, setPacketFor] = useState<string | null>(null);
  const [packetText, setPacketText] = useState('');
  const [packetTags, setPacketTags] = useState<{ tag: string; value: string }[]>([]);
  const isOperator = userEmail === OPERATOR_EMAIL;

  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadDeals(userId).then((rows) => { if (rows) { setDeals(rows); setMode('synced'); } }).catch(() => {});
      // Transactional funding packets: the operator sees every direct-track
      // packet; anyone else sees only their own direct-track requests.
      // ISO-network packets never appear here — they belong to the lenders.
      if (isOperator) {
        loadDirectFundingRequests().then((rows) => setFundingRequests(rows)).catch(() => {});
      } else {
        loadMyFundingRequests(userId)
          .then((rows) => setFundingRequests(rows.filter((r) => r.routing_track === 'direct_feet_washers')))
          .catch(() => {});
      }
    }
    // Slice 13: one-click prefill from Stale Listings / Driving for Dollars.
    try {
      const raw = localStorage.getItem('ws_prefill_lead');
      if (raw) {
        const pf = JSON.parse(raw) as { property_address?: string; seller_name?: string };
        setC((prev) => ({
          ...prev,
          property_address: pf.property_address || prev.property_address,
          seller_name: pf.seller_name || prev.seller_name,
        }));
        localStorage.removeItem('ws_prefill_lead');
        setSavedMsg('Contract prefilled from the lead you picked below.');
      }
    } catch { /* prefill is best-effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const saveCurrentDeal = async () => {
    if (!c.property_address.trim()) { setSavedMsg('Enter a property address first.'); return; }
    if (!userId || !supabaseConfigured) { setSavedMsg('Sign in with Supabase configured to save this deal.'); return; }
    const row = await saveDeal(dealFromContract(userId, c)).catch(() => null);
    if (row) { setDeals([row, ...deals]); setSavedMsg('Deal saved to Supabase.'); } else { setSavedMsg('Save failed — check sign-in and try again.'); }
  };
  const [view, setView] = useState<'seller' | 'buyer' | 'title' | null>(null);
  const bcLocked = !canSignBC(c);

  const setStatus = (key: 'ab_status' | 'bc_status', v: SigStatus) => setC({ ...c, [key]: v });

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Contracts — Signature Pipeline</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Step 1 A-B to seller at verbal agreement (price only). Step 2 JV between wholesalers BEFORE marketing.
        Step 3 B-C to buyer ONLY after A-B is Signed. Step 4 title package via email handoff.
        Sending is a copy/mailto composer + manual status — no auto-send, no real e-sign.
        <strong> Attorney review required before use.</strong>
      </p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <input placeholder="Property address" value={c.property_address} onChange={(e) => setC({ ...c, property_address: e.target.value })} />
        <input placeholder="Seller name" value={c.seller_name} onChange={(e) => setC({ ...c, seller_name: e.target.value })} />
        <input placeholder="City" value={c.city || ''} onChange={(e) => setC({ ...c, city: e.target.value })} />
        <input placeholder="State" value={c.state || ''} onChange={(e) => setC({ ...c, state: e.target.value })} />
        <input placeholder="Buyer name" value={c.buyer_name} onChange={(e) => setC({ ...c, buyer_name: e.target.value })} />
        <label>Contract price $ <input type="number" value={c.contract_price} onChange={(e) => setC({ ...c, contract_price: Number(e.target.value) })} /></label>
        <label>ARV $ <input type="number" value={c.arv} onChange={(e) => setC({ ...c, arv: Number(e.target.value) })} /></label>
        <label>Repairs $ <input type="number" value={c.repairs} onChange={(e) => setC({ ...c, repairs: Number(e.target.value) })} /></label>
        <label>Assignment fee $ <input type="number" value={c.assignment_fee} onChange={(e) => setC({ ...c, assignment_fee: Number(e.target.value) })} /></label>
        <label>EMD $ <input type="number" value={c.emd_amount} onChange={(e) => setC({ ...c, emd_amount: Number(e.target.value) })} /></label>
        <input placeholder="JV partner (leave blank if solo deal)" value={c.jv_partner || ''} onChange={(e) => setC({ ...c, jv_partner: e.target.value, jv_status: e.target.value ? 'Draft' : 'Not a JV deal' })} />
      </div>
      <div style={{ marginTop: 12 }}>
        <p>A-B status: {c.ab_status} — <button onClick={() => setStatus('ab_status', 'Sent')}>Mark Sent</button> <button onClick={() => setStatus('ab_status', 'Signed')}>Mark Signed</button></p>
        <p>JV status: {c.jv_status}</p>
        <p>B-C status: {c.bc_status} {bcLocked && '(locked until A-B is Signed)'} — <button disabled={bcLocked} onClick={() => setStatus('bc_status', 'Sent')}>Mark Sent</button> <button disabled={bcLocked} onClick={() => setStatus('bc_status', 'Signed')}>Mark Signed</button></p>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={saveCurrentDeal}>Save deal to Supabase</button>{' '}
        <button onClick={() => setView('seller')}>Show A-B (seller view)</button>{' '}
        <button onClick={() => setView('buyer')} disabled={bcLocked}>Show B-C (buyer view)</button>{' '}
        <button onClick={() => setView('title')}>Show title package</button>
      </div>
      {view === 'seller' && <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8 }}>{sellerView(c)}</pre>}
      {view === 'buyer' && <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8 }}>{buyerView(c)}</pre>}
      {view === 'title' && <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8 }}>{titlePackage(c)}</pre>}
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Mode: {mode === 'synced' ? 'Deals synced to Supabase (your rows only, RLS)' : 'Local only — sign in with Supabase configured to save deals.'}{savedMsg ? ` ${savedMsg}` : ''}</p>
      {deals.length > 0 && <ul>{deals.map((d) => <li key={d.id || ''}>{(d.documents as { property_address?: string } | undefined)?.property_address || 'Deal'} — {d.contract_type}, ${d.contract_price ?? 0}, fee ${d.assignment_fee ?? 0}, status {d.status}<br /><span style={{ fontSize: 12, color: '#94a3b8' }}>Deal ID: {d.id} — share this with your seller so they can link and sign in their portal.</span></li>)}</ul>}

      {(isOperator || fundingRequests.length > 0) && (
        <section style={{ background: '#0f172a', padding: 16, borderRadius: 10, marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Transactional Funding Packet — direct track only</h3>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>
            {isOperator
              ? 'Operator view: direct-track funding requests (transactional, routed to The Feet Washers, Inc.). ISO-network packets are not listed here — they belong to the matched lenders.'
              : 'Your direct-track funding requests (transactional, routed to The Feet Washers, Inc.).'}
            {' '}Generating a packet renders the three documents below — the Transactional
            Promissory Note, the Title Escrow &amp; Wire Instruction Letter, and the
            Commission / Referral Fee Disbursement Notice — populated from the request. It
            does not fund anything, sign anything, or confirm any funding.
          </p>
          {fundingRequests.length === 0 ? (
            <p style={{ fontSize: 13 }}>No direct-track funding requests yet.</p>
          ) : (
            <ul style={{ fontSize: 13 }}>
              {fundingRequests.map((r) => (
                <li key={r.id} style={{ marginBottom: 8 }}>
                  <strong>{r.property_address || 'Property address not given'}</strong> · {r.financing_type} ·
                  loan requested {r.loan_amount_requested != null ? `$${Number(r.loan_amount_requested).toLocaleString()}` : '—'} ·
                  target closing {r.target_closing_date || '—'} · status: {r.status}{' '}
                  <button
                    onClick={() => {
                      const fields: FundingPacketFields = {
                        loan_amount: r.loan_amount_requested ?? null,
                        effective_date: r.created_at ? r.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                        closing_date: r.target_closing_date || '',
                        property_address: r.property_address || '',
                        borrower_entity: r.borrowing_entity_name || '',
                        borrower_state: r.entity_state || '',
                        title_company: r.title_company_name || '',
                        title_officer_email: r.title_officer_email || '',
                        purchase_price: r.purchase_price ?? null,
                        estimated_arv: r.estimated_arv ?? null,
                        // Direct track: the lender is The Feet Washers, Inc.
                        // itself, so the fee notice is addressed to it
                        // alongside the title company.
                        lender_company: 'The Feet Washers, Inc.',
                      };
                      const note = buildTransactionalNote(fields);
                      const letter = buildTitleEscrowLetter(fields);
                      const feeNotice = buildReferralFeeNotice(fields);
                      setPacketText(`${note}\n\n----------------------------------------\n\n${letter}\n\n----------------------------------------\n\n${feeNotice}`);
                      setPacketTags([
                        { tag: '{{loan_amount}}', value: fields.loan_amount != null ? `$${Number(fields.loan_amount).toLocaleString()}` : '[amount not given]' },
                        { tag: '{{effective_date}}', value: fields.effective_date },
                        { tag: '{{closing_date}}', value: fields.closing_date || '[date not given]' },
                        { tag: '{{property_address}}', value: fields.property_address || '[address not given]' },
                        { tag: '{{borrower_entity}}', value: fields.borrower_entity || '[entity not given]' },
                        { tag: '{{borrower_state}}', value: fields.borrower_state || '[state not given]' },
                        { tag: '{{title_company}}', value: fields.title_company || '[title company not given]' },
                        { tag: '{{title_officer_email}}', value: fields.title_officer_email || '[email not given]' },
                        { tag: '{{lender_company}}', value: fields.lender_company || '[lender company not given]' },
                        { tag: '{{fee_percentage}}', value: fields.referral_fee_percent != null ? `${fields.referral_fee_percent}%` : '1.5%–2.0% (exact percent agreed before closing)' },
                        { tag: '{{fee_amount}}', value: referralFeeAmount(fields.loan_amount, fields.referral_fee_percent) },
                      ]);
                      setPacketFor(r.id || null);
                    }}
                  >
                    Generate Transactional Funding Packet
                  </button>
                </li>
              ))}
            </ul>
          )}
          {packetFor && packetText && (
            <div>
              <p style={{ fontSize: 13 }}>Merge tags used — what each tag was filled with for this packet:</p>
              <ul style={{ fontSize: 12.5, color: '#cbd5e1' }}>
                {packetTags.map((t) => <li key={t.tag}>{t.tag} → {t.value}</li>)}
                <li>All merge tags: {FUNDING_MERGE_TAGS.join(', ')}</li>
              </ul>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)' }}>{packetText}</pre>
              <button onClick={() => window.print()}>Print / save as PDF (browser print)</button>{' '}
              <button
                onClick={() => {
                  const blob = new Blob([packetText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `transactional-funding-packet-${packetFor}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download packet (.txt)
              </button>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>
                This is a template packet, not a signed note and not a funding confirmation. No
                signature is rendered here — signatures happen on paper, after attorney review.
              </p>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
