'use client';

import { useState } from 'react';
import { loadCountyLinks, loadStateDirectories, type CountyLinkRow, type StateDirectoryRow } from '../lib/directories';
import type { Lead } from '../lib/leads';

// Slice 36 — per-lead research links: the lawful answer to "skip
// tracing". One click from a lead to the OFFICIAL records a wholesaler
// checks by hand: the county property appraiser / tax & GIS portal
// and the clerk's deed & court records (Slice 22's verified county
// links), the state's official county directory, Florida's Sunbiz
// company search when the owner is an LLC, and a plain web search for
// the owner name. The platform fetches NOTHING and looks nobody up —
// the wholesaler opens the record, reads it, and types what they find
// into the lead themselves. No phone numbers are pulled, inferred, or
// promised anywhere in this panel.

const SUNBIZ_SEARCH = 'https://search.sunbiz.org/';

function normCounty(s: string): string {
  return s.toLowerCase().replace(/\s+county\s*$/, '').trim();
}

export default function ResearchLinks({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [county, setCounty] = useState<CountyLinkRow | null>(null);
  const [stateDir, setStateDir] = useState<StateDirectoryRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || loaded) return;
    setLoaded(true);
    try {
      const stateCode = (lead.state || 'FL').trim().toUpperCase().slice(0, 2);
      const [counties, states] = await Promise.all([loadCountyLinks(), loadStateDirectories()]);
      if (counties && lead.county) {
        const want = normCounty(lead.county);
        const hit = counties.find(
          (c) => c.state_code === stateCode && normCounty(c.county_name) === want,
        );
        if (hit) setCounty(hit);
      }
      if (states) {
        const sd = states.find((s) => s.state_code === stateCode);
        if (sd) setStateDir(sd);
      }
    } catch {
      // Directories unavailable (offline/local mode) — the Sunbiz and
      // web-search links below still render; nothing is faked.
    }
  }

  const isFL = (lead.state || 'FL').trim().toUpperCase().startsWith('FL');
  const ownerQ = lead.owner_name
    ? `https://www.google.com/search?q=${encodeURIComponent(`"${lead.owner_name}" ${lead.city || ''} ${lead.state || ''}`.trim())}`
    : '';

  return (
    <span style={{ fontSize: 12.5 }}>
      {' '}
      <button onClick={toggle} style={{ fontSize: 12.5, padding: '2px 8px' }}>
        {open ? 'Hide research' : 'Research'}
      </button>
      {open && (
        <span style={{ display: 'block', marginTop: 6, background: '#0f172a', padding: 10, borderRadius: 8 }}>
          <span style={{ display: 'block', color: '#94a3b8', marginBottom: 6 }}>
            Official records — opened by you. The platform pulls no one's phone number;
            what you find, you add to the lead yourself.
          </span>
          {county?.tax_assessor_gis_url && (
            <a href={county.tax_assessor_gis_url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              🏛️ Property appraiser / tax &amp; GIS — {county.county_name} County{county.verified ? '' : ' (your saved link, unverified)'}
            </a>
          )}
          {county?.clerk_court_deeds_url && (
            <a href={county.clerk_court_deeds_url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              📜 Clerk — deeds &amp; court records — {county.county_name} County{county.verified ? '' : ' (your saved link, unverified)'}
            </a>
          )}
          {county?.code_enforcement_url && (
            <a href={county.code_enforcement_url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              🚧 Code enforcement — {county.county_name} County
            </a>
          )}
          {!county && (
            <span style={{ display: 'block' }}>
              No verified county portal on file for {lead.county || 'this county'} yet — the state directory below lists every county office.
            </span>
          )}
          {stateDir && (
            <a href={stateDir.directory_url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              🗂️ {stateDir.state_name} official county directory{stateDir.run_by ? ` (${stateDir.run_by})` : ''}
            </a>
          )}
          {isFL && (
            <a href={SUNBIZ_SEARCH} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              🏢 Sunbiz — search a company / LLC name (owner is an LLC? start here)
            </a>
          )}
          {ownerQ && (
            <a href={ownerQ} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              🔎 Web search for "{lead.owner_name}" (you review what comes up)
            </a>
          )}
        </span>
      )}
    </span>
  );
}
