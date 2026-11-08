'use client';

import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { loadLeads } from '../lib/leads';
import { loadKpis } from '../lib/money';

// Slice 74 — Day-91 Value Receipt. A trial is an argument, and the
// only honest argument is the wholesaler's own counted work. During
// the trial this panel keeps a running receipt from real rows —
// leads built, contracts signed, fees on closed deals (the KPI
// definition: deals with an actual sale price recorded). In the
// last 15 days it becomes a full receipt card, so what day 91 costs
// ($150) is weighed against what the platform already produced —
// never against projections, and never with anyone else's numbers.

interface Receipt {
  day: number;
  daysLeft: number;
  leads: number;
  contracts: number;
  fees: number;
}

export default function ValueReceipt({ userId }: { userId: string }) {
  const [r, setR] = useState<Receipt | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabaseConfigured || !supabase) return;
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at, created_at')
        .eq('id', userId)
        .single();
      if (!live || !data || data.subscription_status !== 'trialing' || !data.trial_ends_at || !data.created_at) return;
      const start = new Date(data.created_at).getTime();
      const end = new Date(data.trial_ends_at).getTime();
      const now = Date.now();
      const day = Math.max(1, Math.floor((now - start) / 86400000) + 1);
      const daysLeft = Math.ceil((end - now) / 86400000);
      const [leads, kpis] = await Promise.all([
        loadLeads(userId).catch(() => null),
        loadKpis(userId).catch(() => null),
      ]);
      if (!live) return;
      setR({
        day,
        daysLeft,
        leads: (leads || []).length,
        contracts: kpis?.contractsSignedTotal ?? 0,
        fees: kpis?.feesClosedTotal ?? 0,
      });
    })();
    return () => { live = false; };
  }, [userId]);

  if (!r) return null;

  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  if (r.daysLeft > 15) {
    return (
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 16 }}>
        🧾 Day {r.day} of your 90 free days — your receipt so far: {r.leads} lead{r.leads === 1 ? '' : 's'} built,{' '}
        {r.contracts} contract{r.contracts === 1 ? '' : 's'} signed, {money(r.fees)} in fees on closed deals.
        The full receipt prints here in your last 15 days.
      </p>
    );
  }

  return (
    <section style={{ background: '#1e293b', border: '1px solid #34d399', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🧾 Your 90 days, counted — the Day-91 receipt</h2>
      <p style={{ fontSize: 14 }}>
        {r.daysLeft > 0
          ? `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left of free. `
          : 'Your free days have run out. '}
        Here is what this platform holds for you, counted from your own records — not projections:
      </p>
      <ul style={{ fontSize: 14.5, paddingLeft: 18 }}>
        <li><strong>{r.leads}</strong> lead{r.leads === 1 ? '' : 's'} built and kept</li>
        <li><strong>{r.contracts}</strong> contract{r.contracts === 1 ? '' : 's'} signed</li>
        <li><strong>{money(r.fees)}</strong> in assignment fees on closed deals</li>
      </ul>
      <p style={{ fontSize: 13.5, color: '#94a3b8' }}>
        Day 91 costs $150 a month — one closed deal covers a year of it. Subscribe from the green button and
        nothing here skips a beat; let it lapse and your records stay saved, sealed, and waiting for you.
      </p>
    </section>
  );
}
