'use client';

import { useEffect, useState } from 'react';
import { loadDashboardBand, type DashboardBandData } from '../lib/kpis';

// Slice 43 — the dashboard headline band: the wholesaler's four
// numbers plus the pipeline stage tracker. Definitions are printed
// on the panel because a number without its definition is marketing.
// Revenue counts only deals marked closed; buyers are counted, never
// labeled "vetted" — the platform verifies closings, not people.

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export default function DashboardBand({ userId }: { userId: string }) {
  const [band, setBand] = useState<DashboardBandData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadDashboardBand(userId)
      .then((b) => { if (live) setBand(b); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [userId]);

  if (failed) return null;
  if (!band) {
    return (
      <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0 }}>Loading your numbers…</p>
      </section>
    );
  }

  const stages = [
    { label: 'Leads in play', value: band.stages.leadsInPlay },
    { label: 'In negotiation — open offers', value: band.stages.inNegotiation },
    { label: 'Under contract — A–B signed', value: band.stages.underContract },
    { label: 'Ready to close — closing scheduled', value: band.stages.readyToClose },
  ];
  const maxStage = Math.max(1, ...stages.map((s) => s.value));

  const card = (title: string, big: string, sub: string) => (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 14px', minWidth: 180, flex: '1 1 180px' }}>
      <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, margin: '2px 0' }}>{big}</div>
      <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{sub}</div>
    </div>
  );

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Your numbers</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {card('Revenue — this month', money(band.revenueMonth),
          `${band.revenueMonthCount} closing${band.revenueMonthCount === 1 ? '' : 's'} recorded · ${money(band.revenueYear)} this year (${band.revenueYearCount})`)}
        {card('Active contracts locked up', String(band.activeContracts),
          `A–B signed, not yet closed · ${money(band.feesInPipeline)} in assignment fees riding on them`)}
        {card('Cash buyers', String(band.buyersTotal),
          `on your list · ${band.buyersWithClosings} portal buyer${band.buyersWithClosings === 1 ? '' : 's'} with closing records here`)}
        {card('Follow-ups due', String(band.overdueFollowUps + band.dueToday),
          `${band.overdueFollowUps} overdue · ${band.dueToday} due today — work them from the call queue in Leads`)}
      </div>

      <h3 style={{ marginBottom: 6 }}>Pipeline</h3>
      {stages.map((s) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, fontSize: 13.5 }}>
          <span style={{ width: 250, color: '#cbd5e1' }}>{s.label}</span>
          <span style={{ background: '#2563eb', height: 14, borderRadius: 4, width: `${Math.max(2, (s.value / maxStage) * 320)}px` }} />
          <strong>{s.value}</strong>
        </div>
      ))}
      <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 0 }}>
        Revenue counts assignment fees on deals you marked closed — nothing projected, nothing estimated.
        Buyer closings are counted from platform records (accepted offers, B–C signings, escrow outcomes);
        proof-of-funds claims stay labeled self-reported in the Buyers view.
      </p>
    </section>
  );
}
