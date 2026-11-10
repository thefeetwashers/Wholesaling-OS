'use client';

// Slice 117 — Platform Health (Admin, owner-only). The dated
// cliffs and standing limits from lib/platform-health.ts, with
// countdowns computed from the recorded dates. The card reads no
// live service and says so: each line carries the date its fact
// was recorded, so a stale record is visible as one.

import { DATED_CLIFFS, STANDING_ITEMS, daysUntil } from '../lib/platform-health';

const OWNER_EMAIL = 'thefeetwashers@gmail.com';

export default function PlatformHealth({ userEmail }: { userEmail: string | null }) {
  if (userEmail !== OWNER_EMAIL) return null;
  const todayISO = new Date().toISOString().slice(0, 10);

  const cliffs = [...DATED_CLIFFS]
    .map((c) => ({ ...c, days: daysUntil(c.date, todayISO) }))
    .sort((a, b) => a.days - b.days);

  const countdown = (days: number): { text: string; color: string } => {
    if (days < 0) return { text: `${Math.abs(days)} day${days === -1 ? '' : 's'} past — act now`, color: '#f87171' };
    if (days === 0) return { text: 'today — act now', color: '#f87171' };
    if (days <= 30) return { text: `in ${days} day${days === 1 ? '' : 's'}`, color: '#f87171' };
    if (days <= 90) return { text: `in ${days} days`, color: '#fbbf24' };
    return { text: `in ${days} days`, color: '#94a3b8' };
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>🩺 Platform health — the cliffs, from the record</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px', maxWidth: 880 }}>
        Dated cliffs and standing limits, computed from facts recorded by hand — this card reads no live
        service, and every line shows the date its fact was recorded. When a fact changes, its record is
        updated; the card never guesses a status.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {cliffs.map((c) => {
          const cd = countdown(c.days);
          return (
            <div
              key={c.label}
              style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 14px' }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>
                {c.label}{' '}
                <span style={{ color: cd.color, fontWeight: 600 }}>
                  — {c.approx ? '~' : ''}{c.date} ({cd.text})
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 2 }}>{c.detail}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Recorded {c.asOf}</div>
            </div>
          );
        })}
      </div>
      <h3 style={{ fontSize: 14.5, margin: '16px 0 8px' }}>Standing limits &amp; open gates</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {STANDING_ITEMS.map((s) => (
          <div
            key={s.label}
            style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 14px' }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{s.label}</div>
            <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 2 }}>{s.detail}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Recorded {s.asOf}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
