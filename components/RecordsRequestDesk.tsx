'use client';

import { useEffect, useState } from 'react';
import { US_STATES } from '../lib/directories';
import { loadLetterIdentity, saveLetterIdentity, escHtml, openPrintWindow, type LetterIdentity } from '../lib/letter-identity';
import { REQUEST_TYPES, requestType, buildRequestLetter, loadRequestLog, saveRequestLog, newLogId, importStamp, type RequestLogEntry } from '../lib/records-request';

// Slice 107 — Records Request Desk. For the distress lists that
// have no feed anywhere — probate, lis pendens, most code cases,
// delinquent tax — the lawful channel is a public-records request
// to the office that holds the list. This desk drafts the request
// letter from the wholesaler's own letter identity, addressed to
// the right kind of office, citing the state's public records law;
// the wholesaler prints it, copies it, or opens it in their own
// email app and SENDS IT THEMSELVES — the platform sends nothing.
// The log of who was asked, for what, and when lives in this
// browser only (the letter-identity pattern). When a list comes
// back, it enters through the Import Inbox stamped as what it is:
// "Public records request — <County> County, <ST> (<date>)".

const PERIODS = ['the last 30 days', 'the last 90 days', 'the year to date'];

export default function RecordsRequestDesk({ userId }: { userId: string | null }) {
  const [stateCode, setStateCode] = useState('FL');
  const [county, setCounty] = useState('St. Lucie');
  const [typeKey, setTypeKey] = useState('probate');
  const [period, setPeriod] = useState(PERIODS[0]);
  const [feeCap, setFeeCap] = useState('25');
  const [officeName, setOfficeName] = useState('');
  const [identity, setIdentity] = useState<LetterIdentity>({ you: '', biz: '', phone: '', email: '' });
  const [log, setLog] = useState<RequestLogEntry[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setIdentity(loadLetterIdentity());
    setLog(loadRequestLog());
  }, []);

  if (!userId) return null;

  const stateName = (US_STATES.filter((s) => s.code === stateCode)[0] || US_STATES[0]).name;
  const type = requestType(typeKey);
  const letter = buildRequestLetter({
    identity,
    type,
    county: county.trim() || '[County]',
    stateCode,
    stateName,
    period,
    feeCap: feeCap.trim(),
    officeName: officeName.trim(),
  });

  const updateLog = (next: RequestLogEntry[]) => {
    setLog(next);
    saveRequestLog(next);
  };

  const addToLog = (status: 'drafted' | 'sent') => {
    const entry: RequestLogEntry = {
      id: newLogId(),
      at: new Date().toISOString(),
      state: stateCode,
      county: county.trim(),
      type: typeKey,
      office: officeName.trim() || type.officeRole,
      status,
    };
    updateLog([entry, ...log]);
    setMsg(status === 'sent'
      ? `Logged as sent: ${type.label.split(' — ')[0]} for ${entry.county} County, ${stateCode}. Ask again in about a month.`
      : `Logged as drafted: ${type.label.split(' — ')[0]} for ${entry.county} County, ${stateCode}.`);
  };

  const advance = (e: RequestLogEntry) => {
    const nextStatus = e.status === 'drafted' ? 'sent' : 'received';
    updateLog(log.map((x) => (x.id === e.id ? { ...x, status: nextStatus } : x)));
  };

  const removeEntry = (e: RequestLogEntry) => {
    updateLog(log.filter((x) => x.id !== e.id));
  };

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(okMsg);
    } catch {
      setMsg('Copy did not work in this browser — select the text and copy it manually.');
    }
  };

  const printLetter = () => {
    openPrintWindow(
      letter.subject,
      `<div style="font-family: Georgia, serif; font-size: 14px; line-height: 1.55; max-width: 680px; margin: 24px auto; white-space: pre-wrap;">${escHtml(letter.body)}</div>`,
    );
  };

  const mailto = `mailto:?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`;

  const dueAgain = log.filter(
    (e) => e.county.toLowerCase() === county.trim().toLowerCase() && e.type === typeKey && e.status !== 'drafted',
  )[0];
  const dueDays = dueAgain ? Math.floor((Date.now() - new Date(dueAgain.at).getTime()) / 86400000) : null;

  return (
    <div style={{ borderTop: '1px solid #334155', paddingTop: 12, marginTop: 16 }}>
      <h3 style={{ marginBottom: 6 }}>4 · Records Request Desk — the lists no feed can give you</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Probate files, lis pendens, most code cases, delinquent-tax lists, and fire-incident reports are public records, but no state
        publishes them as a feed — anyone selling a national version is scraping court sites or reselling a licensed
        database. The lawful way is the oldest one: ask the office that holds the list, in writing, under your
        state’s public records law. This desk drafts that letter from your letter identity; you print it, copy it,
        or open it in your own email and send it yourself — the platform sends nothing. When the list arrives, bring
        it in through Leads → Import Inbox with the stamp shown in your log below. Your log lives in this browser
        only, like your letter identity.
      </p>

      <div style={{ display: 'grid', gap: 6, maxWidth: 560 }}>
        <label style={{ fontSize: 13 }}>
          List type{' '}
          <select value={typeKey} onChange={(e) => setTypeKey(e.target.value)}>
            {REQUEST_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          State{' '}
          <select value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
            {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        <input placeholder="County name (e.g. St. Lucie)" value={county} onChange={(e) => setCounty(e.target.value)} />
        <label style={{ fontSize: 13 }}>
          Period{' '}
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <input placeholder={`Office to address (blank = ${type.officeRole})`} value={officeName} onChange={(e) => setOfficeName(e.target.value)} />
        <label style={{ fontSize: 13 }}>
          Tell me first if fees exceed $ <input value={feeCap} onChange={(e) => setFeeCap(e.target.value)} style={{ width: 60 }} />
        </label>
      </div>

      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
        <strong style={{ color: '#e2e8f0' }}>Ask cadence: {type.cadence}.</strong> {type.note}
      </p>
      {dueAgain && dueDays !== null && dueDays >= 30 && (
        <p style={{ fontSize: 13, color: '#fbbf24' }}>
          You last asked {dueAgain.county} County for this list on {dueAgain.at.slice(0, 10)} — {dueDays} days ago. It is due again.
        </p>
      )}

      <h4 style={{ marginBottom: 6 }}>Your letter identity (prints on the letter)</h4>
      <div style={{ display: 'grid', gap: 6, maxWidth: 560 }}>
        <input placeholder="Your name" value={identity.you} onChange={(e) => setIdentity({ ...identity, you: e.target.value })} />
        <input placeholder="Business name" value={identity.biz} onChange={(e) => setIdentity({ ...identity, biz: e.target.value })} />
        <input placeholder="Phone" value={identity.phone} onChange={(e) => setIdentity({ ...identity, phone: e.target.value })} />
        <input placeholder="Email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} />
      </div>
      <p style={{ marginTop: 8 }}>
        <button onClick={() => { saveLetterIdentity(identity); setMsg('Letter identity saved on this device.'); }}>Save identity</button>
      </p>

      <h4 style={{ marginBottom: 6 }}>The letter</h4>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 4px' }}>Subject: {letter.subject}</p>
      <div style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 14px', whiteSpace: 'pre-wrap', fontSize: 13.5, color: '#e2e8f0', maxWidth: 720 }}>
        {letter.body}
      </div>
      <p style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={printLetter}>Print letter</button>
        <button onClick={() => void copyText(`${letter.subject}\n\n${letter.body}`, 'Letter copied — paste it wherever you send it from.')}>Copy letter</button>
        <a href={mailto}><button type="button">Open in my email app</button></a>
        <button onClick={() => addToLog('drafted')} disabled={!county.trim()}>Log as drafted</button>
        <button onClick={() => addToLog('sent')} disabled={!county.trim()}>Log as sent</button>
      </p>
      <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
        “Open in my email app” fills in the subject and letter — you add the office’s email address (find it through
        your state directory or county doors above) and press send yourself.
      </p>
      {msg && <p style={{ fontSize: 13.5, color: '#4ade80' }}>{msg}</p>}

      {log.length > 0 && (
        <>
          <h4 style={{ marginBottom: 6 }}>Your request log</h4>
          {log.map((e) => (
            <div key={e.id} style={{ borderTop: '1px solid #334155', paddingTop: 8, marginTop: 8 }}>
              <p style={{ fontSize: 13.5, margin: 0 }}>
                <strong>{requestType(e.type).label.split(' — ')[0]}</strong> — {e.county} County, {e.state} · {e.at.slice(0, 10)} ·{' '}
                <span style={{ color: e.status === 'received' ? '#4ade80' : '#fbbf24' }}>{e.status}</span>{' '}
                {e.status !== 'received' && <button onClick={() => advance(e)}>Mark {e.status === 'drafted' ? 'sent' : 'received'}</button>}{' '}
                <button onClick={() => removeEntry(e)}>Delete</button>
              </p>
              <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '2px 0 0' }}>Office: {e.office}</p>
              {e.status === 'received' && (
                <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '2px 0 0' }}>
                  Import stamp for this list:{' '}
                  <button onClick={() => void copyText(importStamp(e), 'Import stamp copied — paste it as the list source when you import.')}>{importStamp(e)}</button>
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
