'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveLead } from '../lib/leads';
import {
  FLORIDA_COUNTIES,
  PROPERTY_LOOKUP_MAO_KEY,
  PROPERTY_LOOKUP_MAO_EVENT,
  dorUcKind,
  type PropertyLookupResult,
} from '../lib/property-lookup';

// Slice 123 — Property lookup bar. Two modes, both through the
// server route /api/property-lookup (the Census geocoder sends no
// CORS headers, so the browser never calls it directly):
//   Address — U.S. Census geocoder: coordinates + county for any
//   U.S. address. A geocode carries NO owner and NO value.
//   Florida parcel — parcel ID + county on the FDOR statewide
//   cadastral roll: owner, mailing address, just value, land
//   value, DOR use code, year built. The roll is a yearly snapshot
//   published each August — the panel says the county appraiser is
//   the live record, and no roll year is invented.
// A result becomes a lead only on the wholesaler's tap, stamped
// with its source. "Load into MAO" fills the 70% rule calculator
// (ARV = the roll's just value, House/Land from the DOR use code)
// via the same localStorage + event handoff the Repair Estimator
// uses — it works whether the analyzer is on screen now or opened
// later in the Leads view.

const money = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : `$${Math.round(v).toLocaleString()}`;

export default function PropertyLookup({ userId }: { userId: string | null }) {
  const [mode, setMode] = useState<'address' | 'parcel'>('address');
  const [address, setAddress] = useState('');
  const [parcelId, setParcelId] = useState('');
  const [countyCode, setCountyCode] = useState(56);
  const [results, setResults] = useState<PropertyLookupResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState<string[]>([]);

  if (!userId) return null;

  async function search() {
    setBusy(true);
    setError('');
    setMsg('');
    setResults([]);
    try {
      if (!supabase) { setError('Sign-in sync is not configured on this deployment.'); return; }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setError('Sign in to run a property lookup.'); return; }
      const url =
        mode === 'address'
          ? `/api/property-lookup?address=${encodeURIComponent(address.trim())}`
          : `/api/property-lookup?parcelId=${encodeURIComponent(parcelId.trim())}&countyCode=${countyCode}`;
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      const j = (await res.json()) as { results?: PropertyLookupResult[]; error?: string };
      if (j.error) { setError(j.error); return; }
      const list = j.results || [];
      setResults(list);
      if (list.length === 0) setError('No record found — check the spelling and try again.');
    } catch {
      setError('The property lookup could not be reached just now.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAsLead(rec: PropertyLookupResult) {
    setMsg('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const provenance =
        rec.source === 'census'
          ? `From the U.S. Census geocoder (Public_AR_Current), pulled ${today}. Geocoded address only — the Census carries no owner and no value for this property.`
          : `From the Florida Statewide Cadastral roll (FDOR Property Tax Oversight), pulled ${today}. The roll is a yearly snapshot published each August; the county appraiser is the live record. Just value on the record: ${money(rec.justValue)}.`;
      const leadAddress =
        rec.address ||
        (rec.parcelId
          ? `Parcel ${rec.parcelId}${rec.county ? ` — ${rec.county} County, FL` : ''} (no street address on the state record)`
          : '');
      const savedLead = await saveLead(userId, {
        property_address: leadAddress || undefined,
        city: rec.city || undefined,
        state: rec.state || 'FL',
        zip: rec.zip || undefined,
        county: rec.county || undefined,
        owner_name: rec.ownerName || undefined,
        parcel_id: rec.parcelId || undefined,
        year_built: rec.yearBuilt !== null && rec.yearBuilt !== undefined ? rec.yearBuilt : undefined,
        assessed_value: rec.justValue !== null && rec.justValue !== undefined ? rec.justValue : undefined,
        mailing_address: rec.mailingAddress || undefined,
        mailing_city: rec.mailingCity || undefined,
        mailing_state: rec.mailingState || undefined,
        mailing_zip: rec.mailingZip || undefined,
        status: 'new',
        list_source:
          rec.source === 'census' ? 'Property lookup — Census geocoder' : 'Property lookup — FL cadastral roll',
        consent_status: 'unknown',
        notes: provenance,
      });
      if (!savedLead) { setMsg('That lead could not be saved — sign-in sync is not configured on this deployment.'); return; }
      setSaved((prev) => [...prev, rec.parcelId || rec.address]);
      setMsg(`Added: ${leadAddress || rec.parcelId} is now in your Leads.`);
    } catch {
      setMsg('That lead could not be saved — check the connection and try again.');
    }
  }

  function loadIntoMao(rec: PropertyLookupResult) {
    const kind = dorUcKind(rec.dorUseCode);
    const arv = rec.justValue;
    if (arv === null || arv === undefined || arv <= 0) {
      setMsg('No value on this record to load — the MAO calculator needs an ARV. Look the parcel up on the roll for its just value.');
      return;
    }
    if (!kind) {
      setMsg(`The roll's just value is ${money(arv)}, but its DOR use code (${rec.dorUseCode || 'not stated'}) does not say House or Land — open the Deal Analyzer and pick the type yourself.`);
      return;
    }
    const load = { arv, kind, at: new Date().toISOString() };
    try {
      localStorage.setItem(PROPERTY_LOOKUP_MAO_KEY, JSON.stringify(load));
    } catch { /* storage unavailable — the live event below still fires */ }
    window.dispatchEvent(new CustomEvent(PROPERTY_LOOKUP_MAO_EVENT, { detail: load }));
    setMsg(`Loaded into the 70% rule / MAO calculator: ARV ${money(arv)} (the roll's just value), type ${kind === 'house' ? 'House' : 'Land'} (DOR use code ${rec.dorUseCode}). Open the Deal Analyzer in your Leads view to see it.`);
  }

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Property lookup — geocode an address, or pull a Florida parcel</h2>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        An address goes to the U.S. Census geocoder (coordinates and county — no owner, no value).
        A parcel ID plus a Florida county goes to the FDOR statewide cadastral roll (owner, mailing
        address, just value, DOR use code, year built). The roll is a yearly snapshot published each
        August — the county appraiser is the live record. Nothing is stored until you save a result
        as a lead.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => { setMode('address'); setResults([]); setError(''); setMsg(''); }} disabled={mode === 'address'}>Address</button>
        <button onClick={() => { setMode('parcel'); setResults([]); setError(''); setMsg(''); }} disabled={mode === 'parcel'}>Florida parcel</button>
      </div>
      {mode === 'address' ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            style={{ flex: '1 1 320px' }}
            placeholder="Street address — e.g. 4100 Okeechobee Rd, Fort Pierce, FL 34947"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          />
          <button onClick={search} disabled={busy || address.trim().length < 5}>{busy ? 'Looking up…' : 'Geocode'}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ flex: '1 1 220px' }}
            placeholder="Parcel / APN — as printed on the county record"
            value={parcelId}
            onChange={(e) => setParcelId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          />
          <select value={countyCode} onChange={(e) => setCountyCode(Number(e.target.value))}>
            {FLORIDA_COUNTIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name} County (DOR {c.code})</option>
            ))}
          </select>
          <button onClick={search} disabled={busy || parcelId.trim().length < 3}>{busy ? 'Looking up…' : 'Look up parcel'}</button>
        </div>
      )}
      {error && <p style={{ fontSize: 13.5, color: '#fbbf24' }}>{error}</p>}
      {msg && <p style={{ fontSize: 13.5 }}>{msg}</p>}
      {results.length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {results.map((rec, i) => {
            const key = `${rec.parcelId || rec.address}-${i}`;
            const isSaved = saved.indexOf(rec.parcelId || rec.address) >= 0;
            const kind = dorUcKind(rec.dorUseCode);
            return (
              <div key={key} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: 0, fontSize: 14 }}><strong>{rec.address || `Parcel ${rec.parcelId}`}</strong></p>
                <p style={{ margin: '4px 0', fontSize: 13.5, color: '#cbd5e1' }}>
                  {rec.county ? `${rec.county} County` : ''}{rec.county && rec.state ? ', ' : ''}{rec.state}
                  {rec.zip ? ` ${rec.zip}` : ''}
                  {rec.parcelId ? ` · Parcel ${rec.parcelId}` : ''}
                </p>
                {rec.source === 'census' ? (
                  <p style={{ margin: '4px 0', fontSize: 13.5, color: '#94a3b8' }}>
                    Geocoded: {rec.lat?.toFixed(5)}, {rec.lng?.toFixed(5)}
                    {rec.censusCountyFips ? ` · Census county FIPS ${rec.censusCountyFips}` : ''} · No owner and no value on a geocode.
                  </p>
                ) : (
                  <p style={{ margin: '4px 0', fontSize: 13.5, color: '#cbd5e1' }}>
                    Owner: {rec.ownerName || '—'} · Mailing: {rec.mailingAddress || '—'}
                    <br />
                    Just value: {money(rec.justValue)} · Land value: {money(rec.landValue)}
                    {rec.dorUseCode ? ` · DOR use code ${rec.dorUseCode}${kind ? ` (${kind === 'house' ? 'House' : 'Land'})` : ' (type not auto-selected)'}` : ''}
                    {rec.yearBuilt ? ` · Built ${rec.yearBuilt}` : ''}
                    <br />
                    <span style={{ color: '#94a3b8' }}>Florida cadastral roll — a yearly snapshot published each August; the county appraiser is the live record.</span>
                  </p>
                )}
                <p style={{ margin: '8px 0 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => saveAsLead(rec)} disabled={isSaved}>
                    {isSaved ? 'Saved to your Leads ✓' : 'Save to My Sealed Leads'}
                  </button>
                  {rec.source === 'fl_cadastral' && (
                    <button onClick={() => loadIntoMao(rec)}>Load into 70% Rule / MAO Calculator</button>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 0 }}>
        Florida only for parcel lookups — a state joins this lookup only after its real parcel service is verified live.
        Texas has no statewide parcel server (county-level only) and is not listed.
      </p>
    </section>
  );
}
