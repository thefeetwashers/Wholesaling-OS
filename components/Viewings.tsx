'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadDeals, updateDealViewing, type DealRow } from '../lib/deals';

// Walkthrough Verification, ported from the old prototype.
// Buyer confirmed + Seller confirmed, both manual. Both Yes = cleared for title handoff.
// Any mismatch or No = HOLD. Confirmation is a copy/mailto template only — the app sends nothing,
// and there is no SMS gateway here.
type YesNo = 'Pending' | 'Yes' | 'No';

export default function Viewings({ userId }: { userId: string | null }) {
  const [address, setAddress] = useState('');
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [dealId, setDealId] = useState('');
  const [mode, setMode] = useState<'local' | 'synced'>('local');
  const [savedMsg, setSavedMsg] = useState('');
  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadDeals(userId).then((rows) => { if (rows) { setDeals(rows); setMode('synced'); } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const saveViewing = async () => {
    if (!dealId || !userId || !supabaseConfigured) { setSavedMsg('Pick a saved deal and sign in to save this viewing.'); return; }
    const slots = [{ day: slot || '', status: 'open' }];
    const confirmed = { slot: slot || '', buyer, seller, cleared: buyer === 'Yes' && seller === 'Yes' };
    await updateDealViewing(dealId, slots, confirmed).catch(() => { setSavedMsg('Save failed — check sign-in and try again.'); return; });
    setSavedMsg('Viewing saved to that deal in Supabase.');
  };
  const [slot, setSlot] = useState('');
  const [buyer, setBuyer] = useState<YesNo>('Pending');
  const [seller, setSeller] = useState<YesNo>('Pending');
  const cleared = buyer === 'Yes' && seller === 'Yes';

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Viewings — Walkthrough Verification</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        The seller message uses partner/inspector language only — it never reveals the buyer or the fee.
        Confirmations below are manual statuses you set yourself. Pick a saved deal above to sync this viewing to that deal's viewing_slots in Supabase.
      </p>
      <label>Deal (saved in Supabase): <select value={dealId} onChange={(e) => setDealId(e.target.value)}><option value="">— pick a deal —</option>{deals.map((d) => <option key={d.id} value={d.id}>{(d.documents as { property_address?: string } | undefined)?.property_address || d.id} — {d.contract_type}</option>)}</select></label>{' '}
      <input placeholder="Property address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ marginRight: 8 }} />
      <input placeholder="Slot, e.g. Oct 28, 2-4pm" value={slot} onChange={(e) => setSlot(e.target.value)} />
      <p>Viewing: {address || '(no address yet)'} {slot ? `— ${slot}` : ''}</p>
      <p>Buyer confirmed: <select value={buyer} onChange={(e) => setBuyer(e.target.value as YesNo)}><option>Pending</option><option>Yes</option><option>No</option></select></p>
      <p>Seller confirmed: <select value={seller} onChange={(e) => setSeller(e.target.value as YesNo)}><option>Pending</option><option>Yes</option><option>No</option></select></p>
      {cleared
        ? <p style={{ color: '#4ade80' }}><strong>Cleared for title handoff (manual status).</strong></p>
        : <p style={{ color: '#f87171' }}><strong>HOLD — do not send to title until both buyer and seller confirm Yes.</strong></p>}
      <button onClick={saveViewing}>Save viewing to selected deal</button>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Mode: {mode === 'synced' ? 'Viewings synced to the selected deal (viewing_slots + confirmed_viewing)' : 'Local only — sign in and save a deal first to sync viewings.'}{savedMsg ? ` ${savedMsg}` : ''}</p>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8 }}>
{`Seller walkthrough request (copy to email):\nHi, can we schedule a partner walkthrough at ${address || '[address]'} ${slot ? `on ${slot}` : ''}? Our inspector/partner will walk the property. Thank you.`}
      </pre>
    </section>
  );
}
