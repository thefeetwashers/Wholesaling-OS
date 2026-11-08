'use client';

import { useEffect, useState } from 'react';
import { loadLeads, type Lead } from '../lib/leads';
import { loadAllReferrals, type Referral } from '../lib/portals';

// Slice 73 — Owner Deal Desk. The platform owner's own direct
// pipeline, in one place: her leads (including anything her seller
// page brought in) and the seller referrals addressed to her — the
// lane where the company itself is the buyer of record. Every row
// carries its next action, derived from the row's real status. No
// invented fees: the only money printed is real data (a county
// assessed value the owner entered) and the one obligation the
// referrer lane creates — $1,000 to the referrer when a referred
// deal closes and funds, which the owner settles by hand.

const LEAD_NEXT: Record<string, string> = {
  new: 'Call the seller — then log the outcome in Comms Center.',
  contacted: 'Follow up — a second touch beats a new list.',
  qualified: 'Run the Deal Analyzer and write the offer.',
  under_contract: 'Market it: activate a listing and work your buyers.',
  assigned: 'Watch the escrow file to closing — EMD and milestones.',
  closed: 'Closed. Write the autopsy while it is fresh.',
  dead: 'On the watchlist? Set a re-check date and let time work.',
};

const REF_NEXT: Record<string, string> = {
  received: 'Call the seller — on platform-direct deals, the company is the buyer of record.',
  working: 'Get it under contract, then it joins your pipeline.',
  closed: 'Closed — the $1,000 referral payout to the referrer is due from the deal proceeds (you settle it by hand and record it on the deal).',
  dead: 'Not moving forward — nothing owed.',
};

export default function OwnerDealDesk({ userId }: { userId: string }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [refs, setRefs] = useState<Referral[] | null>(null);

  useEffect(() => {
    let live = true;
    loadLeads(userId).then((rows) => { if (live) setLeads(rows || []); }).catch(() => { if (live) setLeads([]); });
    loadAllReferrals().then((rows) => { if (live) setRefs(rows || []); }).catch(() => { if (live) setRefs([]); });
    return () => { live = false; };
  }, [userId]);

  if (leads === null || refs === null) return null;
  if (leads.length === 0 && refs.length === 0) return null;

  const openLeads = leads.filter((l) => l.status !== 'closed' && l.status !== 'dead');
  const openRefs = refs.filter((r) => r.status === 'received' || r.status === 'working');

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🗂️ Owner Deal Desk — the company&rsquo;s own pipeline</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Your direct deals only: your leads and the seller referrals sent to you. On platform-direct deals the
        company is the buyer of record, so the fee is the company&rsquo;s — that posture stays behind the
        attorney review, and nothing here changes it.
      </p>

      <h3 style={{ marginBottom: 6 }}>Referrals to work ({openRefs.length} open of {refs.length})</h3>
      {refs.length === 0 ? (
        <p style={{ fontSize: 13.5, color: '#94a3b8' }}>None yet — referrers bring sellers to this desk.</p>
      ) : (
        <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
          {refs.map((r) => (
            <li key={r.id} style={{ marginBottom: 8 }}>
              <strong>{r.property_address}</strong>{r.city ? `, ${r.city}, ${r.state || ''}` : ''} — from {r.seller_name || 'the seller'}
              {' · '}<em>{r.status}</em>
              <br />
              <span style={{ color: '#94a3b8' }}>Next: {REF_NEXT[r.status] || 'Work it.'}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ marginBottom: 6 }}>Your leads ({openLeads.length} open of {leads.length})</h3>
      <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
        {leads.map((l) => (
          <li key={l.id} style={{ marginBottom: 8 }}>
            <strong>{l.property_address}</strong>{l.city ? `, ${l.city}, ${l.state || ''}` : ''}
            {' · '}<em>{l.status}</em>
            {l.list_source ? ` · via ${l.list_source}` : ''}
            {l.assessed_value ? ` · county assessed $${Math.round(Number(l.assessed_value)).toLocaleString('en-US')}` : ''}
            <br />
            <span style={{ color: '#94a3b8' }}>Next: {LEAD_NEXT[l.status] || 'Work it.'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
