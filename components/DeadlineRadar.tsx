'use client';

import { useEffect, useState } from 'react';
import { loadDeadlines, type DeadlineItem } from '../lib/deadlines';

// Slice 45 — deadline radar under the dashboard band: EMD deadlines
// and target closing dates from the wholesaler's own escrow files,
// worst-first. Deals die quietly on missed dates; this is the
// countdown that speaks up.

export default function DeadlineRadar({ userId }: { userId: string }) {
  const [items, setItems] = useState<DeadlineItem[] | null>(null);

  useEffect(() => {
    let live = true;
    loadDeadlines(userId).then((rows) => { if (live) setItems(rows); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [userId]);

  if (items === null) return null;

  const icon = (d: DeadlineItem) => (d.daysLeft < 0 ? '🔴' : d.daysLeft <= 7 ? '🟡' : '⚪');
  const when = (d: DeadlineItem) =>
    d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} day${Math.abs(d.daysLeft) === 1 ? '' : 's'} OVERDUE`
    : d.daysLeft === 0 ? 'TODAY'
    : `in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`;

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Deadline radar</h2>
      {items.length === 0 && (
        <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0 }}>
          No deadlines on the calendar. EMD deadlines and closing dates from your escrow files will
          count down here — the dates you recorded, nothing projected.
        </p>
      )}
      {items.slice(0, 6).map((d, i) => (
        <p key={i} style={{ fontSize: 14, margin: '6px 0' }}>
          {icon(d)} <strong>{d.kind === 'emd' ? 'EMD' : 'Closing'} — {when(d)}</strong>
          {' '}· {d.address} · {d.dateISO} · <span style={{ color: '#94a3b8' }}>{d.detail}</span>
        </p>
      ))}
      {items.length > 6 && <p style={{ fontSize: 12.5, color: '#94a3b8', margin: 0 }}>+ {items.length - 6} more in Contracts &amp; Closing.</p>}
    </section>
  );
}
