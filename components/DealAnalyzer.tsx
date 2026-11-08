'use client';

import { useEffect, useState } from 'react';
import { calculateMAO, totalMarketplaceCost, isOverMAO } from '../lib/mao';
import { suggestAssignmentFee, type PropertyKind } from '../lib/fee-guide';
import { ESTIMATE_TOTAL_KEY } from '../lib/estimator';

export default function DealAnalyzer() {
  const [arv, setArv] = useState(300000);
  const [contractPrice, setContractPrice] = useState(150000);
  const [repairs, setRepairs] = useState(50000);
  const [fromEstimator, setFromEstimator] = useState(false);

  // Slice 79 — the Repair Estimator feeds this field: a live event
  // when its "Use this total" button is tapped, and the saved total
  // on mount so the figure survives navigation. The note under the
  // field says where the number came from; it stays fully editable.
  useEffect(() => {
    const apply = (total: number) => { setRepairs(total); setFromEstimator(true); };
    try {
      const saved = localStorage.getItem(ESTIMATE_TOTAL_KEY);
      if (saved && Number(saved) > 0) apply(Number(saved));
    } catch { /* no saved estimate — the default stands */ }
    const onEstimate = (e: Event) => {
      const total = (e as CustomEvent).detail;
      if (typeof total === 'number') apply(total);
    };
    window.addEventListener('ws-repair-estimate', onEstimate);
    return () => window.removeEventListener('ws-repair-estimate', onEstimate);
  }, []);
  const [fee, setFee] = useState(10000);
  const [customFee, setCustomFee] = useState('');
  const [kind, setKind] = useState<PropertyKind>('house');
  const guide = suggestAssignmentFee(kind, arv, repairs, contractPrice);

  const mao = calculateMAO(arv, repairs, fee);
  const total = totalMarketplaceCost(contractPrice, fee);
  const over = isOverMAO(contractPrice, mao);

  return (
    <section id="deal-analyzer" style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Deal Analyzer — MAO</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        MAO = (ARV × 0.70) − Repairs − Assignment Fee. Seller A-B view shows
        price only; buyer B-C view shows the full breakdown. Contracts
        require attorney review before use.
      </p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <label>ARV $ <input type="number" value={arv} onChange={(e) => setArv(Number(e.target.value))} /></label>
        <label>Contract price $ <input type="number" value={contractPrice} onChange={(e) => setContractPrice(Number(e.target.value))} /></label>
        <label>Repairs $ <input type="number" value={repairs} onChange={(e) => { setRepairs(Number(e.target.value)); setFromEstimator(false); }} /></label>
        {fromEstimator && (
          <p style={{ fontSize: 12.5, color: '#6ee7b7', margin: 0 }}>Set from your Repair Estimator — edit freely.</p>
        )}
        <div>
          <button onClick={() => setFee(10000)}>$10,000 fee</button>{' '}
          <button onClick={() => setFee(20000)}>$20,000 fee</button>{' '}
          <input
            placeholder="Custom fee"
            value={customFee}
            onChange={(e) => { setCustomFee(e.target.value); if (e.target.value) setFee(Number(e.target.value)); }}
            style={{ width: 120 }}
          />
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Assignment fee guide</div>
          <div style={{ margin: '8px 0' }}>
            <button onClick={() => setKind('house')}>🏠 House</button>{' '}
            <button onClick={() => setKind('land')}>🌳 Land</button>
          </div>
          <p style={{ margin: '4px 0', fontSize: 13.5 }}>Room in this deal: <strong>${guide.room.toLocaleString()}</strong> <span style={{ color: '#94a3b8' }}>(buyer budget at the 70% rule, minus your contract price)</span></p>
          <p style={{ margin: '4px 0', fontSize: 13.5 }}>Suggested fee: <strong>${guide.suggested.toLocaleString()}</strong></p>
          <p style={{ margin: '4px 0', fontSize: 12.5, color: '#94a3b8' }}>{guide.note}</p>
          {guide.suggested > 0 && (
            <button onClick={() => { setFee(guide.suggested); setCustomFee(String(guide.suggested)); }}>Use suggested fee</button>
          )}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <p><strong>MAO: ${mao.toLocaleString()}</strong></p>
        <p>Total Marketplace Cost (price + fee): ${total.toLocaleString()}</p>
        {over && <p style={{ color: '#f87171' }}>⚠️ Over MAO — contract price is above MAO. Do not proceed on this price without reworking it.</p>}
        {!over && <p style={{ color: '#4ade80' }}>Within MAO.</p>}
      </div>
    </section>
  );
}
