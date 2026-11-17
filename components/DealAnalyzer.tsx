'use client';

import { useEffect, useState } from 'react';
import { calculateMAO, totalMarketplaceCost, isOverMAO } from '../lib/mao';
import { suggestAssignmentFee, type PropertyKind } from '../lib/fee-guide';
import { ESTIMATE_TOTAL_KEY } from '../lib/estimator';
import { PROPERTY_LOOKUP_MAO_KEY, PROPERTY_LOOKUP_MAO_EVENT, type LookupMaoLoad } from '../lib/property-lookup';
import PropertyLookup from './PropertyLookup';
import type { LookupLocation } from './PropertyLookup';

export default function DealAnalyzer({ userId }: { userId?: string | null }) {
  const [arv, setArv] = useState(300000);
  const [contractPrice, setContractPrice] = useState(150000);
  const [repairs, setRepairs] = useState(50000);
  const [fromEstimator, setFromEstimator] = useState(false);

  // Slice 79 — the Repair Estimator feeds this field: a live event
  // when its "Use this total" button is tapped, and the saved total
  // on mount so the figure survives navigation. The note under the
  // field says where the number came from; it stays fully editable.
  useEffect(() => {
    const apply = (total: number) => { setRepairs(total); setFromEstimator(true); };
    try {
      const saved = localStorage.getItem(ESTIMATE_TOTAL_KEY);
      if (saved && Number(saved) > 0) apply(Number(saved));
    } catch { /* no saved estimate — the default stands */ }
    const onEstimate = (e: Event) => {
      const total = (e as CustomEvent).detail;
      if (typeof total === 'number') apply(total);
    };
    window.addEventListener('ws-repair-estimate', onEstimate);
    return () => window.removeEventListener('ws-repair-estimate', onEstimate);
  }, []);
  const [fee, setFee] = useState(10000);
  const [customFee, setCustomFee] = useState('');
  const [kind, setKind] = useState<PropertyKind>('house');
  const [fromLookup, setFromLookup] = useState(false);
  // Slice 132 — underwriting location, lifted from the Property
  // Lookup above (first result) or typed in by hand as a ZIP
  // fallback. Nothing here is estimated by the app: every number
  // comes from a live free API or reads "not provided" / "not
  // connected". The existing 70% Rule / MAO math above is
  // untouched.
  const [location, setLocation] = useState<LookupLocation | null>(null);
  const [manualZip, setManualZip] = useState('');

  // Slice 123 — a property lookup can load this calculator: ARV
  // from the roll's just value, House/Land from the DOR use code.
  // Same handoff shape as the Repair Estimator above: a live event
  // when the analyzer is on screen, and the saved load on mount so
  // the figure survives navigation. Only ARV and the type are set —
  // contract price and repairs stay the wholesaler's own numbers.
  useEffect(() => {
    const apply = (load: LookupMaoLoad) => {
      if (typeof load.arv === 'number' && load.arv > 0) setArv(load.arv);
      if (load.kind === 'house' || load.kind === 'land') setKind(load.kind);
      setFromLookup(true);
    };
    try {
      const saved = localStorage.getItem(PROPERTY_LOOKUP_MAO_KEY);
      if (saved) {
        const load = JSON.parse(saved) as LookupMaoLoad;
        if (load && typeof load.arv === 'number') apply(load);
      }
    } catch { /* no saved lookup — the defaults stand */ }
    const onLookup = (e: Event) => {
      const load = (e as CustomEvent).detail as LookupMaoLoad;
      if (load) apply(load);
    };
    window.addEventListener(PROPERTY_LOOKUP_MAO_EVENT, onLookup);
    return () => window.removeEventListener(PROPERTY_LOOKUP_MAO_EVENT, onLookup);
  }, []);
  const guide = suggestAssignmentFee(kind, arv, repairs, contractPrice);

  const mao = calculateMAO(arv, repairs, fee);
  const total = totalMarketplaceCost(contractPrice, fee);
  const over = isOverMAO(contractPrice, mao);

  return (
    <section id="deal-analyzer" style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Deal Analyzer — MAO</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        MAO = (ARV × 0.70) − Repairs − Assignment Fee. Seller A-B view shows
        price only; buyer B-C view shows the full breakdown. Contracts
        require attorney review before use.
      </p>
      {fromLookup && (
        <p style={{ fontSize: 12.5, color: '#6ee7b7', margin: 0 }}>ARV and property type loaded from a property lookup — the ARV is the county roll&apos;s just value, not a market valuation. Edit freely.</p>
      )}
      {/* Slice 123 — look a property up without leaving the analyzer. */}
      <PropertyLookup userId={userId ?? null} onResult={setLocation} />
      <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <label>ARV $ <input type="number" value={arv} onChange={(e) => setArv(Number(e.target.value))} /></label>
        <label>Contract price $ <input type="number" value={contractPrice} onChange={(e) => setContractPrice(Number(e.target.value))} /></label>
        <label>Repairs $ <input type="number" value={repairs} onChange={(e) => { setRepairs(Number(e.target.value)); setFromEstimator(false); }} /></label>
        {fromEstimator && (
          <p style={{ fontSize: 12.5, color: '#6ee7b7', margin: 0 }}>Set from your Repair Estimator — edit freely.</p>
        )}
        <div>
          <button onClick={() => setFee(10000)}>$10,000 fee</button>{' '}
          <button onClick={() => setFee(20000)}>$20,000 fee</button>{' '}
          <input
            placeholder="Custom fee"
            value={customFee}
            onChange={(e) => { setCustomFee(e.target.value); if (e.target.value) setFee(Number(e.target.value)); }}
            style={{ width: 120 }}
          />
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Assignment fee guide</div>
          <div style={{ margin: '8px 0' }}>
            <button onClick={() => setKind('house')}>🏠 House</button>{' '}
            <button onClick={() => setKind('land')}>🌳 Land</button>
          </div>
          <p style={{ margin: '4px 0', fontSize: 13.5 }}>Room in this deal: <strong>${guide.room.toLocaleString()}</strong> <span style={{ color: '#94a3b8' }}>(buyer budget at the 70% rule, minus your contract price)</span></p>
          <p style={{ margin: '4px 0', fontSize: 13.5 }}>Suggested fee: <strong>${guide.suggested.toLocaleString()}</strong></p>
          <p style={{ margin: '4px 0', fontSize: 12.5, color: '#94a3b8' }}>{guide.note}</p>
          {guide.suggested > 0 && (
            <button onClick={() => { setFee(guide.suggested); setCustomFee(String(guide.suggested)); }}>Use suggested fee</button>
          )}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <p><strong>MAO: ${mao.toLocaleString()}</strong></p>
        <p>Total Marketplace Cost (price + fee): ${total.toLocaleString()}</p>
        {over && <p style={{ color: '#f87171' }}>⚠️ Over MAO — contract price is above MAO. Do not proceed on this price without reworking it.</p>}
        {!over && <p style={{ color: '#4ade80' }}>Within MAO.</p>}
      </div>
      <div style={{ marginTop: 20, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '14px 16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Underwriting — live data only</h3>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px' }}>
          Fed only by the live free APIs: HUD Fair Market Rent, Census demographics, and the FEMA flood zone — from the property
          lookup above, or a ZIP typed in by hand. Every number comes from the live API or reads &ldquo;not provided&rdquo;; a line whose
          service is not connected reads &ldquo;not connected&rdquo; and shows nothing fake. The app never estimates a rent, a value, or a
          flood zone.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <input
            placeholder="ZIP code (manual check)"
            value={manualZip}
            onChange={(e) => setManualZip(e.target.value)}
            style={{ width: 160 }}
          />
          <button
            onClick={() => {
              const z = manualZip.trim();
              if (/^\d{5}$/.test(z)) setLocation({ lat: null, lng: null, zip: z, countyFips: null });
            }}
          >
            Check this ZIP
          </button>
          {location?.zip && (
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>
              Underwriting for ZIP {location.zip}
              {location.countyFips ? ` · county FIPS ${location.countyFips}` : ''}
            </span>
          )}
        </div>
        <UnderwritingPanel location={location} />
      </div>
    </section>
  );
}

