'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Slice 53 — the live auction feed panel (BidProwl). Real, live
// government auction lots in the real-estate category, fetched
// server-side by /api/auctions (the platform's own free key, cached
// 30 minutes). Every lot links back to its official source — you
// bid there, never here — and nothing from the feed is stored.
// Until the owner connects the free BidProwl key, the panel says
// exactly that (the Slice 44 dark-until-lit pattern).

interface Lot {
  id: string;
  title: string;
  city: string;
  state: string;
  currentBid: number | null;
  numBids: number | null;
  endDate: string | null;
  sourceName: string;
  url: string;
}

const STATES = ['FL', 'TX', 'GA', 'NC', 'SC', 'OH', 'PA', 'CA', 'NY', 'ALL'];
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export default function AuctionFeed({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [state, setState] = useState('FL');
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLots(null);
    setError('');
    (async () => {
      try {
        if (!supabase) { if (live) setConfigured(false); return; }
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) { if (live) setConfigured(false); return; }
        const res = await fetch(`/api/auctions?state=${state}`, { headers: { authorization: `Bearer ${token}` } });
        const j = (await res.json()) as { configured?: boolean; lots?: Lot[]; error?: string };
        if (!live) return;
        setConfigured(!!j.configured);
        setLots(j.lots || []);
        if (j.error) setError(j.error);
      } catch {
        if (live) { setConfigured(true); setLots([]); setError('The auction feed could not be reached just now.'); }
      }
    })();
    return () => { live = false; };
  }, [state]);

  return (
    <section style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>🔨 Live Auction Feed</h2>
        <span style={{ fontSize: 12.5, color: '#94a3b8' }}>Government real-estate auctions, happening now</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setState(s)}
              style={{ fontSize: 12.5, padding: '4px 10px', borderRadius: 999, background: state === s ? '#065f46' : '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.3)', cursor: 'pointer' }}
            >
              {s === 'ALL' ? 'All states' : s}
            </button>
          ))}
        </span>
      </div>

      {configured === null && <p style={{ fontSize: 13.5, color: '#94a3b8' }}>Loading the live feed…</p>}

      {configured === false && (
        <p style={{ fontSize: 13.5, color: '#cbd5e1', marginTop: 10 }}>
          <strong>The live feed isn&rsquo;t connected yet.</strong> It runs on the platform&rsquo;s own free
          BidProwl key (1,000 lookups a month, no card) placed in the hosting environment — never in the app.
          The moment that key lands, this panel fills with live government real-estate auctions. Until then,
          the Deal Radar above already takes you to every official sale site in one tap.
        </p>
      )}

      {configured === true && error && <p style={{ fontSize: 13.5, color: '#fbbf24', marginTop: 10 }}>{error}</p>}

      {configured === true && !error && lots !== null && lots.length === 0 && (
        <p style={{ fontSize: 13.5, color: '#94a3b8', marginTop: 10 }}>
          No live real-estate lots came back for {state === 'ALL' ? 'the whole country' : state} just now. Try another state, or check the official sites on the Deal Radar.
        </p>
      )}

      {configured === true && lots !== null && lots.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, marginTop: 12 }}>
          {lots.map((lot) => (
            <div key={lot.id} style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>{lot.title}</div>
              <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3 }}>
                {[lot.city, lot.state].filter(Boolean).join(', ') || 'Location on source site'} · {lot.sourceName}
              </div>
              <div style={{ fontSize: 13.5, color: '#e2e8f0', marginTop: 6 }}>
                {lot.currentBid !== null ? <>Current bid <strong>{money(lot.currentBid)}</strong></> : 'Bidding on source site'}
                {lot.numBids !== null ? ` · ${lot.numBids} bid${lot.numBids === 1 ? '' : 's'}` : ''}
                {lot.endDate ? ` · Ends ${lot.endDate.slice(0, 10)}` : ''}
              </div>
              <a href={lot.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#7dd3fc' }}>
                View &amp; bid at the source ↗
              </a>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 12, marginBottom: 0 }}>
        Live lots via <a href="https://bidprowl.com" target="_blank" rel="noreferrer" style={{ color: '#7dd3fc' }}>BidProwl</a> —
        you bid on the official source site; WholesalingOS takes no cut and stores none of this data.
        Found one worth chasing?{' '}
        <button type="button" onClick={() => onNavigate('leads')} style={{ fontSize: 12.5 }}>Add it as a lead →</button>
      </p>
    </section>
  );
}
