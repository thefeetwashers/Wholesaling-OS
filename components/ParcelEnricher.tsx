// Slice 135 — Bulk FL Parcel Enricher UI.
//
// Paste up to 50 Florida parcel IDs (comma or line separated)
// and resolve owners + addresses in one statewide query of the
// FDOR cadastral roll, via POST /api/parcel-enrich (server-side
// only — the browser never calls the roll directly).
//
// Per-row skip-trace affordance, reusing the EXISTING pattern
// from lib/google-skip-trace.ts + components/ProbateLeads.tsx:
//   - Method 1 Google lookup link (googleLookupUrl) opens the
//     targeted search in a new tab — no key, no scraping.
//   - Phone/email are typed in by the wholesaler and saved into
//     COMPONENT STATE ONLY, stamped with source + date
//     ("Wholesaler-entered from Google search, <date>") — never
//     fetched by the platform, never written to the database
//     here, and never a contact (saving a number does not mark
//     anything Contacted).
// The shared GoogleSkipTraceModal was NOT reused: it requires an
// existing lead/probate row (target leadId) to save into, and an
// enricher row is not a lead until the wholesaler saves it as
// one. No bulk skip-trace button — one row at a time, human tap.
// No email/SMS blast, no auto-send.
//
// CSV export reads COMPONENT STATE (same Blob pattern as
// components/ProbateLeads.tsx downloadCsv: Blob, lines joined
// with '\r\n') — never DOM-scraped innerText — and includes any
// skip-traced phone/email saved for a row.
//
// Florida only; the roll is a yearly snapshot published each
// August and the county appraiser is the live record. No sample
// parcel IDs anywhere — empty input with neutral placeholder
// text only. No pre-filled money.

'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseParcelIdInput, PARCEL_ENRICH_MAX_IDS, type EnrichedParcelRow } from '../lib/parcel-enrich';
import { googleLookupUrl } from '../lib/google-skip-trace';

const money = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : `$${Math.round(v).toLocaleString()}`;

function mailingLine(row: EnrichedParcelRow): string {
  const street = row.mailingAddress || '';
  const tail = [row.mailingCity, row.mailingState, row.mailingZip].filter(Boolean).join(' ');
  if (street && tail) return `${street}, ${tail}`;
  return street || tail || '—';
}

interface SavedContact {
  phone: string;
  email: string;
  source: string;
}

