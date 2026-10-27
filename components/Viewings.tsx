'use client';

import { useState } from 'react';

// Walkthrough Verification, ported from the old prototype.
// Buyer confirmed + Seller confirmed, both manual. Both Yes = cleared for title handoff.
// Any mismatch or No = HOLD. Confirmation is a copy/mailto template only — the app sends nothing,
// and there is no SMS gateway here.
type YesNo = 'Pending' | 'Yes' | 'No';

export default function Viewings() {
  const [address, setAddress] = useState('');
  const [slot, setSlot] = useState('');
  const [buyer, setBuyer] = useState<YesNo>('Pending');
  const [seller, setSeller] = useState<YesNo>('Pending');
  const cleared = buyer === 'Yes' && seller === 'Yes';

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Viewings — Walkthrough Verification</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        The seller message uses partner/inspector language only — it never reveals the buyer or the fee.
        Confirmations below are manual statuses you set yourself. This section is still local-only in Slice 5 — saving a viewing to a deal's viewing_slots is Slice 6, once a deal is selected.
      </p>
      <input placeholder="Property address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ marginRight: 8 }} />
      <input placeholder="Slot, e.g. Oct 28, 2-4pm" value={slot} onChange={(e) => setSlot(e.target.value)} />
      <p>Viewing: {address || '(no address yet)'} {slot ? `— ${slot}` : ''}</p>
      <p>Buyer confirmed: <select value={buyer} onChange={(e) => setBuyer(e.target.value as YesNo)}><option>Pending</option><option>Yes</option><option>No</option></select></p>
      <p>Seller confirmed: <select value={seller} onChange={(e) => setSeller(e.target.value as YesNo)}><option>Pending</option><option>Yes</option><option>No</option></select></p>
      {cleared
        ? <p style={{ color: '#4ade80' }}><strong>Cleared for title handoff (manual status).</strong></p>
        : <p style={{ color: '#f87171' }}><strong>HOLD — do not send to title until both buyer and seller confirm Yes.</strong></p>}
      <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8 }}>
{`Seller walkthrough request (copy to email):\nHi, can we schedule a partner walkthrough at ${address || '[address]'} ${slot ? `on ${slot}` : ''}? Our inspector/partner will walk the property. Thank you.`}
      </pre>
    </section>
  );
}
