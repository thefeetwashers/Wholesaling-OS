'use client';

import { useState } from 'react';

// Dead Lead Watchlist + Sensitive/Probate guardrail, ported from the old prototype.
// Watchlist: Not Interested → re-check date → MANUAL clerk re-check → logged public-record
// event resurrects the lead. No scraping, no auto-contacting heirs.
// Probate: manual fields only, from a court filing the user checked themselves.
// While status is Research only / Do not contact, or the do-not-contact date has not passed,
// outreach is blocked here and the lead is excluded from nudges.
type Estate = 'Research only' | 'Probate filed' | 'Representative named' | 'Court approval needed' | 'Authority verified' | 'Do not contact';

export default function WatchlistProbate() {
  const [address, setAddress] = useState('');
  const [recheck, setRecheck] = useState('');
  const [resurrected, setResurrected] = useState(false);
  const [estate, setEstate] = useState<Estate>('Research only');
  const [dncUntil, setDncUntil] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const blocked = estate === 'Research only' || estate === 'Do not contact' || (dncUntil !== '' && dncUntil > today);

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Dead Lead Watchlist + Sensitive / Probate Guardrail</h2>
      <input placeholder="Lead property address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ marginRight: 8 }} />
      <label>Re-check date <input type="date" value={recheck} onChange={(e) => setRecheck(e.target.value)} /></label>
      <button onClick={() => setResurrected(true)} style={{ marginLeft: 8 }}>Log manual clerk re-check event</button>
      {resurrected && <p style={{ color: '#4ade80' }}><strong>Resurrected:</strong> {address || 'lead'} — a public-record event was logged by hand. Re-engage only with consent and TCPA care; do not auto-text.</p>}
      <hr />
      <label>Estate status <select value={estate} onChange={(e) => setEstate(e.target.value as Estate)}>
        <option>Research only</option><option>Probate filed</option><option>Representative named</option>
        <option>Court approval needed</option><option>Authority verified</option><option>Do not contact</option>
      </select></label>{' '}
      <label>Do not contact until <input type="date" value={dncUntil} onChange={(e) => setDncUntil(e.target.value)} /></label>
      {blocked
        ? <p style={{ color: '#f87171' }}><strong>Do not contact yet — authority not verified.</strong> Outreach is disabled for this lead. Heirs usually cannot legally sell before probate authority is verified.</p>
        : <p style={{ color: '#4ade80' }}><strong>Authority verified — outreach may proceed, with care.</strong></p>}
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Enter only what a court filing you checked yourself lists: case number, court, personal representative
        if publicly listed there, attorney if listed. Never scrape obituaries or auto-contact relatives.
      </p>
    </section>
  );
}