export default function ParcelEnricher({ userId }: { userId: string | null }) {
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<EnrichedParcelRow[]>([]);
  const [summary, setSummary] = useState<{ requested: number; matched: number; unmatched: number; duplicates: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [contacts, setContacts] = useState<Record<number, SavedContact>>({});
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [draftPhone, setDraftPhone] = useState('');
  const [draftEmail, setDraftEmail] = useState('');

  if (!userId) return null;

  async function resolve() {
    setBusy(true);
    setError('');
    setMsg('');
    setRows([]);
    setSummary(null);
    setContacts({});
    setEditingRow(null);
    try {
      const ids = parseParcelIdInput(raw);
      if (ids.length === 0) {
        setError('Paste at least one parcel ID — one per line, or separated by commas.');
        return;
      }
      if (ids.length > PARCEL_ENRICH_MAX_IDS) {
        setError(`That is ${ids.length} parcel IDs — paste at most ${PARCEL_ENRICH_MAX_IDS} at a time. Split the list and run it in batches.`);
        return;
      }
      if (!supabase) {
        setError('Sign-in sync is not configured on this deployment.');
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError('Sign in to run the parcel enricher.');
        return;
      }
      const res = await fetch('/api/parcel-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ parcelIds: ids }),
      });
      const j = (await res.json()) as {
        rows?: EnrichedParcelRow[];
        requested?: number;
        matched?: number;
        unmatched?: number;
        duplicates?: number;
        error?: string;
      };
      if (j.error) {
        setError(j.error);
        return;
      }
      const list = j.rows || [];
      setRows(list);
      setSummary({
        requested: j.requested ?? ids.length,
        matched: j.matched ?? list.filter((r) => r.matched).length,
        unmatched: j.unmatched ?? list.filter((r) => !r.matched).length,
        duplicates: j.duplicates ?? list.filter((r) => r.duplicate).length,
      });
      if (list.length === 0) {
        setError('No rows came back — try again.');
      } else if ((j.unmatched ?? 0) > 0) {
        setMsg(`${j.matched ?? 0} matched, ${j.unmatched} with no match found on the roll — check those parcel IDs and try them again.`);
      }
    } catch {
      setError('The parcel enricher could not be reached just now.');
    } finally {
      setBusy(false);
    }
  }

  function openContactEditor(rowIndex: number) {
    const existing = contacts[rowIndex];
    setDraftPhone(existing?.phone || '');
    setDraftEmail(existing?.email || '');
    setEditingRow(rowIndex);
  }

  function saveContact(rowIndex: number) {
    const today = new Date().toISOString().slice(0, 10);
    setContacts((prev) => ({
      ...prev,
      [rowIndex]: {
        phone: draftPhone.trim(),
        email: draftEmail.trim(),
        source: `Wholesaler-entered from Google search, ${today}`,
      },
    }));
    setEditingRow(null);
    setMsg('Contact saved for this row — wholesaler-entered, not fetched by the platform. Saving a number is not a contact.');
  }

  // CSV export from COMPONENT STATE — same Blob pattern as
  // components/ProbateLeads.tsx downloadCsv. Includes any
  // skip-traced phone/email saved for a row.
  function downloadCsv() {
    const q = (v: string | number | null | undefined) => {
      const sVal = v === null || v === undefined ? '' : String(v);
      return /[",\n\r]/.test(sVal) ? `"${sVal.replace(/"/g, '""')}"` : sVal;
    };
    const header = [
      'parcel_id', 'status', 'duplicate', 'owner_name', 'property_address',
      'mailing_address', 'mailing_city', 'mailing_state', 'mailing_zip',
      'just_value', 'county', 'skip_trace_phone', 'skip_trace_email', 'skip_trace_source',
    ];
    const lines = [header.join(',')];
    rows.forEach((r, i) => {
      const c = contacts[i];
      lines.push([
        r.parcelId,
        r.status,
        r.duplicate ? 'Yes' : 'No',
        r.ownerName || '',
        r.propertyAddress || '',
        r.mailingAddress || '',
        r.mailingCity || '',
        r.mailingState || '',
        r.mailingZip || '',
        r.justValue ?? '',
        r.county || '',
        c?.phone || '',
        c?.email || '',
        c?.source || '',
      ].map(q).join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parcel-enricher-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Bulk parcel enricher — Florida only</h2>
      <p style={{ fontSize: 13.5, marginTop: 0, color: '#cbd5e1' }}>
        Paste up to {PARCEL_ENRICH_MAX_IDS} Florida parcel IDs and resolve owners and addresses in one
        query of the FDOR statewide cadastral roll. An ID with no match comes back as &ldquo;no match
        found&rdquo; — it never kills the batch. A parcel ID pasted twice, or one ID matching more than
        one roll row, is flagged Duplicate — rows are never silently dropped. The roll is a yearly
        snapshot published each August; the county appraiser is the live record. Nothing is stored
        until you save it.
      </p>
      <textarea
        rows={6}
        style={{ width: '100%', boxSizing: 'border-box' }}
        placeholder={'Paste parcel IDs — one per line, or separated by commas. Up to 50.'}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '6px 0 0' }}>
        {parseParcelIdInput(raw).length > 0
          ? `${parseParcelIdInput(raw).length} parcel ID${parseParcelIdInput(raw).length === 1 ? '' : 's'} pasted (max ${PARCEL_ENRICH_MAX_IDS}).`
          : 'No parcel IDs pasted yet.'}
      </p>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 0' }}>
        <button onClick={resolve} disabled={busy || parseParcelIdInput(raw).length === 0}>
          {busy ? 'Resolving…' : 'Resolve owners & addresses'}
        </button>
        {rows.length > 0 && (
          <button onClick={downloadCsv}>Export CSV ({rows.length} rows)</button>
        )}
      </p>
      {error && <p style={{ fontSize: 13.5, color: '#fbbf24' }}>{error}</p>}
      {msg && <p style={{ fontSize: 13.5 }}>{msg}</p>}
      {summary && rows.length > 0 && (
        <p style={{ fontSize: 13.5, color: '#cbd5e1' }}>
          {summary.requested} requested · {summary.matched} matched · {summary.unmatched} no match found
          {summary.duplicates > 0 ? ` · ${summary.duplicates} duplicate row${summary.duplicates === 1 ? '' : 's'} flagged` : ''}
        </p>
      )}
      {rows.length > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#cbd5e1' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}>Parcel ID</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}>Owner Name</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}>Property Street Address</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}>Owner Mailing Address</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}>Assessed / Just Value</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}>County</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}>Duplicate</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}>Skip trace</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = contacts[i];
                const editing = editingRow === i;
                return (
                  <tr key={`${r.parcelId}-${i}`} style={{ verticalAlign: 'top', background: i % 2 === 0 ? '#0f172a' : '#1e293b' }}>
                    <td style={{ padding: '8px' }}>{r.parcelId}</td>
                    <td style={{ padding: '8px' }}>{r.matched ? r.ownerName || '—' : 'no match found'}</td>
                    <td style={{ padding: '8px' }}>{r.matched ? r.propertyAddress || '—' : '—'}</td>
                    <td style={{ padding: '8px' }}>{r.matched ? mailingLine(r) : '—'}</td>
                    <td style={{ padding: '8px' }}>{r.matched ? money(r.justValue) : '—'}</td>
                    <td style={{ padding: '8px' }}>{r.matched ? (r.county ? `${r.county} County` : '—') : '—'}</td>
                    <td style={{ padding: '8px', color: r.duplicate ? '#fbbf24' : '#e2e8f0' }}>
                      {r.duplicate ? 'Yes — duplicate' : '—'}
                    </td>
                    <td style={{ padding: '8px', minWidth: 220 }}>
                      {r.matched ? (
                        <>
                          <a
                            href={googleLookupUrl(r.ownerName || '', r.propertyAddress || '')}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#7dd3fc', fontSize: 13 }}
                          >
                            Search Google ↗
                          </a>
                          <br />
                          {c && !editing && (
                            <span style={{ fontSize: 12.5, color: '#cbd5e1' }}>
                              {c.phone ? `Phone: ${c.phone}` : ''}
                              {c.phone && c.email ? ' · ' : ''}
                              {c.email ? `Email: ${c.email}` : ''}
                              {c.phone || c.email ? <br /> : null}
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>{c.source}</span>
                            </span>
                          )}
                          {editing ? (
                            <span style={{ display: 'block', marginTop: 6 }}>
                              <input
                                type="tel"
                                placeholder="Phone you found"
                                value={draftPhone}
                                onChange={(e) => setDraftPhone(e.target.value)}
                                style={{ width: '100%', marginBottom: 6, boxSizing: 'border-box' }}
                              />
                              <input
                                type="email"
                                placeholder="Email you found"
                                value={draftEmail}
                                onChange={(e) => setDraftEmail(e.target.value)}
                                style={{ width: '100%', marginBottom: 6, boxSizing: 'border-box' }}
                              />
                              <button type="button" onClick={() => saveContact(i)} style={{ fontSize: 12, padding: '4px 10px' }}>
                                Save contact for this row
                              </button>{' '}
                              <button type="button" onClick={() => setEditingRow(null)} style={{ fontSize: 12, padding: '4px 10px' }}>
                                Cancel
                              </button>
                              <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                                Only save a phone or email you actually verified against the source. Saving here is not a contact.
                              </span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openContactEditor(i)}
                              style={{ fontSize: 12, padding: '4px 10px', marginTop: 6 }}
                            >
                              {c ? 'Edit saved contact' : 'Add contact for this row'}
                            </button>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12.5 }}>No match — nothing to skip-trace.</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 0 }}>
        Florida only — a state joins this enricher only after its real parcel service is verified live.
        Skip-trace contacts are wholesaler-entered values with source + date, never fetched by the
        platform. No bulk skip-trace, no email or SMS blast, nothing auto-sent.
      </p>
    </section>
  );
}
