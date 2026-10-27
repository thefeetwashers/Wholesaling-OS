'use client';

import { useState } from 'react';
import { dealNet } from '../lib/mao';

// My Business P&L — the wholesaler's own deals only. This is NOT platform revenue.
// Verified example from the old prototype: $10,000 fee − $500 referral − $300 expense = $9,200 net.
export default function BusinessPL() {
  const [fee, setFee] = useState(10000);
  const [referral, setReferral] = useState(500);
  const [expenses, setExpenses] = useState(300);
  const net = dealNet(fee, referral, expenses);

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>My Business P&L — Your Deals Only</h2>
      <label>Assignment fees earned $ <input type="number" value={fee} onChange={(e) => setFee(Number(e.target.value))} /></label>{' '}
      <label>Referral payouts $ <input type="number" value={referral} onChange={(e) => setReferral(Number(e.target.value))} /></label>{' '}
      <label>Expenses $ <input type="number" value={expenses} onChange={(e) => setExpenses(Number(e.target.value))} /></label>
      <p><strong>Net: ${net.toLocaleString()}</strong> — fee − referral − expenses, from deals you logged yourself. No platform totals, no other users' data.</p>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Pricing reminder: the only platform fee is 90 days free, then $150/mo via the owner's Stripe Payment Link.
        No $99 tier, no $200/$220 tech fee, no Stripe Connect auto-split.
      </p>
    </section>
  );
}
