'use client';

import { useEffect, useState } from 'react';
import {
  loadLeadRows,
  daysInList,
  staleBadge,
  isAbsentee,
  googleLookupUrl,
  mapsUrl,
  saveD4DLead,
  DISTRESS_FLAGS,
  DISTRESS_MAX,
  distressScore,
  type LeadRow,
} from '../lib/enrich';
import { loadCountyLinks, type CountyLinkRow } from '../lib/directories';
import { SCRIPT_TEMPLATES, mergeTemplate } from '../lib/scripts-data';

// Slice 13 — Stale listings & enrichment + Driving for Dollars.
// Aging is measured from when the lead entered YOUR list (created_at) and
// labeled that way. Absentee is a string comparison of your own fields.
// Skip tracing is click-to-lookup only — no scraping, no fake API.

const card: React.CSSProperties = { background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 };

export default function StaleDollars({ userId }: { userId: string | null }) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [counties, setCounties] = useState<CountyLinkRow[]>([]);
  const [msg, setMsg] = useState('');
  const [agentText, setAgentText] = useState('');

  const [addr, setAddr] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  const refresh = () => { if (userId) loadLeadRows(userId).then(setRows).catch(() => {}); };
  useEffect(() => {
    refresh();
    loadCountyLinks().then((c) => setCounties(c || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!userId) return null;
  const open = rows.filter((r) => r.status !== 'closed' && r.status !== 'dead');
  const d4d = rows.filter((r) => r.list_source === 'Driving for Dollars');
  const appraiserFor = (r: LeadRow): string | null => {
    const match = counties.find(
      (c) => r.county && c.county_name.toLowerCase().includes(r.county.toLowerCase())
    );
    return match?.tax_assessor_gis_url || counties[0]?.tax_assessor_gis_url || null;
  };
  const score = distressScore(flags);

  return (
    <section style={card}>
      <h2>Stale Listings, Enrichment & Driving for Dollars</h2>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}

      <h3>Your listings — aging & enrichment</h3>
      {open.length === 0 ? (
        <p style={{ fontSize: 13 }}>No open leads yet. Add listings in the Leads section or pin them below while driving.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {open.map((r) => {
            const days = daysInList(r);
            const badge = staleBadge(days);
            const appraiser = appraiserFor(r);
            return (
              <li key={r.id} style={{ marginBottom: 10 }}>
                <strong>{r.property_address}</strong>
                {r.city ? `, ${r.city}` : ''} — {r.owner_name || 'Owner unknown'}
                {days !== null ? ` · ${days} days in your list` : ''}
                {badge ? ` · ${badge}` : ''}
                {isAbsentee(r) ? ' · Absentee owner (mailing ≠ property)' : ''}
                <br />
                {appraiser ? (
                  <a href={appraiser} target="_blank" rel="noreferrer">County appraiser</a>
                ) : (
                  <span>County appraiser link: see Counties section</span>
                )}
                {' · '}
                <a href={googleLookupUrl(r)} target="_blank" rel="noreferrer">Skip-trace lookup (Google)</a>
                {' · '}
                <a href={mapsUrl(r.property_address, r.city, r.state)} target="_blank" rel="noreferrer">Map</a>
                {' · '}
                <button onClick={() => {
                  try {
                    localStorage.setItem('ws_prefill_lead', JSON.stringify({
                      property_address: r.property_address,
                      seller_name: r.owner_name || '',
                    }));
                    setMsg('Contract prefill saved — the Contracts form above picks it up on its next load. Scroll up to Contracts to finish it.');
                  } catch { setMsg('Prefill failed in this browser.'); }
                }}>Prefill contract</button>
                {' · '}
                <button onClick={() => {
                  const tpl = SCRIPT_TEMPLATES.find((s) => s.key === 'realtor') || SCRIPT_TEMPLATES[0];
                  setAgentText(mergeTemplate(tpl.body, {
                    name: r.owner_name || '{name}', you: '{you}', biz: '{biz}',
                    city: r.city || '{city}', address: r.property_address,
                  }));
                }}>Agent outreach draft</button>
              </li>
            );
          })}
        </ul>
      )}
      {agentText && (
        <div>
          <p style={{ fontSize: 13, background: '#0f172a', padding: 12, borderRadius: 10, whiteSpace: 'pre-wrap' }}>{agentText}</p>
          <button onClick={async () => { try { await navigator.clipboard.writeText(agentText); setMsg('Agent outreach copied — send it from your own email/app.'); } catch { setMsg('Copy failed in this browser.'); } }}>
            Copy agent outreach
          </button>
        </div>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Aging badges (100+/120+/180+) count days since the lead entered your list. Skip tracing is a
        click-to-lookup workflow — no site is scraped and no bulk lookup API is bundled, because none exists for free.
      </p>

      <h3>Driving for Dollars — pin what you see</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input placeholder="Property address" value={addr} onChange={(e) => setAddr(e.target.value)} style={{ minWidth: 220 }} />
        <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} style={{ width: 60 }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: 13 }}>
        {DISTRESS_FLAGS.map((f) => (
          <label key={f.key}>
            <input type="checkbox" checked={!!flags[f.key]} onChange={(e) => setFlags({ ...flags, [f.key]: e.target.checked })} /> {f.label}
          </label>
        ))}
      </div>
      <p style={{ fontSize: 13 }}>
        Distress score from your observations: <strong>{score} / {DISTRESS_MAX}</strong>{' '}
        <button disabled={!addr.trim()} onClick={async () => {
          const saved = await saveD4DLead(userId, addr.trim(), city.trim(), state.trim(), flags);
          if (saved) {
            setMsg('Pin saved as a lead (source: Driving for Dollars).');
            setAddr(''); setFlags({});
            refresh();
          } else {
            setMsg('Save failed — check your sign-in.');
          }
        }}>Add as lead</button>
      </p>
      {d4d.length > 0 && (
        <>
          <h4>Your route — pinned properties ({d4d.length})</h4>
          <ol style={{ fontSize: 13 }}>
            {d4d.map((r) => (
              <li key={r.id}>
                {r.property_address}{r.city ? `, ${r.city}` : ''}{' '}
                <a href={mapsUrl(r.property_address, r.city, r.state)} target="_blank" rel="noreferrer">Open in Maps</a>
                {r.notes ? ` — ${r.notes}` : ''}
              </li>
            ))}
          </ol>
        </>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Pins are your own observations, scored by the checklist above — no external data is pulled in.
      </p>
    </section>
  );
}
