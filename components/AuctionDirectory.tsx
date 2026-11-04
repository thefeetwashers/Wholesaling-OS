'use client';

import { AUCTION_GROUPS, AUCTION_DIRECTORY_VERIFIED_AT } from '../lib/auction-directory';

// Slice 40 — Government & Auction Sales directory. Links only: the
// platform fetches nothing from these sites and never presents their
// inventory as its own. Every entry was opened and confirmed before
// listing (see lib/auction-directory.ts for what was deliberately
// excluded and why). Commercial platforms are labeled commercial —
// a .com running government surplus is not a government site.

export default function AuctionDirectory() {
  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Government &amp; Auction Sales — Official Sources</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>
        Where government and court-ordered property is actually sold. Every link below was opened and
        confirmed on {AUCTION_DIRECTORY_VERIFIED_AT}. The platform pulls no listings from these sites —
        you register and bid on the official site, under its rules (bid deposits, registration deadlines,
        buyer premiums where they apply). When you win or research a property there, bring it into Leads
        with the import inbox or paste parser and its source stays attached.
      </p>
      {AUCTION_GROUPS.map((g) => (
        <div key={g.title}>
          <h3 style={{ marginBottom: 6 }}>{g.title}</h3>
          <ul style={{ fontSize: 13.5, marginTop: 0 }}>
            {g.sources.map((s) => (
              <li key={s.url} style={{ marginBottom: 6 }}>
                <a href={s.url} target="_blank" rel="noreferrer"><strong>{s.name}</strong></a>
                {' — '}{s.covers}
                <br />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Run by: {s.operator} · Link verified {AUCTION_DIRECTORY_VERIFIED_AT}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
        County sale sites that sit behind bot protection aren't linked directly yet — the Clerk pages
        above link them officially, and a county joins this list directly only after a live confirmation,
        never by guessing a URL pattern.
      </p>
    </section>
  );
}
