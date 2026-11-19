// Slice 135 — Distressed Finder (public).
//
// Reads ONLY the 10 verified code-violation feeds in
// lib/distressed-feeds.ts — one feed per city, each queried live
// with its verified open filter. Nothing here is scraped, seeded,
// or invented: an empty feed reads as an empty table, an
// address-less row reads as address-unknown, and a feed that
// fails reads as its real error.
//
// Save-to-leads goes through the EXISTING distress importer —
// buildDistressLeads() + importLeads() from the CSV importer
// (components/CsvLeadImporter.tsx, lib/leads.ts) — with the
// distress tag code_violation, the importer's own dedupe, and
// its address-optional rule (a row with a case number but no
// address still becomes a lead, flagged "address needed"). There
// is NO direct insert into leads anywhere here, no bulk
// skip-trace button, no email/SMS blast, and nothing is sent
// automatically when a row is saved. The wholesaler saves one
// row at a time, by tapping, after signing in.
//
// CSV export reads from COMPONENT STATE only (the loaded rows
// plus any skip-traced phone/email saved on them) — the same
// Blob + lines.join('\r\n') pattern as ProbateLeads. It never
// scrapes the DOM.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { openCopilot, redactPhoneNumbers } from '../lib/ai-copilot';
import { loadLeads, importLeads, type Lead } from '../lib/leads';
import { buildDistressLeads } from './CsvLeadImporter';
import {
  DISTRESSED_FEEDS,
  feedById,
  fetchFeedRows,
  fetchNolaViolationDetail,
  type DistressedFeed,
  type DistressedRow,
  type NolaViolationDetail,
} from '../lib/distressed-feeds';

const ROW_LIMIT = 25;

const panel: React.CSSProperties = { background: '#1e293b', borderRadius: 12, padding: 16, marginTop: 16 };
const warnBox: React.CSSProperties = {
  background: '#fef3c7',
  color: '#0f172a',
  border: '1px solid #f59e0b',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  marginTop: 12,
};
const okBox: React.CSSProperties = {
  background: '#ecfdf5',
  color: '#0f172a',
  border: '1px solid #10b981',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  marginTop: 12,
};
const errBox: React.CSSProperties = {
  background: '#fef2f2',
  color: '#0f172a',
  border: '1px solid #f87171',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  marginTop: 12,
};

function rowKey(feedId: string, index: number): string {
  return `${feedId}-${index}`;
}

// Slice 137 — "Analyze with AI" per row. The context summary
// carries city/state and the row's real violation description
// only — NEVER a street address, NEVER a parcel owner, NEVER a
// phone number. A field that is unknown is left out, never
// invented.
function distressedSummary(r: DistressedRow): string {
  const place = [r.city, r.state].filter(Boolean).join(', ');
  // Slice 141 (audit #15) — the violation description is free
  // text from the feed; redact phone-number-like patterns before
  // it reaches the AI. openCopilot() redacts again at the choke
  // point.
  const violation = redactPhoneNumbers((r.violation || '').trim());
  return violation
    ? `Distressed property, ${place} — active code violation: ${violation}`
    : `Distressed property, ${place}`;
}

const DISTRESSED_AUTO_QUESTION =
  'Write a compassionate cold-call opener and SMS for this distressed owner facing code enforcement.';

