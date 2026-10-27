'use client';

import { useState } from 'react';
import { sellerView, buyerView, titlePackage, canSignBC, type DealContract, type SigStatus } from '../lib/contracts';

const EMPTY: DealContract = {
  property_address: '', seller_name: '', buyer_name: '',
  contract_price: 150000, arv: 300000, repairs: 50000,
  assignment_fee: 10000, emd_amount: 1000,
  ab_status: 'Draft', jv_status: 'Not a JV deal', bc_status: 'Draft',
};

export default function Contracts() {
  const [c, setC] = useState<DealContract>(EMPTY);
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
        <button onClick={() => setView('seller')}>Show A-B (seller view)</button>{' '}
        <button onClick={() => setView('buyer')} disabled={bcLocked}>Show B-C (buyer view)</button>{' '}
        <button onClick={() => setView('title')}>Show title package</button>
      </div>
      {view === 'seller' && <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8 }}>{sellerView(c)}</pre>}
      {view === 'buyer' && <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8 }}>{buyerView(c)}</pre>}
      {view === 'title' && <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8 }}>{titlePackage(c)}</pre>}
    </section>
  );
}
