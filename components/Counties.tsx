'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadCountyLinks, loadStateDirectories, loadUserCounties, saveUserCounty, deleteUserCounty, US_STATES, type CountyLinkRow, type StateDirectoryRow } from '../lib/directories';
import StateRecords from './StateRecords';

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
// Slice 23: wholesalers save their OWN links for counties the platform
// set doesn't cover (schema v4.0 — one private row per user per
// county). Their rows are labeled "your links — unverified" and are
// visible only to them. Counties many wholesalers save surface in the
// owner's Verify Queue for a future platform verification batch.

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
  const [loadErr, setLoadErr] = useState('');
  const [mine, setMine] = useState<CountyLinkRow[]>([]);
  const [fState, setFState] = useState('FL');
  const [fCounty, setFCounty] = useState('');
  const [fClerk, setFClerk] = useState('');
  const [fAppraiser, setFAppraiser] = useState('');
  const [fSheriff, setFSheriff] = useState('');
  const [fCode, setFCode] = useState('');
  const [fUtility, setFUtility] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMsg, setFormMsg] = useState('');
  const [formBusy, setFormBusy] = useState(false);

  const refreshMine = () => {
    if (userId) loadUserCounties(userId).then(setMine).catch(() => {});
  };

  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadStateDirectories().then((rows) => { if (rows) setStates(rows); }).catch(() => setLoadErr('State directories could not be loaded — check the connection.'));
      loadCountyLinks().then((rows) => { if (rows) setCounties(rows.filter((r) => !r.added_by)); }).catch(() => {});
      refreshMine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const resetForm = () => {
    setFCounty(''); setFClerk(''); setFAppraiser(''); setFSheriff(''); setFCode(''); setFUtility('');
    setEditingId(null);
  };

  const startEdit = (r: CountyLinkRow) => {
    setFState(r.state_code);
    setFCounty(r.county_name);
    setFClerk(r.clerk_court_deeds_url || '');
    setFAppraiser(r.tax_assessor_gis_url || '');
    setFSheriff(r.arrest_logs_url || '');
    setFCode(r.code_enforcement_url || '');
    setFUtility(r.utility_records_url || '');
    setEditingId(r.id || null);
    setFormMsg(`Editing your saved links for ${r.county_name} County, ${r.state_code}.`);
  };

  const saveMine = async () => {
    if (!userId) return;
    setFormBusy(true);
    setFormMsg('');
    try {
      await saveUserCounty(userId, {
        state_code: fState,
        county_name: fCounty,
        clerk_court_deeds_url: fClerk,
        tax_assessor_gis_url: fAppraiser,
        arrest_logs_url: fSheriff,
        code_enforcement_url: fCode,
        utility_records_url: fUtility,
      });
      setFormMsg(`Saved. ${fCounty.trim()} County, ${fState} is now in your list below — your links, unverified.`);
      resetForm();
      refreshMine();
    } catch {
      setFormMsg('That save failed — check the connection and that the county name is filled in, then try again.');
    }
    setFormBusy(false);
  };

  const removeMine = async (r: CountyLinkRow) => {
    if (!r.id) return;
    try {
      await deleteUserCounty(r.id);
      if (editingId === r.id) resetForm();
      refreshMine();
    } catch {
      setFormMsg('Delete failed — check the connection and try again.');
    }
  };

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

      <StateRecords userId={userId} />

      <h3 style={{ marginBottom: 6 }}>3 · Your own county links — saved to your office</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Work a county the platform set doesn’t cover yet? Find its offices through your state directory above,
        paste the links here, and they’re saved to YOUR office only — labeled unverified, never shown to anyone else.
        When many wholesalers save the same county, it moves up the platform’s verification list.
      </p>
      {!userId ? (
        <p style={{ fontSize: 13 }}>Sign in to save your own county links.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 6, maxWidth: 560 }}>
            <label style={{ fontSize: 13 }}>
              State{' '}
              <select value={fState} onChange={(e) => setFState(e.target.value)}>
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </label>
            <input placeholder="County name (e.g. Cook)" value={fCounty} onChange={(e) => setFCounty(e.target.value)} />
            <input placeholder="Clerk of Court URL" value={fClerk} onChange={(e) => setFClerk(e.target.value)} />
            <input placeholder="Property Appraiser URL" value={fAppraiser} onChange={(e) => setFAppraiser(e.target.value)} />
            <input placeholder="Sheriff's Office URL" value={fSheriff} onChange={(e) => setFSheriff(e.target.value)} />
            <input placeholder="Code enforcement URL" value={fCode} onChange={(e) => setFCode(e.target.value)} />
            <input placeholder="Utility records URL" value={fUtility} onChange={(e) => setFUtility(e.target.value)} />
          </div>
          <p style={{ marginTop: 8 }}>
            <button onClick={saveMine} disabled={formBusy || !fCounty.trim()}>
              {formBusy ? 'Saving…' : editingId ? 'Update my links' : 'Save my links'}
            </button>
            {editingId && <button onClick={resetForm} style={{ marginLeft: 8 }}>Cancel edit</button>}
          </p>
          {formMsg && <p style={{ fontSize: 13 }}>{formMsg}</p>}
          {mine.length > 0 && (
            <>
              <h4 style={{ marginBottom: 6 }}>Your saved counties</h4>
              {mine.map((r) => (
                <div key={r.id} style={{ borderTop: '1px solid #334155', paddingTop: 8, marginTop: 8 }}>
                  <p style={{ fontSize: 13.5, margin: 0 }}>
                    <strong>{r.county_name} County, {r.state_code}</strong>{' '}
                    <span style={{ color: '#fbbf24' }}>Your links — unverified</span>{' '}
                    <button onClick={() => startEdit(r)}>Edit</button>{' '}
                    <button onClick={() => removeMine(r)}>Delete</button>
                  </p>
                  <ul style={{ marginTop: 4 }}>
                    {countyLines(r).map((l) => (
                      <li key={l.label} style={{ fontSize: 13.5 }}>
                        {l.url
                          ? <a href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
                          : <span style={{ color: '#94a3b8' }}>{l.label} — not saved yet.</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
