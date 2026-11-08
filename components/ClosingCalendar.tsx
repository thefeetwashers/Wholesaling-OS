'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadCalendarEntries, type CalendarEntry } from '../lib/calendar';

// Slice 76 — closing calendar. A plain month grid over the dates on
// the wholesaler's own records: EMD deadlines and target closings
// from open escrow files, follow-ups from open leads. Prev/next
// month buttons move the grid; tapping a day lists what is on it.

const KIND: Record<CalendarEntry['kind'], { emoji: string; word: string }> = {
  emd: { emoji: '💵', word: 'EMD due' },
  closing: { emoji: '🏁', word: 'Closing' },
  followup: { emoji: '📞', word: 'Follow-up' },
};

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function ClosingCalendar({ userId }: { userId: string }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadCalendarEntries(userId).then((e) => { if (live) setEntries(e); }).catch(() => { /* empty grid, honestly */ });
    return () => { live = false; };
  }, [userId]);

  const byDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    for (const e of entries) (map[e.dateISO] = map[e.dateISO] || []).push(e);
    return map;
  }, [entries]);

  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayISO = isoOf(now.getFullYear(), now.getMonth(), now.getDate());
  const monthEntries = entries.filter((e) => e.dateISO.startsWith(isoOf(cursor.y, cursor.m, 1).slice(0, 7)));
  const selectedEntries = selected ? byDate[selected] || [] : [];

  const move = (delta: number) => {
    setSelected(null);
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const cellBtn: React.CSSProperties = {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 8, minHeight: 54,
    padding: 4, textAlign: 'left', cursor: 'pointer', color: '#e2e8f0',
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>📅 Closing calendar</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => move(-1)} style={{ cursor: 'pointer' }}>← Prev</button>
          <strong>{monthName}</strong>
          <button type="button" onClick={() => move(1)} style={{ cursor: 'pointer' }}>Next →</button>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
        Only dates on your own records: 💵 EMD due · 🏁 Closing · 📞 Follow-up. Tap a day to see what is on it.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'center' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`x${i}`} />;
          const iso = isoOf(cursor.y, cursor.m, day);
          const dayEntries = byDate[iso] || [];
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(iso)}
              style={{
                ...cellBtn,
                border: iso === todayISO ? '1px solid #34d399' : cellBtn.border,
                outline: iso === selected ? '2px solid #38bdf8' : 'none',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>{day}</div>
              {dayEntries.slice(0, 3).map((e, j) => (
                <div key={j} style={{ fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {KIND[e.kind].emoji} {KIND[e.kind].word}
                </div>
              ))}
              {dayEntries.length > 3 && <div style={{ fontSize: 10.5 }}>+{dayEntries.length - 3} more</div>}
            </button>
          );
        })}
      </div>
      {selected && (
        <div style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 13.5 }}>
            {new Date(`${selected}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </strong>
          {selectedEntries.length === 0
            ? <p style={{ fontSize: 13, color: '#94a3b8' }}>Nothing recorded on this day.</p>
            : selectedEntries.map((e, j) => (
              <p key={j} style={{ fontSize: 13.5, margin: '4px 0' }}>{KIND[e.kind].emoji} {KIND[e.kind].word} — {e.label}</p>
            ))}
        </div>
      )}
      {!selected && monthEntries.length === 0 && (
        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 12 }}>
          No dates recorded this month — EMD deadlines and closings appear here from your escrow files,
          follow-ups from your leads.
        </p>
      )}
    </section>
  );
}
