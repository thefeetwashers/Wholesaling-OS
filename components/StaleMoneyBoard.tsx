'use client';

import { useEffect, useState } from 'react';
import { loadStaleMoney, type StaleItem } from '../lib/stale-money';
import ProofCaption from './ProofCaption';

// Slice 76 — stale-money board. Shows only when money is actually
// sitting still in one of the three recorded situations (see
// lib/stale-money.ts); when nothing is stale the board renders
// nothing at all, so a clean dashboard stays clean.

const WORD: Record<StaleItem['kind'], string> = {
  closing_passed: 'closing date passed, file still open — fee riding',
  emd_overdue: 'EMD deadline passed, not marked received',
  disbursement_waiting: 'disbursement not marked received',
};

export default function StaleMoneyBoard({ userId }: { userId: string }) {
  const [state, setState] = useState<{ items: StaleItem[]; total: number } | null>(null);

  useEffect(() => {
    let live = true;
    loadStaleMoney(userId).then((s) => { if (live) setState(s); }).catch(() => { /* board stays hidden rather than guessing */ });
    return () => { live = false; };
  }, [userId]);

  if (!state || state.items.length === 0) return null;
  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  return (
    <section style={{ background: '#450a0a', border: '1px solid #f59e0b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>💰 Money sitting still — {money(state.total)} across {state.items.length} item{state.items.length === 1 ? '' : 's'}</h2>
      <ProofCaption>Every item below is a recorded date or amount in your own files — a closing date that passed, an EMD deadline unmet, a disbursement waiting. Nothing projected, nothing guessed.</ProofCaption>
      <p style={{ fontSize: 12.5, color: '#fca5a5' }}>
        Counted from your own records only. Each line names the recorded situation — work the oldest first.
      </p>
      {state.items.map((i, j) => (
        <p key={j} style={{ fontSize: 14, margin: '6px 0' }}>
          <strong>{i.label}</strong> — {WORD[i.kind]}
          {i.amount != null ? ` · ${money(i.amount)}` : ''} · {i.daysStale} day{i.daysStale === 1 ? '' : 's'} stale
        </p>
      ))}
    </section>
  );
}