export default function DistressedFinder() {
  const [feedId, setFeedId] = useState('orlando');
  const [rows, setRows] = useState<DistressedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadedFeed, setLoadedFeed] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [savedContacts, setSavedContacts] = useState<Record<string, { phone: string; email: string }>>({});
  const [expandedKey, setExpandedKey] = useState('');
  const [nolaDetail, setNolaDetail] = useState<Record<string, NolaViolationDetail[]>>({});
  const [nolaBusy, setNolaBusy] = useState('');
  const [nolaError, setNolaError] = useState('');

  const feed = feedById(feedId);

  async function load(f: DistressedFeed) {
    setLoading(true);
    setLoadError('');
    setRows([]);
    setLoadedFeed('');
    setExpandedKey('');
    setSaveMsg('');
    try {
      const data = await fetchFeedRows(f, ROW_LIMIT);
      setRows(data);
      setLoadedFeed(f.id);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'That feed could not be loaded just now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(feedById('orlando'));
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setUserId(data.session?.user?.id || null);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickFeed(id: string) {
    setFeedId(id);
    load(feedById(id));
  }

  // After a save, read the matching lead back so any skip-traced
  // phone/email already saved on it shows in the table and in the
  // CSV export. Right after a save both are normally empty — the
  // Finder never invents contact details; they arrive only from
  // the wholesaler's own skip trace on the lead.
  async function refreshSavedContact(user: string, row: DistressedRow, key: string) {
    try {
      const leads = (await loadLeads(user)) || [];
      const match = leads.find((l: Lead) => {
        if (row.caseNumber && (l.notes || '').includes(`Case ${row.caseNumber}`)) return true;
        if (row.address && (l.property_address || '').trim().toLowerCase() === row.address.trim().toLowerCase()) return true;
        return false;
      });
      if (match) {
        setSavedContacts((prev) => ({
          ...prev,
          [key]: { phone: match.owner_phone || '', email: match.owner_email || '' },
        }));
      }
    } catch {
      // The save already succeeded; a failed contact re-read is
      // not an error worth surfacing.
    }
  }

  async function saveRow(row: DistressedRow, index: number) {
    const key = rowKey(row.feedId, index);
    if (!userId) {
      setSaveMsg('Sign in to save leads — this finder is public, but saving writes to your own pipeline. Sign in from the home page, then come back.');
      return;
    }
    setSavingKey(key);
    setSaveMsg('');
    try {
      const existing = (await loadLeads(userId)) || [];
      const f = feedById(row.feedId);
      const today = new Date().toISOString().slice(0, 10);
      const description = row.violationIsProxy
        ? `${row.violation} (case/request type — the closest label this feed carries; it has no violation-text field)`
        : row.violation;
      const { toInsert, dupes, noAddress, addressNeeded } = buildDistressLeads({
        rows: [[row.address, row.city, row.state, row.zip, row.county, row.parcelId, row.caseNumber, description]],
        mapping: {
          property_address: 0,
          city: 1,
          state: 2,
          zip: 3,
          county: 4,
          parcel_id: 5,
          case_number: 6,
          description: 7,
        },
        fileTag: 'code_violation',
        sourceLabel: `${f.sourceName} — ${f.datasetName}, ${f.city}, ${f.state} (Distressed Finder)`,
        fileName: `distressed-finder-${f.id}-${today}.csv`,
        existing,
      });
      if (toInsert.length === 0) {
        if (dupes > 0) {
          setSaveMsg('That row is already in your pipeline — it was skipped as a duplicate, nothing was added.');
        } else if (noAddress > 0) {
          setSaveMsg('That row has neither an address nor a case number, so it cannot become a lead — nothing was added and no address was invented.');
        } else {
          setSaveMsg('Nothing was added for that row.');
        }
        return;
      }
      let outcome = await importLeads(userId, toInsert, 250);
      // Same fallback as the CSV importer: if the Slice 123
      // distress columns are not applied yet, retry without them
      // (the tag already rides in the lead's notes).
      if (outcome.error && /distress_tag|is_absentee_owner/.test(outcome.error)) {
        const stripped = toInsert.map((l) => {
          const copy = { ...l } as unknown as Record<string, unknown>;
          delete copy.distress_tag;
          delete copy.is_absentee_owner;
          return copy as unknown as Lead;
        });
        outcome = await importLeads(userId, stripped, 250);
      }
      if (outcome.inserted > 0) {
        setSavedKeys((prev) => ({ ...prev, [key]: true }));
        setSaveMsg(
          `Saved to your leads with the code-violation tag${addressNeeded > 0 ? ' — flagged address needed (case number only; next step: clerk case lookup → appraiser mailing address)' : ''}.${outcome.error ? ` Note: ${outcome.error}` : ''}`
        );
        await refreshSavedContact(userId, row, key);
      } else {
        setSaveMsg(`The save did not go through: ${outcome.error || 'unknown error — nothing was added.'}`);
      }
    } catch (e) {
      setSaveMsg(`The save did not go through: ${e instanceof Error ? e.message : 'unknown error — nothing was added.'}`);
    } finally {
      setSavingKey('');
    }
  }

  async function toggleNolaDetail(row: DistressedRow, index: number) {
    const key = rowKey(row.feedId, index);
    if (expandedKey === key) {
      setExpandedKey('');
      return;
    }
    setExpandedKey(key);
    setNolaError('');
    if (nolaDetail[key] || !row.caseNumber) return;
    setNolaBusy(key);
    try {
      const detail = await fetchNolaViolationDetail(row.caseNumber);
      setNolaDetail((prev) => ({ ...prev, [key]: detail }));
    } catch (e) {
      setNolaError(e instanceof Error ? e.message : 'Violation detail could not be loaded.');
    } finally {
      setNolaBusy('');
    }
  }

  // CSV export from COMPONENT STATE only — the loaded rows plus
  // any skip-traced phone/email saved on them. Same Blob +
  // lines.join('\r\n') pattern as ProbateLeads. Never DOM-scraped.
  function downloadCsv() {
    const q = (v: string | null | undefined) => {
      const s = v || '';
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'City', 'State', 'Case Number', 'Address', 'Violation',
      'Violation Is Proxy Label', 'Opened', 'Status', 'Parcel', 'County',
      'Source', 'Saved To Leads', 'Saved Phone', 'Saved Email',
    ];
    const lines = [header.join(',')];
    rows.forEach((r, i) => {
      const key = rowKey(r.feedId, i);
      const contact = savedContacts[key] || { phone: '', email: '' };
      lines.push([
        r.city,
        r.state,
        r.caseNumber,
        r.addressUnknown ? 'Address unknown' : r.address,
        r.violation,
        r.violationIsProxy ? 'Yes — case/request type, not violation text' : 'No',
        r.openedDate,
        r.status,
        r.parcelId,
        r.county,
        `${feed.sourceName} — ${feed.datasetName}`,
        savedKeys[key] ? 'Yes' : 'No',
        contact.phone,
        contact.email,
      ].map(q).join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `distressed-finder-${feed.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/">← WholesalingOS home</Link> · <Link href="/deals">Off-market deals</Link> ·{' '}
        <Link href="/api-docs">API docs</Link>
      </p>
      <h1 style={{ fontSize: 28, margin: '8px 0 4px' }}>Distressed Finder — open code violations</h1>
      <p style={{ fontSize: 14, color: '#cbd5e1', marginTop: 0 }}>
        Open code-violation cases from 10 cities&apos; own public open-data feeds — read live, one
        feed at a time, with each feed&apos;s own open filter. No scraping, no bought lists, no
        invented addresses or violation text. A row is a lead to verify against the current
        county record, never a current fact on its own. Save a row to your pipeline only when
        you have checked it — one tap at a time, after signing in.
      </p>

      {feed.stale && (
        <div style={warnBox}>
          <strong>Stale data — {feed.city}.</strong> {feed.warning}
        </div>
      )}
      {feed.warning && !feed.stale && (
        <div style={warnBox}>
          <strong>{feed.city} warning.</strong> {feed.warning}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {DISTRESSED_FEEDS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => pickFeed(f.id)}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: 999,
              border: feedId === f.id ? '2px solid #0f172a' : '1px solid #cbd5e1',
              background: feedId === f.id ? '#0f172a' : '#fff',
              color: feedId === f.id ? '#fff' : '#0f172a',
              cursor: 'pointer',
            }}
          >
            {f.city}, {f.state}
            {f.stale ? ' (stale)' : ''}
          </button>
        ))}
      </div>

      {/* Per-feed honest sourcing label. */}
      <section style={panel} aria-label={`Source for ${feed.city}`}>
        <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>
          Source — {feed.city}, {feed.state}
        </h2>
        <dl style={{ fontSize: 13.5, margin: 0, display: 'grid', gridTemplateColumns: 'minmax(140px, 180px) 1fr', gap: '4px 12px' }}>
          <dt style={{ fontWeight: 700 }}>Source</dt>
          <dd style={{ margin: 0 }}>{feed.sourceName}</dd>
          <dt style={{ fontWeight: 700 }}>Dataset</dt>
          <dd style={{ margin: 0 }}>{feed.datasetName}</dd>
          <dt style={{ fontWeight: 700 }}>Endpoint</dt>
          <dd style={{ margin: 0, wordBreak: 'break-all' }}>
            <a href={feed.endpoint} target="_blank" rel="noreferrer">{feed.endpoint}</a>
          </dd>
          <dt style={{ fontWeight: 700 }}>What &ldquo;open&rdquo; means</dt>
          <dd style={{ margin: 0 }}>{feed.openMeaning}</dd>
          <dt style={{ fontWeight: 700 }}>Open filter</dt>
          <dd style={{ margin: 0 }}><code style={{ fontSize: 12.5 }}>{feed.openFilter}</code></dd>
          <dt style={{ fontWeight: 700 }}>Freshness</dt>
          <dd style={{ margin: 0 }}>{feed.freshness}</dd>
          <dt style={{ fontWeight: 700 }}>Verified</dt>
          <dd style={{ margin: 0 }}>{feed.verifiedDate} — endpoint, field names, and open filter checked live.</dd>
        </dl>
        {feed.note && <p style={{ fontSize: 13, color: '#cbd5e1', margin: '10px 0 0' }}>{feed.note}</p>}
      </section>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
        <button
          type="button"
          onClick={() => load(feed)}
          disabled={loading}
          style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Loading…' : `Reload open cases — ${feed.city}`}
        </button>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={rows.length === 0}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: rows.length === 0 ? 'not-allowed' : 'pointer', fontSize: 13, opacity: rows.length === 0 ? 0.5 : 1 }}
        >
          Download CSV ({rows.length})
        </button>
        <span style={{ fontSize: 13, color: '#cbd5e1' }}>
          Showing up to {ROW_LIMIT} open cases, newest first. {userId ? 'Signed in — you can save rows to your leads.' : 'Not signed in — saving a row needs a sign-in.'}
        </span>
      </div>

      {saveMsg && <div style={okBox}>{saveMsg}</div>}
      {nolaError && <div style={errBox}>{nolaError}</div>}

      {loading && <p style={{ fontSize: 14, color: '#cbd5e1' }}>Loading open cases from {feed.sourceName}…</p>}
      {!loading && loadError && <div style={errBox}>{loadError}</div>}
      {!loading && !loadError && loadedFeed === feed.id && rows.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 24, textAlign: 'center', fontSize: 14, color: '#cbd5e1', marginTop: 16 }}>
          No open cases came back from this feed right now — the feed may be empty for this
          filter, or the city may have changed its data. Nothing was invented to fill the table.
        </div>
      )}

      {!loading && !loadError && rows.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 8 }}>Case</th>
                <th style={{ padding: 8 }}>Address</th>
                <th style={{ padding: 8 }}>Violation</th>
                <th style={{ padding: 8 }}>Opened</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Parcel</th>
                <th style={{ padding: 8 }}>Save</th>
                <th style={{ padding: 8 }}>Analyze</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const key = rowKey(r.feedId, i);
                const contact = savedContacts[key];
                const expanded = expandedKey === key;
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                    <td style={{ padding: 8, whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {r.caseNumber || '—'}
                      {r.feedId === 'kansas-city' && (
                        <div style={{ fontSize: 11, fontWeight: 400, color: '#cbd5e1' }}>No case number in this feed&apos;s verified fields.</div>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      {r.addressUnknown ? (
                        <span style={{ color: '#fca5a5' }}>Address unknown — no address on the feed row, none invented.</span>
                      ) : (
                        <>
                          {r.address}
                          {r.zip ? ` ${r.zip}` : ''}
                        </>
                      )}
                      {feed.stale && (
                        <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 2 }}>Stale — last updated 2026-04-30.</div>
                      )}
                      {feed.id === 'chicago' && (
                        <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 2 }}>Historical data — verify before relying on it.</div>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      {r.violation || '—'}
                      {r.violationIsProxy && r.violation && (
                        <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>
                          Case/request type — the closest label this feed carries; it has no violation-text field.
                        </div>
                      )}
                      {r.detailNote && <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>{r.detailNote}</div>}
                      {r.feedId === 'new-orleans' && r.caseNumber && (
                        <div style={{ marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={() => toggleNolaDetail(r, i)}
                            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
                          >
                            {expanded ? 'Hide violation detail' : 'Show violation detail'}
                          </button>
                          {expanded && nolaBusy === key && <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>Loading detail from the All Violations dataset…</div>}
                          {expanded && nolaDetail[key] && nolaDetail[key].length === 0 && (
                            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>No violation rows in the second dataset for this case.</div>
                          )}
                          {expanded && nolaDetail[key] && nolaDetail[key].length > 0 && (
                            <ul style={{ fontSize: 12, margin: '6px 0 0', paddingLeft: 16 }}>
                              {nolaDetail[key].map((d, j) => (
                                <li key={j}>
                                  {d.violation ? `${d.violation} — ` : ''}{d.description || 'No description.'}
                                  {d.codesection ? ` (${d.codesection})` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{r.openedDate || '—'}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{r.status || '—'}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{r.parcelId || '—'}</td>
                    <td style={{ padding: 8 }}>
                      <button
                        type="button"
                        onClick={() => saveRow(r, i)}
                        disabled={savingKey === key || savedKeys[key]}
                        style={{
                          fontSize: 12,
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: savedKeys[key] ? '#dcfce7' : '#fff',
                          color: '#0f172a',
                          cursor: savingKey === key || savedKeys[key] ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {savingKey === key ? 'Saving…' : savedKeys[key] ? '✓ Saved to leads' : 'Save to leads'}
                      </button>
                      {contact && (contact.phone || contact.email) && (
                        <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
                          {contact.phone ? `📞 ${contact.phone}` : ''}
                          {contact.phone && contact.email ? ' · ' : ''}
                          {contact.email ? `✉️ ${contact.email}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      <button
                        type="button"
                        onClick={() => openCopilot(distressedSummary(r), DISTRESSED_AUTO_QUESTION)}
                        style={{
                          fontSize: 12,
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#0f172a',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        🤖 Analyze
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-city verification queue — honest status, no fake
          "last checked" timestamps beyond Nov 17, 2026. */}
      <section style={panel} aria-label="Feed verification queue">
        <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Verification queue — all 10 feeds</h2>
        <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 12px' }}>
          Every feed below was verified live on Nov 17, 2026: endpoint, field names, open filter,
          and a sample row. No feed claims a fresher check than that. Kansas City is flagged stale
          wherever it appears — never presented as live or current.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 8 }}>City</th>
                <th style={{ padding: 8 }}>Source / dataset</th>
                <th style={{ padding: 8 }}>Endpoint</th>
                <th style={{ padding: 8 }}>Open filter</th>
                <th style={{ padding: 8 }}>Freshness</th>
                <th style={{ padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {DISTRESSED_FEEDS.map((f) => (
                <tr key={f.id} style={{ borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap', fontWeight: 600 }}>{f.city}, {f.state}</td>
                  <td style={{ padding: 8 }}>{f.sourceName}<br /><span style={{ color: '#cbd5e1' }}>{f.datasetName}</span></td>
                  <td style={{ padding: 8, wordBreak: 'break-all', fontSize: 11.5 }}>{f.endpoint}</td>
                  <td style={{ padding: 8 }}><code style={{ fontSize: 11.5 }}>{f.openFilter}</code></td>
                  <td style={{ padding: 8 }}>{f.freshness}</td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    Verified Nov 17, 2026
                    {f.stale && <div style={{ color: '#fca5a5', fontWeight: 700 }}>⚠ STALE — last updated 2026-04-30</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 24 }}>
        WholesalingOS is a connection platform, not a broker, lender, title company, or legal
        advisor. Code-violation rows come from each city&apos;s public open-data portal; the
        platform does not scrape, buy, or re-sell lists, and it never adds phone numbers or
        emails to a row — contact details come only from your own skip trace on a saved lead.
      </p>
    </main>
  );
}
