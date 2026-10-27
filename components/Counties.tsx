'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadCountyLinks } from '../lib/directories';

// County records, ported from the old prototype. ONE verified seed county only:
// St. Lucie, FL (FIPS 12111), with the 5 URLs verified live Oct 24, 2026.
// Every other county is user-added only, labeled unverified — NO guessed URLs.
// Importing a list yields owner name + mailing address only, never phones/emails.
const ST_LUCIE = [
  { label: 'Clerk — Official Records Search', url: 'https://stlucieclerk.com', note: 'Clerk of Court official records.' },
  { label: 'City of Fort Pierce — homepage', url: 'https://cityoffortpierce.com', note: 'Look for Code Enforcement on the city site — this is NOT a violations portal.' },
  { label: 'Fort Pierce Utilities — records request', url: 'https://fpua.com', note: 'Records-request route only — shutoff lists are NOT published. Florida Ch. 119, not federal FOIA.' },
  { label: "St. Lucie Sheriff", url: 'https://stluciesheriff.com', note: 'Caution: an arrest does not mean intent to sell.' },
  { label: 'Property Appraiser', url: 'https://paslc.gov', note: 'Current appraiser site (paslc.org also resolves).' },
];

export default function Counties({ userId }: { userId: string | null }) {
  const [added, setAdded] = useState<string[]>([]);
  const [dbLinks, setDbLinks] = useState<{ label: string; url: string; note: string }[] | null>(null);
  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadCountyLinks().then((rows) => {
        const st = rows?.find((r) => r.county_name === 'St. Lucie');
        if (st) setDbLinks([
          { label: 'Clerk — Official Records Search', url: st.clerk_court_deeds_url || '', note: 'Clerk of Court official records.' },
          { label: 'City of Fort Pierce — homepage', url: st.code_enforcement_url || '', note: 'Look for Code Enforcement on the city site — this is NOT a violations portal.' },
          { label: 'Fort Pierce Utilities — records request', url: st.utility_records_url || '', note: 'Records-request route only — shutoff lists are NOT published. Florida Ch. 119, not federal FOIA.' },
          { label: 'St. Lucie Sheriff', url: st.arrest_logs_url || '', note: 'Caution: an arrest does not mean intent to sell.' },
          { label: 'Property Appraiser', url: st.tax_assessor_gis_url || '', note: 'Current appraiser site (paslc.org also resolves).' },
        ].filter((l) => l.url));
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const shown = dbLinks ?? ST_LUCIE;
  const [county, setCounty] = useState('');

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>County Records — St. Lucie, FL (Verified Seed)</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>FIPS 12111. Pick a county to work — the app does not auto-detect your location.</p>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Source: {dbLinks ? 'Supabase county_portal_links (verified St. Lucie seed)' : 'Built-in St. Lucie links — sign in with Supabase configured to read them from the database.'}</p>
      <ul>
        {shown.map((c) => <li key={c.url}><a href={c.url} target="_blank" rel="noreferrer">{c.label}</a> — {c.note}</li>)}
      </ul>
      <p style={{ fontSize: 13 }}>Extraction guide: use the county links above, then import the list yourself. Import gives owner name + mailing address only.</p>
      <input placeholder="Add a county you work (links stay blank until you add them)" value={county} onChange={(e) => setCounty(e.target.value)} style={{ marginRight: 8 }} />
      <button onClick={() => { if (county.trim()) { setAdded([county, ...added]); setCounty(''); } }}>Add county (unverified)</button>
      <ul>{added.map((c) => <li key={c}>{c} — unverified, no links guessed</li>)}</ul>
    </section>
  );
}
