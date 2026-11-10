'use client';

// Slice 112 — Public-notice doors (section 5 of Counties & Title).
// The doors are lib/public-notices.ts: every jurisdiction in the
// United States plus DC and the territories, each with the status
// its research earned — a verified link (site opened, free search
// confirmed), an honest "no statewide aggregator" with the real
// fallback, or a named candidate that ships NO link until it can
// be opened and confirmed. Links open the newspapers' own sites in
// a new tab; the platform copies nothing from them.

import { useState } from 'react';
import { PUBLIC_NOTICE_DOORS, noticeCounts, type NoticeDoor } from '../lib/public-notices';

export default function PublicNotices({ userId }: { userId: string | null }) {
  const [code, setCode] = useState('FL');
  if (!userId) return null;

  const counts = noticeCounts();
  const door: NoticeDoor =
    PUBLIC_NOTICE_DOORS.find((d) => d.code === code) || PUBLIC_NOTICE_DOORS[0];
  const verifiedDoors = PUBLIC_NOTICE_DOORS.filter((d) => d.status === 'verified');

  return (
    <div style={{ marginTop: 30 }}>
      <h3 style={{ fontSize: 16, color: '#fff', margin: '0 0 6px' }}>
        5 · Public-notice doors — the free court-event radar
      </h3>
      <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 6px', lineHeight: 1.55 }}>
        Some of the best distress signals in this business are published <em>by law</em>: when an estate
        opens, a Notice to Creditors runs in a newspaper; when a foreclosure or tax-deed sale is set,
        the sale notice runs. In most states the press association gathers those newspaper notices onto
        one free statewide website — that site is the door. Pick a jurisdiction: where a door was
        opened and confirmed, it is linked; where no statewide aggregator exists, the card says so and
        names the fallback the law actually uses; where a candidate exists but could not be confirmed,
        it is named and deliberately <em>not</em> linked. The platform links out and copies nothing —
        you read the notices on the newspapers’ own sites.
      </p>
      <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '0 0 12px' }}>
        Checked Nov 10, 2026: {counts.verified} verified doors · {counts.none} jurisdictions with no
        statewide aggregator · {counts.lead} candidates not yet confirmed. Commercial resellers that
        index these notices behind a paywall are never a door here.
      </p>

      <label style={{ fontSize: 13, color: '#e2e8f0', display: 'block', marginBottom: 10 }}>
        Jurisdiction{' '}
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ marginLeft: 6, padding: '6px 8px', borderRadius: 8, background: '#0f172a', color: '#fff', border: '1px solid rgba(148,163,184,0.4)' }}
        >
          {PUBLIC_NOTICE_DOORS.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <div style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '14px 16px' }}>
        {door.status === 'verified' && door.url ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              <a href={door.url} target="_blank" rel="noreferrer">
                {door.siteName} ↗
              </a>
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3 }}>
              Run by {door.runBy} · Free public search — opened and confirmed Nov 10, 2026
            </div>
            {door.carries ? (
              <div style={{ fontSize: 13.5, color: '#e2e8f0', marginTop: 8 }}>
                Carries: {door.carries}
              </div>
            ) : null}
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: '8px 0 12px', lineHeight: 1.55 }}>{door.note}</p>
            <a
              href={door.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 9, background: '#065f46', color: '#fff', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}
            >
              Open {door.name}’s notice site ↗
            </a>
          </>
        ) : door.status === 'lead' ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>
              {door.name} — candidate found, not yet confirmed
            </div>
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.55 }}>{door.note}</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              {door.name} — no statewide aggregator
            </div>
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.55 }}>{door.note}</p>
            {door.fallbackUrl ? (
              <p style={{ fontSize: 13.5, margin: '10px 0 0' }}>
                <a href={door.fallbackUrl} target="_blank" rel="noreferrer">
                  {door.fallbackLabel} ↗
                </a>
              </p>
            ) : null}
          </>
        )}
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ fontSize: 13.5, color: '#e2e8f0', cursor: 'pointer' }}>
          All {counts.verified} verified doors (alphabetical)
        </summary>
        <ul style={{ columns: 2, columnGap: 28, margin: '10px 0 0', paddingLeft: 18 }}>
          {verifiedDoors.map((d) => (
            <li key={d.code} style={{ fontSize: 13, marginBottom: 5, breakInside: 'avoid' }}>
              <a href={d.url} target="_blank" rel="noreferrer">
                {d.name} — {d.siteName} ↗
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
