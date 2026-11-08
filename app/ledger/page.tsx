import React from 'react';
import type { Metadata } from 'next';
import { LEDGER, LEDGER_INTRO } from '../../lib/ledger';

// Slice 98 — the Verification Ledger. The public, permanent
// record behind the platform's honesty claims (the Uncopyable
// Set, part 1): every shipped slice, what its live verification
// checked, and — where a proof waits on a first real event —
// that deferral, named. Slices 1–47 built the foundation in
// October–early November 2026 and were verified in their day;
// this ledger's per-slice form begins at Slice 48.

export const metadata: Metadata = {
  title: 'Verification Ledger — WholesalingOS',
  description: 'The public record of what was actually checked, live, for every feature WholesalingOS has shipped — including the proofs still waiting on a first real event.',
  alternates: { canonical: '/ledger' },
};

const wrap: React.CSSProperties = { maxWidth: 860, margin: '0 auto' };
const panel: React.CSSProperties = { background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 };

export default function LedgerPage() {
  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS — Verification Ledger</p>
      <section style={panel}>
        <h1>The Verification Ledger</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65 }}>{LEDGER_INTRO}</p>
        <p style={{ fontSize: 13.5, color: '#94a3b8' }}>
          The foundation (Slices 1–47: accounts, portals, leads, contracts, escrow, county coverage, comms,
          sending gates, search, the seller page) shipped October–early November 2026 and was live-verified in
          its day. The per-slice record below begins at Slice 48. Companion page:{' '}
          <a href="/verify" style={{ color: '#7dd3fc' }}>How We Verify</a>.
        </p>
      </section>
      <section style={panel}>
        {LEDGER.map((e) => (
          <div key={e.slice} style={{ borderBottom: '1px solid rgba(148,163,184,0.18)', padding: '12px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              Slice {e.slice} — {e.title} <span style={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 400 }}>· {e.date}</span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '5px 0 0', color: '#e2e8f0' }}>
              <strong style={{ color: '#6ee7b7' }}>Verified live:</strong> {e.verified}
            </p>
            {e.deferred && (
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: '4px 0 0', color: '#fbbf24' }}>
                <strong>Still to prove:</strong> {e.deferred}
              </p>
            )}
          </div>
        ))}
        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 14 }}>
          This ledger is updated in the same release as each new slice. A feature without an entry here has
          not shipped — whatever anyone says about it.
        </p>
      </section>
    </div>
  );
}
