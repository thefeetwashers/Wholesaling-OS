'use client';

import { useState } from 'react';
import { emdCountdownText } from '../lib/contracts';

// Title escrow tracker, ported from the old prototype.
// Milestones and the EMD countdown are manual: you set the deadline, the app counts down from it.
// Payout is price + fee − referral = net. Title handoff is an email package, not an API.
const MILESTONES = [
  'Contract signed', 'EMD received', 'Title search ordered',
  'Title commitment received', 'Closing scheduled', 'Closed / funded',
];

export default function Escrow() {
  const [price, setPrice] = useState(150000);
  const [fee, setFee] = useState(10000);
  const [referral, setReferral] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [step, setStep] = useState(0);
  const net = price + fee - referral;

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Title Escrow Tracker</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Milestones are advanced by you, by hand. Nothing here talks to a title company system. This tracker is still local-only in Slice 5 — saving escrow files/milestones to Supabase is Slice 6, once a deal and listing exist.</p>
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
    </section>
  );
}
