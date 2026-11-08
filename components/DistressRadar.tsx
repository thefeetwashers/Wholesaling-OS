'use client';

import { useEffect, useState } from 'react';
import { loadLeads } from '../lib/leads';
import { DISTRESS_TAGS, loadAllTags, summarizeDistress, type DistressSummary } from '../lib/distress';

// Slice 54 — the Distress Radar: the wholesaler's own tagged leads,
// counted by distress type, with a work-first ranking of what to
// touch first. Every input is a tag or a follow-up date the
// wholesaler entered from a source they lawfully hold — the
// platform never scrapes public records and never scores a person.
// The heat formula is printed on the panel: +10 per tag, +15 when
// a follow-up is due today, +2 per overdue day (max +30).

export default function DistressRadar({ userId, onNavigate }: { userId: string; onNavigate: (view: string) => void }) {
  const [summary, setSummary] = useState<DistressSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadLeads(userId), loadAllTags(userId)])
      .then(([leads, tags]) => {
        if (!live) return;
        setSummary(summarizeDistress(leads || [], tags, new Date().toISOString().slice(0, 10)));
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [userId]);

  if (failed) return null;

  return (
    <section style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>🔥 Distress Radar</h2>
        <span style={{ fontSize: 12.5, color: '#94a3b8' }}>Your tagged leads, by distress type — and what to work first</span>
      </div>

      {summary === null && <p style={{ fontSize: 13.5, color: '#94a3b8' }}>Loading your distress picture…</p>}

      {summary !== null && summary.taggedLeads === 0 && (
        <p style={{ fontSize: 13.5, color: '#cbd5e1', marginTop: 10 }}>
          No distress tags yet. When you find a tax-delinquent, probate, vacant, or pre-foreclosure property —
          pull it from the official record (the playbooks in Counties &amp; Title walk you through each list),
          add it as a lead, and tag what you observed. Your radar lights up from <em>your</em> real finds.
        </p>
      )}

      {summary !== null && summary.taggedLeads > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {DISTRESS_TAGS.filter((t) => (summary.counts[t.key] || 0) > 0).map((t) => (
              <span key={t.key} style={{ background: '#0f172a', border: '1px solid rgba(248,113,113,0.4)', color: '#e2e8f0', borderRadius: 999, padding: '6px 12px', fontSize: 13 }}>
                {t.label}: <strong>{summary.counts[t.key]}</strong>
              </span>
            ))}
            <span style={{ fontSize: 13, color: '#94a3b8', padding: '6px 2px' }}>
              {summary.taggedLeads} tagged lead{summary.taggedLeads === 1 ? '' : 's'} in play
            </span>
          </div>

          <h3 style={{ marginBottom: 6, fontSize: 15 }}>Work these first</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.hottest.map((h) => (
              <li key={h.lead.id || h.lead.property_address} style={{ fontSize: 13.5, marginBottom: 4 }}>
                <strong>{h.lead.property_address}</strong>
                {h.lead.city ? ` — ${h.lead.city}` : ''} · 🔥 {h.heat} · {h.reasons.join(' · ')}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => onNavigate('leads')}>Open the call queue in Leads →</button>
          </div>
        </>
      )}

      <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 12, marginBottom: 0 }}>
        Ranked only by tags and follow-up dates you entered: +10 per distress tag, +15 when a follow-up is due
        today, +2 per overdue day (max +30). The platform never scrapes public records and never scores a
        person&rsquo;s distress — this is your own notebook, organized.
      </p>
    </section>
  );
}
