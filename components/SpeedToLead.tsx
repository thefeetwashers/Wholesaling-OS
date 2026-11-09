'use client';

import { useEffect, useState } from 'react';
import { loadLeads, type Lead } from '../lib/leads';
import { loadAllBuyBoxes, type BuyBox } from '../lib/portals';
import { ageLabel, countLeadMatches } from '../lib/match';
import ProofCaption from './ProofCaption';

// Slice 70 — Speed to Lead. The newest leads, first, each with its age
// and how many buyers' buy boxes match it — so the wholesaler works
// fresh, wanted leads in minutes instead of finding them days later.
// Every number is computed from real rows: lead created_at stamps and
// the buyers' own buy boxes (plain text match on place, labeled).
// Email alerts for new leads ride the same plumbing as the seller-page
// alerts and light up when the mail keys are in.

export default function SpeedToLead({ userId, onNavigate }: { userId: string; onNavigate?: (view: string) => void }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [boxes, setBoxes] = useState<BuyBox[]>([]);

  useEffect(() => {
    let live = true;
    Promise.all([loadLeads(userId), loadAllBuyBoxes().catch(() => [] as BuyBox[])])
      .then(([ls, bx]) => {
        if (!live) return;
        const sorted = [...(ls || [])].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        setLeads(sorted.slice(0, 8));
        setBoxes(bx || []);
      })
      .catch(() => { if (live) setLeads([]); });
    return () => { live = false; };
  }, [userId]);

  if (leads === null) return null;
  if (leads.length === 0) return null;

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>⚡ Speed to Lead — newest first</h2>
      <ProofCaption>Ages and sources are the lead records’ own fields; match counts come from the buy boxes on file, matched when this page loaded.</ProofCaption>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
        Fresh leads close. Each lead below shows its real age and how many buyers match it by their own
        buy boxes (plain text match on city / state / county — a box with no place set counts as a general buyer).
      </p>
      <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
        {leads.map((l) => {
          const m = countLeadMatches(l, boxes);
          return (
            <li key={l.id} style={{ marginBottom: 8 }}>
              <strong>{l.property_address}</strong>
              {l.city ? `, ${l.city}, ${l.state || ''}` : ''}
              {' · '}<span style={{ color: '#fbbf24' }}>{ageLabel(l.created_at) || 'age on the lead'}</span>
              {l.list_source ? ` · via ${l.list_source}` : ''}
              {' · '}
              {boxes.length === 0
                ? <span style={{ color: '#94a3b8' }}>no buy boxes on the platform yet</span>
                : m.buyers > 0
                  ? <span style={{ color: '#34d399' }}>🎯 {m.buyers} buyer{m.buyers === 1 ? '' : 's'} match ({m.boxes} buy box{m.boxes === 1 ? '' : 'es'})</span>
                  : <span style={{ color: '#94a3b8' }}>no buyer match yet</span>}
              {onNavigate && (
                <>
                  {' '}
                  <button onClick={() => onNavigate('leads')}>Work it</button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