// Slice 132 — underwriting panel for the Deal Analyzer. Fed ONLY
// by the live free APIs: HUD rents (/api/fmr, county FIPS),
// Census demographics (/api/demographics, ZIP), FEMA flood zone
// (/api/flood-zone, lat/lng). Every number from a live API or
// "not provided"; a missing key reads "not connected". A manual
// ZIP gives demographics only — without a lookup there is no
// county FIPS for rents and no point for the flood check, and
// both lines say so instead of guessing.

interface DemographicsState {
  mode?: string;
  year?: number;
  population?: number | null;
  medianIncome?: number | null;
  housingUnits?: number | null;
  ownerOccupied?: number | null;
  renterOccupied?: number | null;
  medianHomeValue?: number | null;
  medianGrossRent?: number | null;
  error?: string;
}

interface FmrState {
  mode?: string;
  year?: string | null;
  countyName?: string | null;
  metroName?: string | null;
  efficiency?: number | null;
  oneBedroom?: number | null;
  twoBedroom?: number | null;
  threeBedroom?: number | null;
  fourBedroom?: number | null;
  error?: string;
}

interface FloodState {
  mode?: string;
  zone?: string | null;
  zoneSubtype?: string | null;
  inSfha?: boolean | null;
  error?: string;
}

function UnderwritingPanel({ location }: { location: LookupLocation | null }) {
  const [demographics, setDemographics] = useState<DemographicsState | null>(null);
  const [fmr, setFmr] = useState<FmrState | null>(null);
  const [flood, setFlood] = useState<FloodState | null>(null);

  const zip = location?.zip || null;
  const countyFips = location?.countyFips || null;
  const lat = location?.lat ?? null;
  const lng = location?.lng ?? null;

  useEffect(() => {
    setDemographics(null);
    setFmr(null);
    setFlood(null);
    if (!location) return;
    if (zip && /^\d{5}$/.test(zip)) {
      fetch(`/api/demographics?zip=${zip}`)
        .then((r) => r.json())
        .then((j) => setDemographics(j as DemographicsState))
        .catch(() => setDemographics({ error: 'Demographics could not be loaded.' }));
    }
    if (countyFips && /^\d{5}$/.test(countyFips)) {
      fetch(`/api/fmr?countyFips=${countyFips}`)
        .then((r) => r.json())
        .then((j) => setFmr(j as FmrState))
        .catch(() => setFmr({ error: 'Fair Market Rent could not be loaded.' }));
    }
    if (lat != null && lng != null) {
      fetch(`/api/flood-zone?lat=${lat}&lng=${lng}`)
        .then((r) => r.json())
        .then((j) => setFlood(j as FloodState))
        .catch(() => setFlood({ error: 'Flood zone could not be checked.' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip, countyFips, lat, lng]);

  if (!location) {
    return <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0 }}>Run a property lookup above, or type a ZIP, to see live underwriting data.</p>;
  }

  return (
    <div style={{ fontSize: 13.5, color: '#e2e8f0' }}>
      <h4 style={{ margin: '0 0 4px' }}>Demographics — ZIP {zip || 'not given'}</h4>
      {demographics?.error ? (
        <p style={{ margin: '4px 0' }}>{demographics.error}</p>
      ) : demographics?.mode === 'not_configured' ? (
        <p style={{ margin: '4px 0' }}>Demographics not connected — needs a free Census API key; the operator has not added one yet, so no numbers are shown here.</p>
      ) : demographics?.mode === 'ok' ? (
        <p style={{ margin: '4px 0' }}>
          Population: {demographics.population?.toLocaleString() ?? 'not provided'} · Median household income:{' '}
          {demographics.medianIncome != null ? `$${demographics.medianIncome.toLocaleString()}` : 'not provided'}
          <br />
          Housing units: {demographics.housingUnits?.toLocaleString() ?? 'not provided'} · Owner-occupied:{' '}
          {demographics.ownerOccupied?.toLocaleString() ?? 'not provided'} · Renter-occupied:{' '}
          {demographics.renterOccupied?.toLocaleString() ?? 'not provided'}
          <br />
          Median home value: {demographics.medianHomeValue != null ? `$${demographics.medianHomeValue.toLocaleString()}` : 'not provided'}
          {' '}· Median gross rent: {demographics.medianGrossRent != null ? `$${demographics.medianGrossRent.toLocaleString()}` : 'not provided'}
          <br />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>U.S. Census Bureau, American Community Survey {demographics.year} 5-year, ZIP Code Tabulation Area.</span>
        </p>
      ) : zip ? (
        <p style={{ margin: '4px 0', color: '#94a3b8' }}>Loading demographics…</p>
      ) : (
        <p style={{ margin: '4px 0' }}>Demographics not provided — no ZIP from this lookup.</p>
      )}

      <h4 style={{ margin: '12px 0 4px' }}>Fair Market Rent — county</h4>
      {fmr?.error ? (
        <p style={{ margin: '4px 0' }}>{fmr.error}</p>
      ) : fmr?.mode === 'not_configured' ? (
        <p style={{ margin: '4px 0' }}>Fair Market Rent not connected — needs a free HUD token; the operator has not added one yet, so no rents are shown here.</p>
      ) : fmr?.mode === 'ok' ? (
        <p style={{ margin: '4px 0' }}>
          {fmr.countyName || fmr.metroName || ''}{fmr.year ? ` (${fmr.year})` : ''}: Efficiency{' '}
          {fmr.efficiency != null ? `$${fmr.efficiency.toLocaleString()}` : 'not provided'} · 1-bed{' '}
          {fmr.oneBedroom != null ? `$${fmr.oneBedroom.toLocaleString()}` : 'not provided'} · 2-bed{' '}
          {fmr.twoBedroom != null ? `$${fmr.twoBedroom.toLocaleString()}` : 'not provided'} · 3-bed{' '}
          {fmr.threeBedroom != null ? `$${fmr.threeBedroom.toLocaleString()}` : 'not provided'} · 4-bed{' '}
          {fmr.fourBedroom != null ? `$${fmr.fourBedroom.toLocaleString()}` : 'not provided'}
          <br />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>U.S. Department of Housing and Urban Development, Fair Market Rents. This product uses the HUD User Data API but is not endorsed or certified by HUD User.</span>
        </p>
      ) : countyFips ? (
        <p style={{ margin: '4px 0', color: '#94a3b8' }}>Loading Fair Market Rent…</p>
      ) : (
        <p style={{ margin: '4px 0' }}>Fair Market Rent not provided — no county from this lookup (a manual ZIP alone does not name a county).</p>
      )}

      <h4 style={{ margin: '12px 0 4px' }}>Flood zone</h4>
      {flood?.error ? (
        <p style={{ margin: '4px 0' }}>{flood.error}</p>
      ) : flood?.mode === 'ok' ? (
        <p style={{ margin: '4px 0' }}>
          Zone <strong>{flood.zone}</strong>
          {flood.zoneSubtype ? ` (${flood.zoneSubtype})` : ''}
          {flood.inSfha === true ? ' — in a Special Flood Hazard Area' : flood.inSfha === false ? ' — outside the Special Flood Hazard Area' : ''}
          <br />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            From FEMA&apos;s effective flood map (National Flood Hazard Layer). Not a Standard Flood Hazard Determination, not a flood
            prediction, and not an insurance quote.
          </span>
        </p>
      ) : flood?.mode === 'no_data' ? (
        <p style={{ margin: '4px 0' }}>Flood zone not checked — FEMA has no mapped flood hazard zone at this point.</p>
      ) : lat != null && lng != null ? (
        <p style={{ margin: '4px 0', color: '#94a3b8' }}>Checking flood zone…</p>
      ) : (
        <p style={{ margin: '4px 0' }}>Flood zone not checked — no precise point from this lookup (a manual ZIP alone has no point).</p>
      )}
    </div>
  );
}
