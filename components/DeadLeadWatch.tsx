'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadLeads, type Lead } from '../lib/leads';
import {
  loadWatchlist, setWatch, clearWatch, logEventAndResurrect,
  LEAD_EVENT_TYPES, type LeadEventType,
} from '../lib/watchlist';

// Slice 47 — dead-lead watchlist, wired to real leads. "Not
// interested" in March is a contract in October when the foreclosure
// lands: park the lead with a re-check date, re-check the county
// record yourself (links in Counties & Title), and when life has
// changed, log the public-record event — the lead resurrects into
// your pipeline with today's follow-up date. Nothing is scraped,
// nothing auto-contacts anyone; resurrection is a status change,
// not a message.

export default function DeadLeadWatch({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [all, setAll] = useState<Lead[]>([]);
  const [msg, setMsg] = useState('');
  const [pickId, setPickId] = useState('');
  const [pickDate, setPickDate] = useState('');
  const [dates, setDates] = useState<Record<string, string>>({});
  const [evtType, setEvtType] = useState<Record<string, LeadEventType>>({});
  const [evtNote, setEvtNote] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);

  const refresh = useCallback(() => {
    loadWatchlist(userId).then(setRows).catch(() => {});
    loadLeads(userId).then((r) => setAll(r || [])).catch(() => {});
  }, [userId]);
  useEffect(() => { refresh(); }, [refresh]);

  const watchPicked = async () => {
    if (!pickId) return;
    try {
      await setWatch(userId, pickId, pickDate || null);
      setMsg('Watching that lead — it will sit here until its re-check date or a logged event.');
      setPickId(''); setPickDate('');
      refresh();
    } catch (e) { setMsg(`That failed: ${(e as { message?: string })?.message || 'unknown error'}`); }
  };

  const saveDate = async (l: Lead) => {
    if (!l.id) return;
    try {
      await setWatch(userId, l.id, dates[l.id] ?? l.recheck_date ?? null);
      setMsg(`Re-check date saved for ${l.property_address}.`);
      refresh();
    } catch (e) { setMsg(`That failed: ${(e as { message?: string })?.message || 'unknown error'}`); }
  };

  const resurrect = async (l: Lead) => {
    if (!l.id) return;
    try {
      await logEventAndResurrect(userId, l.id, evtType[l.id] || 'other', evtNote[l.id] || '');
      setMsg(`Resurrected: ${l.property_address} is back in your pipeline as a new lead with today's follow-up. The event is logged on the record.`);
      refresh();
    } catch (e) { setMsg(`That failed: ${(e as { message?: string })?.message || 'unknown error'}`); }
  };

  const recheckState = (l: Lead) => {
    if (!l.recheck_date) return { text: 'no re-check date set', color: '#94a3b8' };
    if (l.recheck_date < today) return { text: `re-check was ${l.recheck_date} — due now`, color: '#f87171' };
    if (l.recheck_date === today) return { text: 're-check TODAY', color: '#fbbf24' };
    return { text: `re-check ${l.recheck_date}`, color: '#94a3b8' };
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Dead-Lead Watchlist — your real leads</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>
        Dead and watched leads live here with a re-check date. Re-check the county record yourself
        (official links in Counties &amp; Title) — when a public-record event has changed the picture,
        log it and the lead comes back to life in your pipeline. Nothing is scraped and nobody is
        auto-contacted.
      </p>
      {msg && <p style={{ fontSize: 13.5 }}>{msg}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <select value={pickId} onChange={(e) => setPickId(e.target.value)}>
          <option value="">Pick a lead to watch…</option>
          {all.map((l) => <option key={l.id} value={l.id}>{l.property_address} · {l.status}</option>)}
        </select>
        <input type="date" value={pickDate} onChange={(e) => setPickDate(e.target.value)} />
        <button onClick={watchPicked} disabled={!pickId}>Watch this lead</button>
      </div>
      {rows.length === 0 && <p style={{ fontSize: 14 }}>No dead or watched leads yet. When a lead goes dead, park it here instead of losing it.</p>}
      {rows.map((l) => {
        const rc = recheckState(l);
        return (
          <div key={l.id} style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <p style={{ fontSize: 14, margin: '0 0 4px' }}>
              <strong>{l.property_address}</strong>
              <span style={{ color: '#94a3b8' }}> · {l.owner_name || 'Owner'} · status: {l.status}{l.watched ? ' · watched' : ''}</span>
            </p>
            <p style={{ fontSize: 13, color: rc.color, margin: '0 0 8px' }}>{rc.text}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <input type="date" value={dates[l.id] ?? l.recheck_date ?? ''} onChange={(e) => setDates({ ...dates, [l.id as string]: e.target.value })} />
              <button onClick={() => saveDate(l)}>Save re-check date</button>
              <select value={evtType[l.id as string] || 'other'} onChange={(e) => setEvtType({ ...evtType, [l.id as string]: e.target.value as LeadEventType })}>
                {LEAD_EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <input placeholder="What did the record show?" value={evtNote[l.id as string] || ''} onChange={(e) => setEvtNote({ ...evtNote, [l.id as string]: e.target.value })} style={{ minWidth: 200 }} />
              <button onClick={() => resurrect(l)}>Log event &amp; resurrect</button>
              {l.watched && l.status !== 'dead' && <button onClick={async () => { if (l.id) { await clearWatch(userId, l.id).catch(() => {}); refresh(); } }}>Stop watching</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
