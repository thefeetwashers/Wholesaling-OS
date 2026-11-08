'use client';

import { useEffect, useState } from 'react';
import { loadCampaigns, type CampaignRow } from '../lib/campaigns';

// Slice 77 — campaign tracker panel. One row per list source, all
// counts from the wholesaler's own outreach and call logs. Renders
// nothing until at least one lead exists; a source with leads but
// no logged work shows honest zeros — that gap is the point.

export default function CampaignTracker({ userId }: { userId: string }) {
  const [rows, setRows] = useState<CampaignRow[] | null>(null);

  useEffect(() => {
    let live = true;
    loadCampaigns(userId).then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [userId]);

  if (!rows || rows.length === 0) return null;

  const cell: React.CSSProperties = { padding: '6px 8px', fontSize: 13.5, textAlign: 'right', whiteSpace: 'nowrap' };
  const head: React.CSSProperties = { ...cell, color: '#94a3b8', fontSize: 12 };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🎯 Campaign tracker — what each list source is doing</h2>
      <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
        Counted from your own outreach log and call log, grouped by each lead's list source. A conversation is a
        call you logged as motivated or follow-up. The logs are separate records, so the counts stand as recorded —
        nothing is estimated or merged.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>List source</th>
              <th style={head}>Leads</th>
              <th style={head}>Outreach logged</th>
              <th style={head}>Letters</th>
              <th style={head}>Messages</th>
              <th style={head}>Calls logged</th>
              <th style={head}>Conversations</th>
              <th style={head}>Moved forward</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} style={{ borderTop: '1px solid #334155' }}>
                <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{r.source}</td>
                <td style={cell}>{r.leads}</td>
                <td style={cell}>{r.outreach}</td>
                <td style={cell}>{r.letters}</td>
                <td style={cell}>{r.messages}</td>
                <td style={cell}>{r.callsLogged}</td>
                <td style={cell}>{r.conversations}</td>
                <td style={cell}>{r.moved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
        "Moved forward" counts that source's leads now qualified, under contract, assigned, or closed.
        A source with leads and zeros across the row is a list you have not worked yet.
      </p>
    </section>
  );
}
