'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveLead } from '../lib/leads';
import { STATE_SOURCES, type StateCode, type StateRecord, type StateSearchMode } from '../lib/state-records';

// Slices 104 + 106 — state records lookup. The wholesaler searches a
// state's own published roll live — Florida's FDOR statewide
// cadastral roll (Slice 104) and Connecticut's OPM CAMA and Parcel
// Layer (Slice 106) — by owner name or parcel ID, and this panel
// shows the owner of record. A state appears in the selector only
// after its terms have been read and pass the gate (research map:
// us-source-map-2026-11-10.md). Nothing is stored until the
// wholesaler taps "Add as lead" on a result; then the lead is
// created in THEIR office with that state's provenance and roll /
// collection year stamped in the notes, consent 'unknown' — a
// public record is not consent to be contacted. Each state's panel
// copy says plainly what its data is (a yearly snapshot, who the
// live record is, and any suppression the state applies).
// Terms/design notes live in app/api/state-records.

const money = (v: number | null) => (v !== null && v > 0 ? `$${Math.round(v).toLocaleString('en-US')}` : '—');

export default function StateRecords({ userId }: { userId: string | null }) {
  const [srcCode, setSrcCode] = useState<StateCode>('FL');
  const [mode, setMode] = useState<StateSearchMode>('owner');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<StateRecord[] | null>(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [addMsg, setAddMsg] = useState('');

  if (!userId) return null;

  const info = STATE_SOURCES.filter((x) => x.code === srcCode)[0] || STATE_SOURCES[0];

  const pickState = (code: StateCode) => {
    setSrcCode(code);
    setRecords(null);
    setError('');
    setAddMsg('');
    setAdded([]);
    setSearched('');
  };

  const search = async () => {
    setBusy(true);
    setError('');
    setAddMsg('');
    setRecords(null);
    try {
      if (!supabase) { setError('Sign-in sync is not configured on this deployment.'); return; }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setError('Sign in to search the state roll.'); return; }
      const res = await fetch(`/api/state-records?state=${srcCode}&mode=${mode}&q=${encodeURIComponent(q)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const j = (await res.json()) as { records?: StateRecord[]; error?: string };
      setRecords(j.records || []);
      setSearched(q.trim());
      if (j.error) setError(j.error);
    } catch {
      setError('The state records lookup could not be reached just now.');
    } finally {
      setBusy(false);
    }
  };

  const addLead = async (rec: StateRecord) => {
    setAddMsg('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saleBit =
        rec.salePrice !== null && rec.salePrice > 0
          ? ` Last recorded sale on the record: ${money(rec.salePrice)}${rec.saleYear ? ` (${rec.saleMonth ? `${rec.saleMonth}/` : ''}${rec.saleYear})` : ''}.`
          : '';
      const saved = await saveLead(userId, {
        property_address: rec.address || undefined,
        city: rec.city || undefined,
        state: info.code,
        zip: rec.zip || undefined,
        owner_name: rec.ownerName || undefined,
        parcel_id: rec.parcelId || undefined,
        year_built: rec.yearBuilt !== null ? rec.yearBuilt : undefined,
        assessed_value: rec.assessedValue !== null ? rec.assessedValue : undefined,
        mailing_address: rec.mailingAddress || undefined,
        mailing_city: rec.mailingCity || undefined,
        mailing_state: rec.mailingState || undefined,
        mailing_zip: rec.mailingZip || undefined,
        status: 'new',
        list_source: info.listSource,
        consent_status: 'unknown',
        notes:
          `From ${info.sourceLine}; ${info.yearPhrase ? info.yearPhrase : `${info.yearNoun} year`} ${rec.rollYear ?? 'not stated'}, pulled ${today}. ` +
          `${info.valueLabel} on the record: ${money(rec.justValue)}.${saleBit} ` +
          info.verifyLine,
      });
      if (!saved) { setAddMsg('That lead could not be saved — sign-in sync is not configured on this deployment.'); return; }
      setAdded((prev) => [...prev, rec.parcelId || rec.address]);
      setAddMsg(`Added: ${rec.address || rec.parcelId} is now in your Leads, stamped "${info.listSource}".`);
    } catch {
      setAddMsg('That lead could not be saved — check the connection and try again.');
    }
  };

  const rollYear = records && records.length > 0 ? records[0].rollYear : null;

  return (
    <div style={{ borderTop: '1px solid #334155', paddingTop: 12, marginTop: 16 }}>
      <h3 style={{ marginBottom: 6 }}>{info.heading}</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        {info.blurb} Source: {info.sourceLine}.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={srcCode} onChange={(e) => pickState(e.target.value as StateCode)}>
          <option value="FL">Florida</option>
          <option value="CT">Connecticut</option>
          <option value="MA">Massachusetts</option>
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value as StateSearchMode)}>
          <option value="owner">Owner name</option>
          <option value="parcel">Parcel ID</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
          placeholder={mode === 'parcel' ? 'Parcel ID from the record' : 'e.g. SMITH JOHN'}
          style={{ flex: '1 1 260px' }}
        />
        <button onClick={() => void search()} disabled={busy || q.trim().length < 3}>
          {busy ? 'Searching the roll…' : 'Search state records'}
        </button>
      </div>
      {error && <p style={{ fontSize: 13.5, color: '#fbbf24' }}>{error}</p>}
      {addMsg && <p style={{ fontSize: 13.5, color: '#4ade80' }}>{addMsg}</p>}
      {records !== null && !error && records.length === 0 && (
        <p style={{ fontSize: 13.5, color: '#94a3b8' }}>
          No parcels on the record matched “{searched}”. {info.emptyHint}
        </p>
      )}
      {records !== null && records.length > 0 && (
        <>
          <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
            {records.length} parcel{records.length === 1 ? '' : 's'} from the {rollYear ?? 'current'} {info.yearNoun} — first
            matches only; narrow the search to see others.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {records.map((rec, i) => {
              const key = rec.parcelId || `${rec.address}-${i}`;
              const isAdded = added.indexOf(rec.parcelId || rec.address) >= 0;
              const outOfState = rec.mailingState && rec.mailingState !== info.code;
              return (
                <div key={key} style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {rec.address || 'Address not on record'} {rec.city ? `· ${rec.city}, ${info.code} ${rec.zip}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4 }}>
                    Owner of record: <strong>{rec.ownerName || '— not on record'}</strong>
                    {outOfState ? ' · 📬 out-of-state owner' : ''}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3 }}>
                    Mailing: {[rec.mailingAddress, rec.mailingCity, rec.mailingState, rec.mailingZip].filter(Boolean).join(', ') || '—'}
                    {' · '}Parcel: {rec.parcelId || '—'}
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 6 }}>
                    {info.valueLabel} {money(rec.justValue)} · Assessed {money(rec.assessedValue)}
                    {rec.yearBuilt ? ` · Built ${rec.yearBuilt}` : ''}
                    {rec.livingArea ? ` · ${Math.round(rec.livingArea).toLocaleString('en-US')} sq ft living` : ''}
                    {rec.salePrice !== null && rec.salePrice > 0
                      ? ` · Last sale ${money(rec.salePrice)}${rec.saleYear ? ` (${rec.saleMonth ? `${rec.saleMonth}/` : ''}${rec.saleYear})` : ''}`
                      : ''}
                  </div>
                  <button type="button" onClick={() => void addLead(rec)} disabled={isAdded} style={{ marginTop: 8, fontSize: 13 }}>
                    {isAdded ? 'Added to your Leads ✓' : 'Add as lead'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
