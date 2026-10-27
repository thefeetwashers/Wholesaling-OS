'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadDeals, type DealRow } from '../lib/deals';
import { createListingForDeal, createEscrowFile, loadEscrowFilesForDeal, addEscrowMilestone, type EscrowFileRow } from '../lib/escrow';
import { emdCountdownText } from '../lib/contracts';

// Title escrow tracker, ported from the old prototype.
// Milestones and the EMD countdown are manual: you set the deadline, the app counts down from it.
// Payout is price + fee − referral = net. Title handoff is an email package, not an API.
const MILESTONES = [
  'Contract signed', 'EMD received', 'Title search ordered',
  'Title commitment received', 'Closing scheduled', 'Closed / funded',
];

export default function Escrow({ userId }: { userId: string | null }) {
  const [price, setPrice] = useState(150000);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [dealId, setDealId] = useState('');
  const [files, setFiles] = useState<EscrowFileRow[]>([]);
  const [savedMsg, setSavedMsg] = useState('');
  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadDeals(userId).then((rows) => { if (rows) setDeals(rows); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  useEffect(() => {
    if (userId && supabaseConfigured && dealId) {
      loadEscrowFilesForDeal(userId, dealId).then((rows) => { if (rows) setFiles(rows); }).catch(() => {});
    }
  }, [userId, dealId]);
  const saveEscrow = async () => {
    if (!dealId || !userId || !supabaseConfigured) { setSavedMsg('Pick a saved deal and sign in to save escrow.'); return; }
    const listing = await createListingForDeal(userId, dealId, price + fee).catch(() => null);
    if (!listing) { setSavedMsg('Save failed — check sign-in and try again.'); return; }
    const selectedDeal = deals.find((d) => d.id === dealId);
    const file = await createEscrowFile(userId, listing.id, selectedDeal?.emd_amount ?? 0, deadline || null).catch(() => null);
    if (!file || !file.id) { setSavedMsg('Listing created but escrow file failed — check the listings table.'); return; }
    for (let i = 0; i <= step && i < MILESTONES.length; i++) {
      await addEscrowMilestone(userId, file.id, MILESTONES[i]).catch(() => {});
    }
    setFiles([file, ...files]); setSavedMsg('Escrow file saved to Supabase (listing + file + milestones).');
  };
  const [fee, setFee] = useState(10000);
  const [referral, setReferral] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [step, setStep] = useState(0);
  const net = price + fee - referral;

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Title Escrow Tracker</h2>
      <label>Deal (saved in Supabase): <select value={dealId} onChange={(e) => setDealId(e.target.value)}><option value="">— pick a deal —</option>{deals.map((d) => <option key={d.id} value={d.id}>{(d.documents as { property_address?: string } | undefined)?.property_address || d.id} — {d.contract_type}</option>)}</select></label>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>{savedMsg || 'Save creates a marketplace listing, then an escrow file, then append-only milestone rows.'}</p>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Milestones are advanced by you, by hand. Nothing here talks to a title company system. Milestones saved to Supabase are append-only — they are inserted, never edited or deleted.</p>
      <label>Contract price $ <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>{' '}
      <label>Assignment fee $ <input type="number" value={fee} onChange={(e) => setFee(Number(e.target.value))} /></label>{' '}
      <label>Referral $ <input type="number" value={referral} onChange={(e) => setReferral(Number(e.target.value))} /></label>
      <p><strong>Payout net: ${net.toLocaleString()}</strong> (price + fee − referral)</p>
      <label>EMD deadline: <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
      <p>EMD countdown: {deadline ? emdCountdownText(deadline) : 'No deadline set yet.'}</p>
      <ol>
        {MILESTONES.map((m, i) => (
          <li key={m} style={{ opacity: i <= step ? 1 : 0.5 }}>
            {m} {i === step && <button onClick={() => setStep(Math.min(step + 1, MILESTONES.length - 1))}>Mark done →</button>}
            {i < step && ' ✓'}
          </li>
        ))}
      </ol>
      <button onClick={saveEscrow}>Save escrow file to Supabase</button>
      {files.length > 0 && <ul>{files.map((f) => <li key={f.id}>Escrow file — EMD required ${f.emd_amount_required ?? 0}, status {f.file_status}, deadline {f.emd_deadline || 'none'}</li>)}</ul>}
    </section>
  );
}
