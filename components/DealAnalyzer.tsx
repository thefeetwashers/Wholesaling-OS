'use client';

import { useState } from 'react';
import { calculateMAO, totalMarketplaceCost, isOverMAO } from '../lib/mao';

export default function DealAnalyzer() {
  const [arv, setArv] = useState(300000);
  const [contractPrice, setContractPrice] = useState(150000);
  const [repairs, setRepairs] = useState(50000);
  const [fee, setFee] = useState(10000);
  const [customFee, setCustomFee] = useState('');

  const mao = calculateMAO(arv, repairs, fee);
  const total = totalMarketplaceCost(contractPrice, fee);
  const over = isOverMAO(contractPrice, mao);

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Deal Analyzer — MAO</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        MAO = (ARV × 0.70) − Repairs − Assignment Fee. Seller A-B view shows
        price only; buyer B-C view shows the full breakdown. Contracts
        require attorney review before use.
      </p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <label>ARV $ <input type="number" value={arv} onChange={(e) => setArv(Number(e.target.value))} /></label>
        <label>Contract price $ <input type="number" value={contractPrice} onChange={(e) => setContractPrice(Number(e.target.value))} /></label>
        <label>Repairs $ <input type="number" value={repairs} onChange={(e) => setRepairs(Number(e.target.value))} /></label>
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
