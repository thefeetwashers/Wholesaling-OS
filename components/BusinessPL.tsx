'use client';

import { useState } from 'react';
import { dealNet } from '../lib/mao';
import ProofCaption from './ProofCaption';

// My Business P&L — the wholesaler's own deals only. This is NOT platform revenue.
// Slice 141 audit fix: every figure starts blank — nothing is loaded
// from any record and no example figures are pre-filled. Net is
// fee − referral − expenses, from figures the wholesaler types.
const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

export default function BusinessPL() {
  const [fee, setFee] = useState('');
  const [referral, setReferral] = useState('');
  const [expenses, setExpenses] = useState('');
  const net = dealNet(num(fee), num(referral), num(expenses));

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>My Business P&L — Your Deals Only</h2>
      <ProofCaption>Enter your own figures — nothing is loaded automatically. This is your business’s money — never the platform’s revenue, and never anyone else’s deals.</ProofCaption>
      <label>Assignment fees earned $ <input type="number" placeholder="Not provided" value={fee} onChange={(e) => setFee(e.target.value)} /></label>{' '}
      <label>Referral payouts $ <input type="number" placeholder="Not provided" value={referral} onChange={(e) => setReferral(e.target.value)} /></label>{' '}
      <label>Expenses $ <input type="number" placeholder="Not provided" value={expenses} onChange={(e) => setExpenses(e.target.value)} /></label>
      {fee === '' ? (
        <p>Enter your figures above to see your net — nothing is filled in for you.</p>
      ) : (
        <p><strong>Net: ${net.toLocaleString()}</strong> — fee − referral − expenses, from deals you logged yourself. No platform totals, no other users' data.</p>
      )}
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Pricing reminder: the only platform fee is 90 days free, then $150/mo via the owner's Stripe Payment Link.
        No $99 tier, no $200/$220 tech fee, no Stripe Connect auto-split.
      </p>
    </section>
  );
}
