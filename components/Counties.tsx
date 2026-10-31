'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadCountyLinks, loadStateDirectories, type CountyLinkRow, type StateDirectoryRow } from '../lib/directories';

// County records (Slice 22). Two platform-verified layers, both read
// from Supabase — nothing here is guessed:
//  1. State directories: one official state-level directory per state
//     (state_directory_links) that lists/links the state's county
//     clerks, recorders, or county offices.
//  2. Florida counties: all 67 counties with their official Clerk of
//     Court and Property Appraiser sites verified by opening them
//     (Oct 31, 2026), plus sheriff sites where verified. Link types the
//     platform set does not cover for a county (code enforcement and
//     utility are usually city-level) are shown as not covered — never
//     filled with a plausible guess.
// St. Lucie keeps its original five-link seed (verified Oct 24, 2026).
// Counties a wholesaler adds below are their own working notes for this
// session, labeled unverified; saving your own links permanently is
// Slice 23.

interface LinkLine { label: string; url?: string | null; note: string }

function countyLines(c: CountyLinkRow): LinkLine[] {
  return [
    { label: 'Clerk of Court — official records (deeds, foreclosures, probate)', url: c.clerk_court_deeds_url, note: 'The county clerk’s own site.' },
    { label: 'Property Appraiser — parcel / GIS records', url: c.tax_assessor_gis_url, note: 'The county property appraiser’s own site.' },
    { label: 'Sheriff’s Office', url: c.arrest_logs_url, note: 'Caution: an arrest does not mean intent to sell.' },
    { label: 'Code enforcement', url: c.code_enforcement_url, note: 'Often a city page, not a county portal.' },
    { label: 'Utility records', url: c.utility_records_url, note: 'Records-request route only — shutoff lists are generally NOT published.' },
  ];
}

export default function Counties({ userId }: { userId: string | null }) {
  const [states, setStates] = useState<StateDirectoryRow[]>([]);
  const [counties, setCounties] = useState<CountyLinkRow[]>([]);
  const [stateCode, setStateCode] = useState('FL');
  const [countyName, setCountyName] = useState('St. Lucie');
  const [added, setAdded] = useState<string[]>([]);
  const [county, setCounty] = useState('');
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadStateDirectories().then((rows) => { if (rows) setStates(rows); }).catch(() => setLoadErr('State directories could not be loaded — check the connection.'));
      loadCountyLinks().then((rows) => { if (rows) setCounties(rows.filter((r) => !r.added_by)); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const selState = states.find((s) => s.state_code === stateCode);
  const flCounties = counties.filter((c) => c.state_code === 'FL');
  const selCounty = flCounties.find((c) => c.county_name === countyName) || flCounties[0];

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>County Records — state directories & verified Florida counties</h2>
      {!userId && <p style={{ fontSize: 13 }}>Sign in to load the verified directories from the database.</p>}
      {loadErr && <p style={{ fontSize: 13, color: '#fbbf24' }}>{loadErr}</p>}

      <h3 style={{ marginBottom: 6 }}>1 · Your state’s official county directory</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Every state below has one verified directory — run by the state or its county clerks’/counties’ association —
        that lists or links the county records offices in that state. Pick your state, open the directory, find your county.
      </p>
      <select value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
        {states.map((s) => <option key={s.state_code} value={s.state_code}>{s.state_name}</option>)}
      </select>
      {selState ? (
        <p style={{ fontSize: 13.5 }}>
          <a href={selState.directory_url} target="_blank" rel="noreferrer">{selState.state_name} county directory</a>
          {selState.run_by ? <> — run by {selState.run_by}</> : null} · <span style={{ color: '#4ade80' }}>Platform verified</span>
        </p>
      ) : (
        <p style={{ fontSize: 13 }}>{states.length === 0 ? 'Directories are loading from the database…' : 'No verified directory for this state yet.'}</p>
      )}

      <h3 style={{ marginBottom: 6 }}>2 · Florida counties — platform verified, county by county</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        All 67 Florida counties with the Clerk of Court and Property Appraiser sites the platform verified by opening them.
        Where a link type isn’t in the platform set for a county, it says so — nothing is guessed.
      </p>
      <select value={selCounty?.county_name || ''} onChange={(e) => setCountyName(e.target.value)}>
        {flCounties.map((c) => <option key={c.county_name} value={c.county_name}>{c.county_name} County</option>)}
      </select>
      {selCounty && (
        <ul>
          {countyLines(selCounty).map((l) => (
            <li key={l.label} style={{ fontSize: 13.5 }}>
              {l.url
                ? <><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a> — {l.note}</>
                : <span style={{ color: '#94a3b8' }}>{l.label} — not in the platform set for this county yet.</span>}
            </li>
          ))}
        </ul>
      )}
      <p style={{ fontSize: 13 }}>Extraction guide: use the county links above, then import the list yourself. Import gives owner name + mailing address only — never phones or emails.</p>

      <h3 style={{ marginBottom: 6 }}>3 · Counties you work that aren’t covered yet</h3>
      <input placeholder="Add a county you work" value={county} onChange={(e) => setCounty(e.target.value)} style={{ marginRight: 8 }} />
      <button onClick={() => { if (county.trim()) { setAdded([county, ...added]); setCounty(''); } }}>Add county (unverified)</button>
      <ul>{added.map((c) => <li key={c} style={{ fontSize: 13 }}>{c} — unverified, no links guessed. Use your state directory above to find its offices.</li>)}</ul>
    </section>
  );
}
