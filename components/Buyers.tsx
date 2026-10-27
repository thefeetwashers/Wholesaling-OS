'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadBuyers, saveBuyer, statesFromInput, type BuyerRow } from '../lib/buyers';

// Buyer CRM, ported from the old prototype. Buyers are the wholesaler's own list only.
// No list of "all buyers in the US" exists — the user builds this list themselves.
// Buyer Demand Map below counts only buyers entered here, labeled as such.
interface Buyer { name: string; type: string; states: string; buy_box: string; tier: number; verified_pof: boolean; }

export default function Buyers({ userId }: { userId: string | null }) {
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [form, setForm] = useState<Buyer>({ name: '', type: 'cash_buyer', states: '', buy_box: '', tier: 3, verified_pof: false });
  const [mode, setMode] = useState<'local' | 'synced'>('local');

  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadBuyers(userId).then((rows) => { if (rows) { setBuyers(rows); setMode('synced'); } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addBuyer = async () => {
    if (!form.name.trim()) return;
    let saved: BuyerRow = { name: form.name, buyer_type: form.type, states: statesFromInput(form.states), buy_box: form.buy_box, tier: form.tier, verified_pof: form.verified_pof, id: `local-${Date.now()}` };
    if (userId && supabaseConfigured) {
      const row = await saveBuyer(userId, saved).catch(() => null);
      if (row) saved = row;
    }
    setBuyers([saved, ...buyers]);
    setForm({ name: '', type: 'cash_buyer', states: '', buy_box: '', tier: 3, verified_pof: false });
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Buyers — Your Buyer List + Demand Map</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Your private buyer list only. It is never shared with other users and never shown to the owner as raw rows.
        The demand count below is buyers YOU entered, by state — not live corporate orders.
      </p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <input placeholder="Buyer name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="cash_buyer">Cash buyer</option><option value="hedge_fund">Hedge fund</option>
          <option value="landlord">Landlord</option><option value="builder">Builder</option>
        </select>
        <input placeholder="States, e.g. FL" value={form.states} onChange={(e) => setForm({ ...form, states: e.target.value })} />
        <input placeholder="Buy box, e.g. single-family under 70% ARV in 34982" value={form.buy_box} onChange={(e) => setForm({ ...form, buy_box: e.target.value })} />
        <label>Tier <input type="number" min={1} max={3} value={form.tier} onChange={(e) => setForm({ ...form, tier: Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={form.verified_pof} onChange={(e) => setForm({ ...form, verified_pof: e.target.checked })} /> Proof of funds verified</label>
        <button onClick={addBuyer}>Add buyer</button>
      </div>
      {buyers.length === 0 && <p>No buyers yet. Add your first buyer above. Empty areas mean: no buyer data yet.</p>}
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Mode: {mode === 'synced' ? 'Synced to Supabase (your rows only, RLS)' : 'Local only — sign in with Supabase configured to sync.'}</p>
      <ul>{buyers.map((b) => <li key={b.id || b.name}><strong>{b.name}</strong> — {b.buyer_type}, {(b.states || []).join(', ')}, Tier {b.tier}, POF: {b.verified_pof ? 'Yes' : 'No'} — {b.buy_box}</li>)}</ul>
    </section>
  );
}
