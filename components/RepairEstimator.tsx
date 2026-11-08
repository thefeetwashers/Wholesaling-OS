'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ADDONS, LEVELS, estimate, loadEstimatorState, saveEstimatorState,
  ESTIMATE_TOTAL_KEY, type EstimatorState, type RehabLevel,
} from '../lib/estimator';

// Slice 79 — repair estimator. Square feet × the wholesaler's own
// per-square-foot rate for the rehab level, plus flat add-ons at
// their own prices. The starting rates are labeled as starting
// points to replace with a contractor's real numbers — the panel
// never presents them as market data. "Use this total" hands the
// figure to the Deal Analyzer below (event + saved value), where
// it lands in the Repairs field, editable like any other input.

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export default function RepairEstimator() {
  const [state, setState] = useState<EstimatorState | null>(null);

  useEffect(() => { setState(loadEstimatorState()); }, []);
  useEffect(() => { if (state) saveEstimatorState(state); }, [state]);

  const result = useMemo(() => (state ? estimate(state) : null), [state]);
  if (!state || !result) return null;

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const set = (patch: Partial<EstimatorState>) => setState((s) => (s ? { ...s, ...patch } : s));

  const sendToAnalyzer = () => {
    try { localStorage.setItem(ESTIMATE_TOTAL_KEY, String(result.total)); } catch { /* event below still fires */ }
    window.dispatchEvent(new CustomEvent('ws-repair-estimate', { detail: result.total }));
    document.getElementById('deal-analyzer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const levelLabel = LEVELS.find((l) => l.key === state.level)?.label || '';

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🔨 Repair Estimator</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Your rates, your estimate. The per-square-foot figures below are starting points — replace them with
        your contractor's real numbers and they are saved on this device. An estimate is only as honest as
        the rates behind it; nothing here is market data or a quote.
      </p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <label>
          Living area (sq ft){' '}
          <input type="number" value={state.sqft} onChange={(e) => set({ sqft: num(e.target.value) })} />
        </label>
        <label>
          Rehab level{' '}
          <select value={state.level} onChange={(e) => set({ level: e.target.value as RehabLevel })}>
            {LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label} — {l.blurb}</option>)}
          </select>
        </label>
        <div style={{ display: 'grid', gap: 6 }}>
          {LEVELS.map((l) => (
            <label key={l.key} style={{ fontSize: 13.5 }}>
              {l.label} $/sq ft{' '}
              <input
                type="number"
                value={state.rates[l.key]}
                onChange={(e) => set({ rates: { ...state.rates, [l.key]: num(e.target.value) } })}
                style={{ width: 90 }}
              />
            </label>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {ADDONS.map((a) => (
            <div key={a.key} style={{ fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ minWidth: 150 }}>{a.label}</span>
              <span>
                $ <input
                  type="number"
                  value={state.prices[a.key]}
                  onChange={(e) => set({ prices: { ...state.prices, [a.key]: num(e.target.value) } })}
                  style={{ width: 100 }}
                /> {a.unit}
              </span>
              <span>
                qty{' '}
                <input
                  type="number"
                  value={state.qty[a.key]}
                  onChange={(e) => set({ qty: { ...state.qty, [a.key]: num(e.target.value) } })}
                  style={{ width: 60 }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '12px 14px', marginTop: 14, maxWidth: 520 }}>
        <div style={{ fontSize: 13.5 }}>
          Base — {state.sqft.toLocaleString('en-US')} sq ft × {money(state.rates[state.level])}/sq ft ({levelLabel}): <strong>{money(result.base)}</strong>
        </div>
        {result.addonLines.map((l) => (
          <div key={l.key} style={{ fontSize: 13.5 }}>{l.label}: <strong>{money(l.amount)}</strong></div>
        ))}
        <div style={{ fontSize: 16, marginTop: 6 }}>Estimated repairs: <strong>{money(result.total)}</strong></div>
        <button type="button" onClick={sendToAnalyzer} style={{ marginTop: 10, cursor: 'pointer' }}>
          Use this total in the Deal Analyzer ↓
        </button>
      </div>
    </section>
  );
}
