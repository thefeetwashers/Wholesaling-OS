'use client';

import { useEffect, useState } from 'react';
import { loadMarketWatch, type WatchCard } from '../lib/market-watch';

// Slice 83 — Market Watch (dashboard). One card per distress list
// the wholesaler has actually worked, built from their own tag
// stamps: last observed date, open leads it produced, and whether
// the suggested re-pull rhythm says it is due. Nothing here is
// scraped or estimated — no tags, no board.

function todayYmd(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function agoLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export default function MarketWatch({ userId }: { userId: string }) {
  const [cards, setCards] = useState<WatchCard[] | null>(null);
  const [untouched, setUntouched] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    loadMarketWatch(userId, todayYmd())
      .then((r) => { if (live) { setCards(r.cards); setUntouched(r.untouched); } })
      .catch(() => { if (live) setCards([]); });
    return () => { live = false; };
  }, [userId]);

  if (cards === null) return null;

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🔭 Market watch — when did you last pull each list?</h2>
      {cards.length === 0 ? (
        <p style={{ fontSize: 13.5, color: '#cbd5e1' }}>
          No distress tags yet. When you pull a list using the playbooks (in Counties &amp; Title) and stamp
          what you found on a lead — a Vacant tag, a Code violation tag, with the date you observed it —
          this board starts tracking every list you work: when you last pulled it, what it produced, and
          when it is due again.
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
            {cards.map((c) => (
              <div key={c.tag} style={{ background: '#0f172a', borderRadius: 10, padding: 14 }}>
                <strong>{c.label}</strong>
                <p style={{ fontSize: 13, color: '#cbd5e1', margin: '6px 0 0' }}>
                  {c.openLeads} open lead{c.openLeads === 1 ? '' : 's'} · last pulled {c.lastObserved} ({agoLabel(c.daysAgo)})
                </p>
                <p style={{ fontSize: 13, margin: '4px 0 0', color: c.due ? '#fbbf24' : '#94a3b8' }}>
                  {c.due
                    ? `⏰ Due for a re-pull — suggested rhythm is every ${c.rhythmDays} days`
                    : `Suggested rhythm: re-pull every ${c.rhythmDays} days`}
                </p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
            Built from the tags and observed-on dates you stamped on your leads — your own pull history,
            nothing scraped. The rhythms are a suggested working routine; each county publishes on its
            own schedule.
          </p>
        </>
      )}
      {untouched.length > 0 && cards.length > 0 && (
        <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
          Lists you have not worked yet: {untouched.join(' · ')} — the playbooks for each are in Counties &amp; Title.
        </p>
      )}
    </section>
  );
}
