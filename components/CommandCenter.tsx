'use client';

import { useEffect, useState } from 'react';
import { loadDashboardBand, type DashboardBandData } from '../lib/kpis';
import { loadFollowUpStreak } from '../lib/autopsy';
import { loadDeadlines, type DeadlineItem } from '../lib/deadlines';
import { loadSellerPageSettings } from '../lib/portals';

// Slice 48 — the Command Center: a state-of-the-art dashboard head.
// A greeting hero with a live one-line briefing, a visual pipeline
// flow, a money strip, and quick-action tiles. EVERY number comes
// from the same live loaders the "Your numbers" band below uses
// (lib/kpis, lib/deadlines) — nothing projected, nothing decorative
// dressed up as data. This panel ADDS to the dashboard; the band,
// the deadline radar, the portals, the seller card and the Pipeline
// chips below it are untouched.

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function whenText(item: DeadlineItem): string {
  if (item.daysLeft < 0) return `${Math.abs(item.daysLeft)} day${Math.abs(item.daysLeft) === 1 ? '' : 's'} OVERDUE`;
  if (item.daysLeft === 0) return 'TODAY';
  return `in ${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'}`;
}

export function briefingLine(band: DashboardBandData, deadlines: DeadlineItem[]): string {
  const parts: string[] = [];
  const due = band.overdueFollowUps + band.dueToday;
  if (due > 0) {
    parts.push(`${due} follow-up${due === 1 ? '' : 's'} need${due === 1 ? 's' : ''} you${band.overdueFollowUps > 0 ? ` (${band.overdueFollowUps} overdue)` : ''}`);
  }
  if (band.activeContracts > 0) {
    parts.push(`${band.activeContracts} contract${band.activeContracts === 1 ? '' : 's'} active with ${money(band.feesInPipeline)} in fees riding`);
  }
  if (deadlines.length > 0) {
    const n = deadlines[0];
    parts.push(`next deadline: ${n.kind === 'emd' ? 'EMD' : 'Closing'} — ${n.address} · ${whenText(n)}`);
  }
  if (band.revenueYear > 0) {
    parts.push(`${money(band.revenueYear)} closed this year`);
  }
  if (parts.length === 0) {
    return 'Your office is ready — add your first lead and this board lights up with your real numbers.';
  }
  return parts.join(' · ') + '.';
}

export default function CommandCenter({ userId, onNavigate }: { userId: string; onNavigate: (view: string) => void }) {
  const [band, setBand] = useState<DashboardBandData | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [company, setCompany] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadFollowUpStreak(userId).then((n) => { if (live) setStreak(n); }).catch(() => {});
    Promise.all([
      loadDashboardBand(userId),
      loadDeadlines(userId).catch(() => [] as DeadlineItem[]),
      loadSellerPageSettings(userId).then((s) => (s ? s.company : '')).catch(() => ''),
    ])
      .then(([b, d, c]) => { if (live) { setBand(b); setDeadlines(d); setCompany(c || ''); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [userId]);

  if (failed) return null;

  const now = new Date();
  const dateLine = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const flow = band ? [
    { label: 'Leads in play', value: band.stages.leadsInPlay, bg: '#1e293b' },
    { label: 'In negotiation', value: band.stages.inNegotiation, bg: '#1e3a5f' },
    { label: 'Under contract', value: band.stages.underContract, bg: '#1d4ed8' },
    { label: 'Ready to close', value: band.stages.readyToClose, bg: '#059669' },
  ] : [];

  const tiles: { icon: string; title: string; sub: string; view: string }[] = [
    { icon: '➕', title: 'Add a lead', sub: 'Type it, paste a listing, import a list, or share your seller page', view: 'leads' },
    { icon: '📞', title: 'Work the call queue', sub: 'Today\u2019s follow-ups, hottest first', view: 'leads' },
    { icon: '💬', title: 'Comms Center', sub: 'Consent-checked calls, texts and email — one tap at a time', view: 'comms' },
    { icon: '📝', title: 'Contracts & closing', sub: 'Sign, escrow, and every deadline on one desk', view: 'contracts' },
    { icon: '💵', title: 'Cash buyers', sub: 'Buy boxes, proven closers, and who to call first', view: 'buyers' },
    { icon: '🗂️', title: 'Counties & auctions', sub: 'Official records, clerk sales, and government auctions', view: 'records' },
  ];

  return (
    <section className="ws-cc">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="ws-cc-dot" aria-hidden="true" />
        <span style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 700 }}>
          Command Center · Live
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#94a3b8' }}>{dateLine}</span>
      </div>

      <h2 style={{ fontSize: 27, margin: '10px 0 4px', color: '#fff' }}>
        {greetingFor(now)}{company ? `, ${company}` : ''}.
      </h2>
      <p style={{ fontSize: 15, color: '#cbd5e1', margin: '0 0 18px', maxWidth: 860 }}>
        {band ? briefingLine(band, deadlines) : 'Loading your numbers…'}
      </p>
      {streak !== null && (
        <p style={{ fontSize: 13.5, color: streak > 0 ? '#4ade80' : '#94a3b8', margin: '-8px 0 16px' }}>
          {streak > 0
            ? `🔥 Follow-up streak: you worked your leads ${streak} of the last 7 days. Follow-up is the business.`
            : 'No follow-ups logged in the last 7 days — one call today starts the streak.'}
        </p>
      )}

      {band && (
        <>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {flow.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 150px' }}>
                <div style={{ background: s.bg, borderRadius: 12, padding: '12px 14px', flex: '1 1 auto', border: '1px solid rgba(148,163,184,0.25)' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: 12.5, color: '#cbd5e1' }}>{s.label}</div>
                </div>
                {i < flow.length - 1 && <span style={{ color: '#10b981', fontWeight: 800, fontSize: 16 }}>→</span>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, color: '#e2e8f0', marginBottom: 18 }}>
            <span>💰 <strong>{money(band.revenueMonth)}</strong> closed this month ({band.revenueMonthCount})</span>
            <span>🏆 <strong>{money(band.revenueYear)}</strong> this year ({band.revenueYearCount} closing{band.revenueYearCount === 1 ? '' : 's'})</span>
            <span>💵 <strong>{band.buyersTotal}</strong> cash buyers · {band.buyersWithClosings} with closings here</span>
            <span>🔒 <strong>{money(band.feesInPipeline)}</strong> in fees riding on signed contracts</span>
          </div>
        </>
      )}

      <div className="ws-cc-grid">
        {tiles.map((t) => (
          <button key={t.title} type="button" className="ws-cc-tile" onClick={() => onNavigate(t.view)}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5, color: '#fff', marginTop: 4 }}>{t.title}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>{t.sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
