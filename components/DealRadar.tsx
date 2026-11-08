'use client';

import { AUCTION_GROUPS, type AuctionSource } from '../lib/auction-directory';

// Slice 49 — the Deal Radar: the official deal sources, one tap from
// the dashboard, so a wholesaler never has to go searching for them.
// Every link is an OFFICIAL government sale channel (or its labeled
// contractor) from the verified Slice 40/49 directory — the single
// source of truth in lib/auction-directory.ts. The platform pulls NO
// listings from these sites: no scraping, no auto-sync, no invented
// inventory. The wholesaler finds the property on the official site,
// registers/bids under that site's rules, and brings the property
// back here as a lead — where the analyzer, contracts and buyers are.

function pick(names: string[]): AuctionSource[] {
  const all: AuctionSource[] = [];
  for (const g of AUCTION_GROUPS) for (const s of g.sources) all.push(s);
  const out: AuctionSource[] = [];
  for (const n of names) {
    const hit = all.find((s) => s.name === n);
    if (hit) out.push(hit);
  }
  return out;
}

const SECTIONS: { title: string; names: string[] }[] = [
  {
    title: '🏛️ Seized & surplus — federal',
    names: ['Treasury Auctions', 'CWS Marketing Group', 'U.S. Marshals Service — Asset Forfeiture', 'GSA Real Estate Sales', 'Forfeiture.gov — forfeiture notices'],
  },
  {
    title: '🏠 Agency-owned homes',
    names: ['HUD HomeStore', 'Fannie Mae HomePath', 'Freddie Mac HomeSteps', 'FDIC — Real Estate & Property Sales'],
  },
  {
    title: '⚖️ Florida clerk sales — foreclosure & tax deed',
    names: ['Realauction — client directory', 'Broward County — foreclosure sales', 'Broward County — tax deed sales', 'St. Lucie County — foreclosure sales', 'Charlotte County — foreclosure & tax deed sales'],
  },
];

export default function DealRadar({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <section style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>🎯 Deal Radar</h2>
        <span style={{ fontSize: 12.5, color: '#94a3b8' }}>Official government deal sources — one tap, no searching</span>
      </div>
      <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 14px', maxWidth: 880 }}>
        This is the honest way deals flow in: <strong>you</strong> find the property on the official sale site and register or bid
        under that site&rsquo;s rules — WholesalingOS does not scrape these sites or copy their listings, and anyone who
        promises a machine that does is selling you a story. Find it there, then bring it back here and the machine
        takes over: analyze it, contract it, and put it in front of your buyers.
      </p>

      {SECTIONS.map((sec) => (
        <div key={sec.title} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{sec.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pick(sec.names).map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                title={`${s.operator} — ${s.covers}`}
                style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.3)', color: '#7dd3fc', borderRadius: 999, padding: '7px 13px', fontSize: 13, textDecoration: 'none' }}
              >
                {s.name} ↗
              </a>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>How a deal moves:</span>
        <span style={{ fontSize: 13, color: '#e2e8f0' }}>1 · Find it on an official site</span>
        <span style={{ color: '#10b981', fontWeight: 800 }}>→</span>
        <button type="button" onClick={() => onNavigate('leads')} style={{ fontSize: 13 }}>2 · Add it as a lead</button>
        <span style={{ color: '#10b981', fontWeight: 800 }}>→</span>
        <button type="button" onClick={() => onNavigate('leads')} style={{ fontSize: 13 }}>3 · Run the numbers</button>
        <span style={{ color: '#10b981', fontWeight: 800 }}>→</span>
        <button type="button" onClick={() => onNavigate('contracts')} style={{ fontSize: 13 }}>4 · Contract &amp; close</button>
        <span style={{ marginLeft: 'auto' }}>
          <button type="button" onClick={() => onNavigate('records')} style={{ fontSize: 13 }}>Open the full Counties &amp; Title desk (all sources) →</button>
        </span>
      </div>
    </section>
  );
}
