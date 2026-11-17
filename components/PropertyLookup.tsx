'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveLead } from '../lib/leads';
import {
  FLORIDA_COUNTIES,
  PROPERTY_LOOKUP_MAO_KEY,
  PROPERTY_LOOKUP_MAO_EVENT,
  countyByCode,
  dorUcKind,
  type PropertyLookupResult,
} from '../lib/property-lookup';
import PropertyMap from './PropertyMap';
import type { CorporateBuyerRow } from '../lib/corporate-buyers';
import { loadMyStorefront } from '../lib/storefront';
import { buildBuyerInviteLink } from '../lib/invite-link';

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

// Slice 132 — location lifted out of a lookup result for
// consumers that need it (DealAnalyzer underwriting): the first
// result's point (Mode A), ZIP, and county FIPS (Census county
// FIPS for Mode A; the verified registry FIPS for Mode B — null
// when the county is not one of the 10 verified, never guessed).
export interface LookupLocation {
  lat: number | null;
  lng: number | null;
  zip: string | null;
  countyFips: string | null;
}

export default function PropertyLookup({ userId, onResult }: { userId: string | null; onResult?: (loc: LookupLocation) => void }) {
  const [mode, setMode] = useState<'address' | 'parcel'>('address');
  const [address, setAddress] = useState('');
  const [parcelId, setParcelId] = useState('');
  const [countyCode, setCountyCode] = useState(56);
  const [results, setResults] = useState<PropertyLookupResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  // Slice 132 — recent corporate buyers RESEARCH lookup (see the
  // research section below the results). RESEARCH only — results
  // are never written into the buyers database.
  const [researchCounty, setResearchCounty] = useState(6);
  const [researchYear, setResearchYear] = useState('2024');
  const [researchPrice, setResearchPrice] = useState('');
  const [researchRows, setResearchRows] = useState<CorporateBuyerRow[]>([]);
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchError, setResearchError] = useState('');
  const [researchMsg, setResearchMsg] = useState('');
  // Slice 133 — the wholesaler's own invite link, for the
  // per-row "Copy invite link" action on research results. The
  // slug loads once here (not per row). Nothing about the parcel
  // lookup or its county list changes: this file stays FL-only
  // for parcels.
  const [inviteSlug, setInviteSlug] = useState<string | null>(null);
  const [copiedResearchRow, setCopiedResearchRow] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    let on = true;
    loadMyStorefront(userId)
      .then((p) => { if (on) setInviteSlug(p?.public_slug?.trim() || null); })
      .catch(() => { if (on) setInviteSlug(null); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function copyResearchInvite(rowIndex: number) {
    const link = buildBuyerInviteLink(inviteSlug);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        () => {
          setCopiedResearchRow(rowIndex);
          setTimeout(() => setCopiedResearchRow((cur) => (cur === rowIndex ? null : cur)), 3000);
        },
        () => setResearchMsg('Copy failed — the invite link is on the Cash Buyers view; copy it there.'),
      );
    } else {
      setResearchMsg('Copy is not available in this browser — the invite link is on the Cash Buyers view.');
    }
  }

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
      setAuthToken(token || null);
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
      if (list.length === 0) {
        setError('No record found — check the spelling and try again.');
      } else {
        const first = list[0];
        const fips =
          first.source === 'census'
            ? first.censusCountyFips || null
            : countyByCode(countyCode)?.fips || null;
        onResult?.({ lat: first.lat ?? null, lng: first.lng ?? null, zip: first.zip || null, countyFips: fips });
      }
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

  // Slice 132 — recent corporate buyers RESEARCH lookup. A live
  // query against the FL cadastral roll (county via the translated
  // roll code, sale year >= chosen, sale price >= chosen, owner
  // name LIKE LLC / INC / TRUST / LP), 25 rows, ordered by sale
  // price. RESEARCH ONLY: an LLC owning a property is not a buyer
  // who consented to be contacted — results are shown, never
  // stored as buyers, never bulk-harvested, never emailed.
  async function searchResearch() {
    setResearchBusy(true);
    setResearchError('');
    setResearchMsg('');
    setResearchRows([]);
    try {
      if (!authToken) { setResearchError('Sign in to run the research lookup.'); return; }
      const minPrice = researchPrice.trim() === '' ? 0 : Number(researchPrice);
      const url = `/api/corporate-buyers?countyCode=${researchCounty}&minYear=${encodeURIComponent(researchYear.trim())}&minPrice=${minPrice}`;
      const res = await fetch(url, { headers: { authorization: `Bearer ${authToken}` } });
      const j = (await res.json()) as { rows?: CorporateBuyerRow[]; error?: string };
      if (j.error) { setResearchError(j.error); return; }
      const rows = j.rows || [];
      setResearchRows(rows);
      if (rows.length === 0) setResearchMsg('No corporate-owned sales matched in that county and year — try an earlier year or a lower price.');
    } catch {
      setResearchError('The research lookup could not be reached just now.');
    } finally {
      setResearchBusy(false);
    }
  }

  // CSV export of the research results — real fields only, proper
  // double-quote escaping (same pattern as leadsToCsv), dated
  // filename.
  function downloadResearchCsv() {
    const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'owner_name,mailing_address,mailing_city,mailing_state,mailing_zip,property_address,property_city,property_zip,parcel_id,sale_price,sale_year,sale_month,living_area_sqft,year_built,just_value';
    const lines = researchRows.map((r) =>
      [
        esc(r.ownerName), esc(r.mailingAddress), esc(r.mailingCity), esc(r.mailingState), esc(r.mailingZip),
        esc(r.propertyAddress), esc(r.propertyCity), esc(r.propertyZip), esc(r.parcelId),
        esc(r.salePrice), esc(r.saleYear), esc(r.saleMonth), esc(r.livingArea), esc(r.yearBuilt), esc(r.justValue),
      ].join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corporate-buyers-research-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
                <ResultEnrichment rec={rec} countyCode={countyCode} authToken={authToken} />
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
      <section style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '12px 14px', marginTop: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Find recent corporate buyers — research</h3>
        <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 8px' }}>
          Property owners found in public records — not opted-in buyers. Contact respectfully once, and add to your buyers list only
          if they agree.
        </p>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px' }}>
          A live query of the Florida Statewide Cadastral roll: one county, sales in or after the year you pick, sale price at or
          above the price you pick, owner name containing LLC, INC, TRUST, or LP. At most 25 rows, highest sale price first. Results
          are shown here only — they are never saved into your buyers list, never bulk-harvested, and never emailed.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={researchCounty} onChange={(e) => setResearchCounty(Number(e.target.value))}>
            {FLORIDA_COUNTIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name} County (DOR {c.code})</option>
            ))}
          </select>
          <input
            type="number"
            min={1900}
            max={2100}
            placeholder="Sale year ≥"
            value={researchYear}
            onChange={(e) => setResearchYear(e.target.value)}
            style={{ width: 130 }}
          />
          <input
            type="number"
            min={0}
            placeholder="Min sale price $ (optional)"
            value={researchPrice}
            onChange={(e) => setResearchPrice(e.target.value)}
            style={{ width: 200 }}
          />
          <button onClick={searchResearch} disabled={researchBusy}>{researchBusy ? 'Searching…' : 'Search public records'}</button>
          {researchRows.length > 0 && (
            <button onClick={downloadResearchCsv}>Export CSV ({researchRows.length})</button>
          )}
        </div>
        {researchError && <p style={{ fontSize: 13.5, color: '#fbbf24' }}>{researchError}</p>}
        {researchMsg && <p style={{ fontSize: 13.5 }}>{researchMsg}</p>}
        {researchRows.length > 0 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {researchRows.map((r, i) => (
              <div key={`${r.parcelId || r.ownerName || 'row'}-${i}`} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 13.5 }}>
                <strong>{r.ownerName || 'Owner name not on record'}</strong>
                {r.salePrice != null ? ` · Sold ${money(r.salePrice)}` : ''}
                {r.saleYear != null ? ` · ${r.saleYear}` : ''}
                <br />
                <span style={{ color: '#cbd5e1' }}>
                  {r.propertyAddress || 'Property address not on record'}
                  {r.propertyCity ? `, ${r.propertyCity}` : ''}
                  {r.propertyZip ? ` ${r.propertyZip}` : ''}
                  {r.parcelId ? ` · Parcel ${r.parcelId}` : ''}
                </span>
                <br />
                <span style={{ color: '#94a3b8' }}>
                  Mailing: {r.mailingAddress || '—'}
                  {r.mailingCity ? `, ${r.mailingCity}` : ''}
                  {r.mailingState ? ` ${r.mailingState}` : ''}
                  {r.mailingZip ? ` ${r.mailingZip}` : ''}
                  {r.justValue != null ? ` · Just value ${money(r.justValue)}` : ''}
                  {r.yearBuilt != null ? ` · Built ${r.yearBuilt}` : ''}
                  {r.livingArea != null ? ` · ${r.livingArea.toLocaleString()} sq ft living` : ''}
                </span>
                <br />
                <a
                  href="https://search.sunbiz.org/Inquiry/CorporationSearch/ByName"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#7dd3fc' }}
                >
                  Check this owner on Sunbiz (manual search — type the name) ↗
                </a>
                <br />
                {/* Slice 133 — copy YOUR invite link to paste into
                    your own outreach to this owner. They register
                    themselves; nothing is auto-emailed (roll data
                    has no email addresses, no email provider is
                    connected, and there is no consent). */}
                <button
                  type="button"
                  onClick={() => copyResearchInvite(i)}
                  style={{ marginTop: 6, fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#7dd3fc', cursor: 'pointer' }}
                >
                  {copiedResearchRow === i ? 'Invite link copied' : 'Copy invite link'}
                </button>
                <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>
                  Paste it into your own outreach — they register themselves.
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 0 }}>
        Florida only for parcel lookups — a state joins this lookup only after its real parcel service is verified live.
        Texas has no statewide parcel server (county-level only) and is not listed.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Slice 132 — per-result enrichment for one lookup result: the
// interactive map (Leaflet + OpenStreetMap, parcel polygon from
// the cadastral roll, county/ZCTA boundary from Census TIGERweb,
// toggleable Regrid parcel overlay), ZIP demographics (Census
// ACS), flood zone at the point (FEMA NFHL layer 28), and — for
// Broward parcels only — the county appraiser owner profile +
// sale history (BCPA_INFO / BCPA_SALES). Every number comes from
// a live API or reads "not provided"; a missing key reads "needs
// a free Census API key" / "needs a free HUD token"; a point with
// no mapped flood zone reads "not checked". Nothing here is
// estimated by the app.
// ---------------------------------------------------------------------------

interface ParcelBoundaryData {
  parcelId: string;
  rings: [number, number][][] | null;
  centroid: { lat: number; lng: number } | null;
}

interface BoundaryData {
  kind: string;
  key: string;
  name: string | null;
  centroid: { lat: number; lng: number } | null;
  geojson: { type: string; features?: unknown[] } | null;
}

interface BrowardInfo {
  ownerName: string | null;
  useCode: string | null;
  justBuildingValue: number | null;
  buildingSqft: number | null;
  yearBuilt: number | null;
  units: number | null;
  situsAddress: string | null;
  situsZip: string | null;
}

interface BrowardSale {
  saleDate: string | null;
  saleAmount: number | null;
  saleYear: string | null;
}

const money2 = (v: number | null | undefined): string =>
  v === null || v === undefined ? 'not provided' : `$${Math.round(v).toLocaleString()}`;

function ResultEnrichment({
  rec,
  countyCode,
  authToken,
}: {
  rec: PropertyLookupResult;
  countyCode: number;
  authToken: string | null;
}) {
  const [parcelBoundary, setParcelBoundary] = useState<ParcelBoundaryData | null>(null);
  const [parcelBoundaryNote, setParcelBoundaryNote] = useState('');
  const [countyBoundary, setCountyBoundary] = useState<BoundaryData | null>(null);
  const [demographics, setDemographics] = useState<Record<string, unknown> | null>(null);
  const [demographicsNote, setDemographicsNote] = useState('');
  const [broward, setBroward] = useState<{ info: BrowardInfo | null; sales: BrowardSale[] } | null>(null);
  const [browardNote, setBrowardNote] = useState('');
  const [flood, setFlood] = useState<Record<string, unknown> | null>(null);
  const [floodNote, setFloodNote] = useState('');

  const recKey = `${rec.source}|${rec.parcelId || rec.address}|${rec.lat ?? ''}|${rec.lng ?? ''}|${countyCode}`;

  useEffect(() => {
    let live = true;
    setParcelBoundary(null);
    setParcelBoundaryNote('');
    setCountyBoundary(null);
    setDemographics(null);
    setDemographicsNote('');
    setBroward(null);
    setBrowardNote('');
    setFlood(null);
    setFloodNote('');

    const authedJson = async (url: string): Promise<Record<string, unknown> | null> => {
      if (!authToken) return null;
      const r = await fetch(url, { headers: { authorization: `Bearer ${authToken}` } });
      return (await r.json()) as Record<string, unknown>;
    };
    const loadFlood = (lat: number, lng: number) => {
      fetch(`/api/flood-zone?lat=${lat}&lng=${lng}`)
        .then((r) => r.json())
        .then((j) => {
          if (live) setFlood(j as Record<string, unknown>);
        })
        .catch(() => {
          if (live) setFloodNote('Flood zone could not be checked.');
        });
    };

    // Demographics by ZIP (public route; the Census key, if any,
    // lives server-side).
    if (rec.zip && /^\d{5}$/.test(rec.zip)) {
      fetch(`/api/demographics?zip=${rec.zip}`)
        .then((r) => r.json())
        .then((j) => {
          if (live) setDemographics(j as Record<string, unknown>);
        })
        .catch(() => {
          if (live) setDemographicsNote('Demographics could not be loaded.');
        });
    }

    if (rec.source === 'census' && rec.lat != null && rec.lng != null) {
      loadFlood(rec.lat, rec.lng);
      if (rec.censusCountyFips && /^\d{5}$/.test(rec.censusCountyFips)) {
        fetch(`/api/boundary?countyFips=${rec.censusCountyFips}`)
          .then((r) => r.json())
          .then((j) => {
            if (live) setCountyBoundary(j as BoundaryData);
          })
          .catch(() => {});
      }
    }

    if (rec.source === 'fl_cadastral' && rec.parcelId) {
      authedJson(`/api/parcel-boundary?parcelId=${encodeURIComponent(rec.parcelId)}&countyCode=${countyCode}`)
        .then((j) => {
          if (!live || !j) return;
          if (j.error) {
            setParcelBoundaryNote(String(j.error));
            return;
          }
          const b = j as unknown as ParcelBoundaryData;
          setParcelBoundary(b);
          if (b.centroid) loadFlood(b.centroid.lat, b.centroid.lng);
        })
        .catch(() => {
          if (live) setParcelBoundaryNote('Parcel boundary could not be loaded.');
        });
      // County boundary polygon (registry FIPS only — the 10
      // counties the build brief verified; anything else is
      // skipped, never a guessed FIPS).
      const entry = countyByCode(countyCode);
      if (entry?.fips) {
        fetch(`/api/boundary?countyFips=${entry.fips}`)
          .then((r) => r.json())
          .then((j) => {
            if (live) setCountyBoundary(j as BoundaryData);
          })
          .catch(() => {});
      }
      // Broward County appraiser record — owner profile + deed
      // (sale) history, Broward parcels only.
      if (countyCode === 6) {
        authedJson(`/api/broward-record?folio=${encodeURIComponent(rec.parcelId)}`)
          .then((j) => {
            if (!live || !j) return;
            if (j.error) {
              setBrowardNote(String(j.error));
              return;
            }
            setBroward(j as unknown as { info: BrowardInfo | null; sales: BrowardSale[] });
          })
          .catch(() => {
            if (live) setBrowardNote('Broward record could not be loaded.');
          });
      }
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recKey]);

  const demo = demographics as
    | { mode?: string; year?: number; population?: number | null; medianIncome?: number | null; housingUnits?: number | null; ownerOccupied?: number | null; renterOccupied?: number | null; medianHomeValue?: number | null; medianGrossRent?: number | null; error?: string }
    | null;
  const floodData = flood as { mode?: string; zone?: string | null; zoneSubtype?: string | null; inSfha?: boolean | null; error?: string } | null;

  const mapCenter =
    rec.source === 'census' && rec.lat != null && rec.lng != null
      ? { lat: rec.lat, lng: rec.lng }
      : parcelBoundary?.centroid || null;

  return (
    <div style={{ marginTop: 10 }}>
      {mapCenter && (
        <PropertyMap
          center={mapCenter}
          zoom={17}
          markerLabel={rec.source === 'census' ? rec.matchedAddress || rec.address : rec.address || `Parcel ${rec.parcelId || ''}`}
          parcelRings={parcelBoundary?.rings || null}
          boundaryGeojson={countyBoundary?.geojson || null}
          boundaryLabel={countyBoundary?.name ? `${countyBoundary.name} (U.S. Census TIGERweb)` : undefined}
        />
      )}
      {rec.source === 'fl_cadastral' && !mapCenter && !parcelBoundaryNote && (
        <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading parcel boundary…</p>
      )}
      {parcelBoundaryNote && <p style={{ fontSize: 13, color: '#fbbf24' }}>{parcelBoundaryNote}</p>}
      {rec.source === 'fl_cadastral' && parcelBoundary && !parcelBoundary.rings && !parcelBoundaryNote && (
        <p style={{ fontSize: 13, color: '#94a3b8' }}>Parcel boundary not available for this parcel — the roll returned no geometry.</p>
      )}

      {(rec.zip || demographicsNote) && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 13.5 }}>Demographics — ZIP {rec.zip}</strong>
          {demographicsNote && <p style={{ fontSize: 13, color: '#fbbf24', margin: '4px 0' }}>{demographicsNote}</p>}
          {demo?.error ? (
            <p style={{ fontSize: 13.5, margin: '4px 0' }}>{demo.error}</p>
          ) : demo?.mode === 'not_configured' ? (
            <p style={{ fontSize: 13.5, margin: '4px 0' }}>Demographics need a free Census API key — the operator has not added one yet, so no numbers are shown here.</p>
          ) : demo?.mode === 'ok' ? (
            <p style={{ fontSize: 13.5, margin: '4px 0', color: '#cbd5e1' }}>
              Population: {demo.population?.toLocaleString() ?? 'not provided'} · Median household income:{' '}
              {demo.medianIncome != null ? `$${demo.medianIncome.toLocaleString()}` : 'not provided'}
              <br />
              Housing units: {demo.housingUnits?.toLocaleString() ?? 'not provided'} · Owner-occupied:{' '}
              {demo.ownerOccupied?.toLocaleString() ?? 'not provided'} · Renter-occupied:{' '}
              {demo.renterOccupied?.toLocaleString() ?? 'not provided'}
              <br />
              Median home value: {demo.medianHomeValue != null ? `$${demo.medianHomeValue.toLocaleString()}` : 'not provided'}
              {' '}· Median gross rent: {demo.medianGrossRent != null ? `$${demo.medianGrossRent.toLocaleString()}` : 'not provided'}
              <br />
              <span style={{ color: '#94a3b8', fontSize: 12 }}>U.S. Census Bureau, American Community Survey {demo.year} 5-year, ZIP Code Tabulation Area.</span>
            </p>
          ) : (
            rec.zip && <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0' }}>Loading demographics…</p>
          )}
        </div>
      )}

      {(flood || floodNote) && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 13.5 }}>Flood zone</strong>
          {floodNote && <p style={{ fontSize: 13, color: '#fbbf24', margin: '4px 0' }}>{floodNote}</p>}
          {floodData?.error ? (
            <p style={{ fontSize: 13.5, margin: '4px 0' }}>{floodData.error}</p>
          ) : floodData?.mode === 'ok' ? (
            <p style={{ fontSize: 13.5, margin: '4px 0' }}>
              Zone <strong>{floodData.zone}</strong>
              {floodData.zoneSubtype ? ` (${floodData.zoneSubtype})` : ''}
              {floodData.inSfha === true ? ' — in a Special Flood Hazard Area' : floodData.inSfha === false ? ' — outside the Special Flood Hazard Area' : ''}
              <br />
              <span style={{ color: '#94a3b8', fontSize: 12 }}>
                From FEMA&apos;s effective flood map (National Flood Hazard Layer). Not a Standard Flood Hazard Determination, not a
                flood prediction, and not an insurance quote.
              </span>
            </p>
          ) : floodData?.mode === 'no_data' ? (
            <p style={{ fontSize: 13.5, margin: '4px 0' }}>Flood zone not checked — FEMA has no mapped flood hazard zone at this point.</p>
          ) : null}
        </div>
      )}

      {rec.source === 'fl_cadastral' && countyCode === 6 && (broward || browardNote) && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 13.5 }}>Broward County appraiser record — deed history &amp; owner profile</strong>
          {browardNote && <p style={{ fontSize: 13, color: '#fbbf24', margin: '4px 0' }}>{browardNote}</p>}
          {broward && (
            <>
              {broward.info ? (
                <p style={{ fontSize: 13.5, margin: '4px 0', color: '#cbd5e1' }}>
                  Owner (county record): {broward.info.ownerName || 'not provided'}
                  {broward.info.useCode ? ` · Use code ${broward.info.useCode}` : ''}
                  <br />
                  Building value: {money2(broward.info.justBuildingValue)} · Building sq ft:{' '}
                  {broward.info.buildingSqft != null ? broward.info.buildingSqft.toLocaleString() : 'not provided'}
                  {' · '}Year built: {broward.info.yearBuilt ?? 'not provided'}
                  {broward.info.units != null ? ` · Units: ${broward.info.units}` : ''}
                  <br />
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>
                    Situs: {broward.info.situsAddress || 'not provided'}
                    {broward.info.situsZip ? ` ${broward.info.situsZip}` : ''} · Source: Broward County Property Appraiser (BCPA_INFO).
                  </span>
                </p>
              ) : (
                <p style={{ fontSize: 13.5, margin: '4px 0' }}>No Broward County appraiser record for this folio.</p>
              )}
              {broward.sales.length > 0 ? (
                <ul style={{ fontSize: 13.5, margin: '4px 0', paddingLeft: 18 }}>
                  {broward.sales.map((s, i) => (
                    <li key={i}>
                      Sold {s.saleDate || 'date not provided'}
                      {s.saleAmount != null ? ` — ${money2(s.saleAmount)}` : ' — amount not provided'}
                      {s.saleYear ? ` (${s.saleYear})` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                broward.info && <p style={{ fontSize: 13.5, margin: '4px 0' }}>No recorded sales for this folio in the Broward sales table.</p>
              )}
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                Sale history from the Broward County Property Appraiser sales table (BCPA_SALES). The county appraiser is the live
                record; the statewide roll is a yearly snapshot.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
