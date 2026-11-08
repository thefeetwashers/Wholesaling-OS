'use client';

import { useEffect, useState } from 'react';
import { loadLeads } from '../lib/leads';
import { loadCountyLinks, loadUserCounties, summarizeMarkets, type MarketSummary } from '../lib/directories';

// Slice 57 — Your Markets: the counties a wholesaler actually works
// (from their own leads + the counties they saved), each with the
// verified official links for that county — clerk & deeds, property
// appraiser/GIS, code enforcement — in one tap. This is the honest
// form of "the system pushes everything for my counties": the
// platform gathers everything it lawfully holds for those counties
// onto one board. It cannot push probate or foreclosure lists that
// counties do not publish as data — the Pull-the-List playbooks in
// Counties & Title are the routine for those, and this board is
// where their links live.

export default function MarketBoard({ userId, onNavigate }: { userId: string; onNavigate: (view: string) => void }) {
  const [markets, setMarkets] = useState<MarketSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      loadLeads(userId),
      loadCountyLinks().catch(() => []),
      loadUserCounties(userId).catch(() => []),
    ])
      .then(([leads, platform, mine]) => {
        if (!live) return;
        setMarkets(summarizeMarkets(leads || [], platform || [], mine || []).slice(0, 6));
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [userId]);

  if (failed) return null;

  const chip = (label: string, url: string | null) => (url ? (
    <a key={label} href={url} target="_blank" rel="noreferrer" style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.3)', color: '#7dd3fc', borderRadius: 999, padding: '5px 11px', fontSize: 12.5, textDecoration: 'none' }}>
      {label} ↗
    </a>
  ) : null);

  return (
    <section style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>🗺️ Your Markets</h2>
        <span style={{ fontSize: 12.5, color: '#94a3b8' }}>The counties you work — every official link for them, one tap</span>
      </div>

      {markets === null && <p style={{ fontSize: 13.5, color: '#94a3b8' }}>Loading your markets…</p>}

      {markets !== null && markets.length === 0 && (
        <p style={{ fontSize: 13.5, color: '#cbd5e1', marginTop: 10 }}>
          No markets yet. Your markets appear here automatically from the counties on your leads and the
          counties you save in Counties &amp; Title — add a lead with its county, or save a county&rsquo;s
          links, and its clerk, appraiser, and code-enforcement doors gather here.
        </p>
      )}

      {markets !== null && markets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, marginTop: 12 }}>
          {markets.map((m) => (
            <div key={`${m.countyName}|${m.stateCode}`} style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>
                {m.countyName} County{m.stateLabel ? `, ${m.stateLabel}` : ''}
              </div>
              <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
                {m.leadCount} lead{m.leadCount === 1 ? '' : 's'} in this county{m.savedByUser ? ' · saved by you' : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {chip('Clerk & deeds', m.clerkUrl)}
                {chip('Appraiser / GIS', m.appraiserUrl)}
                {chip('Code enforcement', m.codeUrl)}
                {!m.hasLinks && (
                  <span style={{ fontSize: 12.5, color: '#94a3b8' }}>
                    Links not verified for this county yet — add them in Counties &amp; Title and they land here.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 12, marginBottom: 0 }}>
        Working a new county?{' '}
        <button type="button" onClick={() => onNavigate('records')} style={{ fontSize: 12.5 }}>Open Counties &amp; Title →</button>
        {' '}— the Pull-the-List playbooks there walk each distress list for any county, step by step.
      </p>
    </section>
  );
}
