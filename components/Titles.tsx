'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadTitleCompanies, type TitleCompanyRow } from '../lib/directories';

// Title directory, ported from the old prototype. Seeds match production/schema.sql exactly.
// Only CLOSED Title carries verified Handles badges in the prototype; all others are
// "advertises investor services — confirm directly." User additions are labeled unverified.
const SEEDS = [
  { name: 'CLOSED Title', states: 'FL, TN, TX, OH, OK, UT', website: 'https://www.closedtitle.com/investors', note: 'Advertises assignments, double closings, subject-to. Confirm directly.' },
  { name: 'Empora Title', states: 'OH, KY, IN, MI, MO, PA, FL', website: '', note: 'Investor-focused; confirm your transaction structure directly.' },
  { name: 'Marina Title', states: 'FL', website: 'https://marinatitle.com', note: 'Attorney-owned; serving wholesalers since 2014 per their site.' },
  { name: 'FL Title', states: 'FL', website: '', note: 'Advertises A-to-B / B-to-C back-to-back closings. Verify.' },
  { name: 'Shield Title Agency', states: 'AZ', website: '', note: 'Phoenix-based; investors-and-wholesalers desk per publisher listing. Verify.' },
  { name: 'Title One USA', states: '', website: 'https://titleoneusa.com/for-local-investors/', note: 'Investor-centric; assignments, double closings, subject-to per their site.' },
  { name: '24 Hour Closing', states: 'NC, SC', website: 'https://24hourclose.com/wholesaling-real-estate/4/', note: 'Closing law firm serving NC/SC; investor-friendly per their site.' },
];

export default function Titles({ userId }: { userId: string | null }) {
  const [added, setAdded] = useState<{ name: string; states: string }[]>([]);
  const [rows, setRows] = useState<TitleCompanyRow[] | null>(null);
  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadTitleCompanies().then((r) => { if (r) setRows(r); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const shown = rows ?? SEEDS.map((s) => ({ name: s.name, states: s.states.split(',').map((x) => x.trim()).filter(Boolean), website: s.website || null, notes: s.note }));
  const [name, setName] = useState(''); const [states, setStates] = useState('');

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Title Companies — Verified Seeds + Your Additions</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Source: {rows ? 'Supabase title_companies (seed rows + your own)' : 'Built-in seeds — sign in with Supabase configured to read them from the database.'}</p>
      <ul>
        {shown.map((t) => <li key={t.name}><strong>{t.name}</strong> {t.states.length ? `— ${t.states.join(', ')}` : ''} {t.website ? <a href={t.website} target="_blank" rel="noreferrer">{t.website}</a> : ''} — {t.notes}{(t as { id?: string }).id ? <><br /><span style={{ fontSize: 12, color: '#94a3b8' }}>Portal link ID: {(t as { id?: string }).id} — the title company uses this to link its portal account.</span></> : ''}</li>)}
        {added.map((t) => <li key={t.name}><strong>{t.name}</strong> — {t.states} — <em>unverified user addition</em></li>)}
      </ul>
      <input placeholder="Add a title company you verified yourself" value={name} onChange={(e) => setName(e.target.value)} style={{ marginRight: 8 }} />
      <input placeholder="States" value={states} onChange={(e) => setStates(e.target.value)} style={{ marginRight: 8 }} />
      <button onClick={() => { if (name.trim()) { setAdded([{ name, states }, ...added]); setName(''); setStates(''); } }}>Add (unverified)</button>
    </section>
  );
}
