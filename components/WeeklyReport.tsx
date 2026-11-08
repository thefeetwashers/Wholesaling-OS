'use client';

import { useEffect, useState } from 'react';
import { loadWeeklyReport, type WeeklyReport as Report } from '../lib/weekly-report';

// Slice 90 — the Weekly Report (dashboard). Monday-anchored and
// read from the wholesaler's own rows at the moment it renders:
// new leads and where they came from, work logged, follow-ups
// due, closings the platform counted, money out, the pipeline as
// it stands, and any stale money from the Slice 76 board. Quiet
// weeks say so — the report is a mirror, not a pep talk.

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const STATUS_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  under_contract: 'Under contract', assigned: 'Assigned', closed: 'Closed', dead: 'Dead',
};

export default function WeeklyReport({ userId }: { userId: string }) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let live = true;
    loadWeeklyReport(userId, new Date()).then((r) => { if (live) setReport(r); }).catch(() => { if (live) setReport(null); });
    return () => { live = false; };
  }, [userId]);

  if (!report) return null;

  const quiet = report.leadsAdded === 0 && report.followUpsLogged === 0 && report.callsLogged === 0
    && report.closingsCounted === 0 && report.disbursedOut === 0;

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🗓️ Your week — since Monday {report.weekStart}</h2>
      {quiet ? (
        <p style={{ fontSize: 13.5, color: '#cbd5e1' }}>
          A quiet week on paper — nothing new was recorded. This report only ever shows what your
          records show, so a blank week here means the work happened somewhere the platform cannot
          see, or it is still ahead of you.
        </p>
      ) : (
        <div style={{ fontSize: 14, display: 'grid', gap: 4 }}>
          <span>
            <strong>{report.leadsAdded}</strong> lead{report.leadsAdded === 1 ? '' : 's'} added
            {report.topSource ? ` · most from ${report.topSource}` : ''}
          </span>
          <span>
            <strong>{report.followUpsLogged}</strong> follow-up{report.followUpsLogged === 1 ? '' : 's'} logged ·{' '}
            <strong>{report.callsLogged}</strong> call{report.callsLogged === 1 ? '' : 's'} logged
          </span>
          <span>
            <strong>{report.closingsCounted}</strong> closing{report.closingsCounted === 1 ? '' : 's'} counted ·{' '}
            <strong>{money(report.feesClosed)}</strong> in fees on closed deals
          </span>
          <span><strong>{money(report.disbursedOut)}</strong> disbursed out</span>
        </div>
      )}
      <p style={{ fontSize: 13.5, marginTop: 10 }}>
        Follow-ups due or overdue right now: <strong>{report.followUpsDue}</strong>
        {report.staleTotal > 0 ? ` · Stale money on the board: ${money(report.staleTotal)}` : ''}
      </p>
      {report.pipeline.length > 0 && (
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          Pipeline as it stands: {report.pipeline.map((s) => `${STATUS_LABEL[s.status] || s.status} ${s.count}`).join(' · ')}
        </p>
      )}
    </section>
  );
}
