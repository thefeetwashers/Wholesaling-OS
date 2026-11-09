'use client';

import { useState } from 'react';
import { loadContactEntries, type ContactEntryRow } from '../lib/distress';
import { loadPassportTouches, consentWord, passportGaps, passportCsv, passportHtml, type TouchRow } from '../lib/passport';
import { openPrintWindow } from '../lib/letter-identity';
import type { Lead } from '../lib/leads';

// Slice 101 — the per-lead Consent Passport panel. Assembles
// the contact's provenance + consent trail from records the
// platform already keeps, shows the gaps in the open, and
// exports the file (print + CSV) for the deal folder. It
// records; it never back-fills: what is missing stays missing
// on the page, which is the warning and the defense alike.

export default function ConsentPassport({ userId, lead }: { userId: string; lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ContactEntryRow[] | null>(null);
  const [touches, setTouches] = useState<TouchRow[] | null>(null);
  const [err, setErr] = useState('');

  const load = async () => {
    setOpen((v) => !v);
    if (entries !== null || !lead.id) return;
    try {
      const [e, t] = await Promise.all([loadContactEntries(userId, lead.id), loadPassportTouches(userId, lead.id)]);
      setEntries(e); setTouches(t);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not load the passport.'); setEntries([]); setTouches([]); }
  };

  const gaps = entries ? passportGaps(lead, entries) : [];

  const downloadCsv = () => {
    if (!entries || !touches) return;
    const blob = new Blob([passportCsv({ lead, entries, touches, gaps })], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'consent-passport.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <span style={{ display: 'block', marginTop: 6 }}>
      <button onClick={load}>🛂 Consent Passport</button>
      {open && (
        <span style={{ display: 'block', background: 'rgba(2,6,23,0.35)', border: '1px solid rgba(125,211,252,0.35)', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>🛂 Consent Passport — where this contact came from, and what you may do with it</span>
          {err && <span style={{ display: 'block', fontSize: 12.5, color: '#fca5a5' }}>{err}</span>}
          {entries === null ? (
            <span style={{ display: 'block', fontSize: 12.5, color: '#94a3b8' }}>Loading…</span>
          ) : (
            <>
              <span style={{ display: 'block', fontSize: 12.5, marginTop: 4 }}>
                Consent: <strong>{consentWord(lead.consent_status)}</strong>
                {lead.consent_at ? ' · recorded ' + String(lead.consent_at).slice(0, 10) : ''}
                {lead.consent_source ? ' · via ' + lead.consent_source : ''}
                {lead.do_not_contact ? ' · ⛔ DO NOT CONTACT' : ''}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, marginTop: 4 }}>
                Contact entries: {entries.length === 0 ? 'none on file' : entries.map((e) => `${e.kind} · from ${e.source} · ${e.entered_on}`).join(' | ')}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, marginTop: 4 }}>
                Logged touches: {touches && touches.length ? touches.map((t) => `${String(t.created_at).slice(0, 10)} ${t.channel} (${t.status})`).join(' | ') : 'none logged'}
              </span>
              {gaps.map((g) => (
                <span key={g} style={{ display: 'block', fontSize: 12.5, color: '#fbbf24', marginTop: 4 }}>⚠️ {g}</span>
              ))}
              {gaps.length === 0 && <span style={{ display: 'block', fontSize: 12.5, color: '#6ee7b7', marginTop: 4 }}>✓ Consent and provenance are on record for this contact.</span>}
              <span style={{ display: 'block', marginTop: 8 }}>
                <button onClick={() => touches && openPrintWindow('Consent Passport', passportHtml({ lead, entries, touches, gaps }))}>Print passport</button>{' '}
                <button onClick={downloadCsv}>Download CSV</button>
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
