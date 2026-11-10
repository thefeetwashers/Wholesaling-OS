'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveLead } from '../lib/leads';
import { STATE_RECORD_SOURCE, type StateRecord, type StateSearchMode } from '../lib/state-records';

// Slice 104 — Florida state records lookup. The wholesaler searches
// the state's own published tax roll (FDOR statewide cadastral —
// every Florida county, one service) by owner name or parcel ID,
// and this panel shows the owner of record from the roll. (Address,
// city and ZIP modes were built, tried three ways live, and cut on
// Nov 10, 2026 — the statewide service does not answer those fields
// in usable time; county appraisers answer address questions, and
// the county doors below are the platform's path for them.)
// Nothing is stored until the wholesaler taps "Add as lead" on a
// result; then the lead is created in THEIR office with the roll's
// provenance and roll year stamped in the notes, consent 'unknown'
// — a public record is not consent to be contacted. The panel says
// plainly what the roll is: a yearly snapshot the state republishes
// each August, with the county appraiser as the live record.
// Terms/design notes live in app/api/state-records.

const money = (v: number | null) => (v !== null && v > 0 ? `$${Math.round(v).toLocaleString('en-US')}` : '—');

export default function StateRecords({ userId }: { userId: string | null }) {
  const [mode, setMode] = useState<StateSearchMode>('owner');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<StateRecord[] | null>(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [addMsg, setAddMsg] = useState('');

  if (!userId) return null;

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
      const res = await fetch(`/api/state-records?mode=${mode}&q=${encodeURIComponent(q)}`, {
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
          ? ` Last recorded sale on the roll: ${money(rec.salePrice)}${rec.saleYear ? ` (${rec.saleMonth ? `${rec.saleMonth}/` : ''}${rec.saleYear})` : ''}.`
          : '';
      const saved = await saveLead(userId, {
        property_address: rec.address || undefined,
        city: rec.city || undefined,
        state: 'FL',
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
        list_source: 'FDOR state records',
        consent_status: 'unknown',
        notes:
          `From ${STATE_RECORD_SOURCE}; roll year ${rec.rollYear ?? 'not stated'}, pulled ${today}. ` +
          `Just value on the roll: ${money(rec.justValue)}.${saleBit} ` +
          'Verify at the county property appraiser before acting — the roll is a yearly snapshot.',
      });
      if (!saved) { setAddMsg('That lead could not be saved — sign-in sync is not configured on this deployment.'); return; }
      setAdded((prev) => [...prev, rec.parcelId || rec.address]);
      setAddMsg(`Added: ${rec.address || rec.parcelId} is now in your Leads, stamped "FDOR state records".`);
    } catch {
      setAddMsg('That lead could not be saved — check the connection and try again.');
    }
  };

  const rollYear = records && records.length > 0 ? records[0].rollYear : null;

  return (
    <div style={{ borderTop: '1px solid #334155', paddingTop: 12, marginTop: 16 }}>
      <h3 style={{ marginBottom: 6 }}>Florida state records — live ownership lookup (all 67 counties)</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        The Florida Department of Revenue publishes the statewide tax roll — owner of record, property and mailing
        address, parcel, values, last sale — for every county in one official service. Search it live here; add a
        result as a lead only when it earns a place in your pipeline. Source: {STATE_RECORD_SOURCE}. The roll is a
        yearly snapshot republished each August — the county property appraiser is the live record, so verify before
        you spend money. A public record is not consent: leads land with consent “unknown”. Search it the two ways
        the state’s index answers instantly: by owner name — everything a person or company owns, statewide — or by
        parcel ID, from any listing, letter, or county record. Looking up a street address instead? That is the
        county appraiser’s job, and your county doors are right below — the statewide service does not answer
        address searches in usable time, so this panel does not pretend to.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={mode} onChange={(e) => setMode(e.target.value as StateSearchMode)}>
          <option value="owner">Owner name</option>
          <option value="parcel">Parcel ID</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
          placeholder={mode === 'parcel' ? 'Parcel ID from the roll' : 'e.g. SMITH JOHN'}
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
          No parcels on the roll matched “{searched}”. Check the spelling — the roll stores owner names in
          capitals, and a company may be recorded under its entity name rather than a person’s.
        </p>
      )}
      {records !== null && records.length > 0 && (
        <>
          <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
            {records.length} parcel{records.length === 1 ? '' : 's'} from the {rollYear ?? 'current'} roll — first
            matches only; narrow the search to see others.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {records.map((rec, i) => {
              const key = rec.parcelId || `${rec.address}-${i}`;
              const isAdded = added.indexOf(rec.parcelId || rec.address) >= 0;
              const outOfState = rec.mailingState && rec.mailingState !== 'FL';
              return (
                <div key={key} style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {rec.address || 'Address not on roll'} {rec.city ? `· ${rec.city}, FL ${rec.zip}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4 }}>
                    Owner of record: <strong>{rec.ownerName || '— not on roll'}</strong>
                    {outOfState ? ' · 📬 out-of-state owner' : ''}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3 }}>
                    Mailing: {[rec.mailingAddress, rec.mailingCity, rec.mailingState, rec.mailingZip].filter(Boolean).join(', ') || '—'}
                    {' · '}Parcel: {rec.parcelId || '—'}
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 6 }}>
                    Just value {money(rec.justValue)} · Assessed {money(rec.assessedValue)}
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
