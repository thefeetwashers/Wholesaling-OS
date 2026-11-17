'use client';

// Slice 130 — Operator Stats (operator only).
//
// Every number comes from REAL rows — wholesalers, leads, probate,
// funding, scouts, buyers, JV listings, vendors, and problem
// reports. There is no seeded data anywhere on this platform, so
// before the first real event every count is honestly 0. No billing
// numbers live here — SaaS Admin already covers billing; this
// panel is the operational picture only.
//
// The operator sees this view because app/page.tsx renders it only
// when the signed-in email is the operator's; RLS enforces it
// server-side too (the operator reads all rows, each wholesaler
// reads only their own). Each section loads on its own: a table
// that does not exist yet (migration not applied) shows its own
// plain note instead of breaking the whole panel.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { OPERATOR_EMAIL } from '../lib/funding';
import {
  loadAllProblemReports,
  setProblemReportStatus,
  PROBLEM_STATUS_LABELS,
  type ProblemReport,
  type ProblemStatus,
} from '../lib/problem-reports';
import ManagedDispoRequests from './ManagedDispoRequests';
import ProofOfFundsReview from './ProofOfFundsReview';

function countBy<T extends string>(values: (T | null | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) {
    const key = v == null || v === '' ? '(not set)' : String(v);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

interface Stats {
  wholesalers: number | null;
  verifiedBadges: number | null;
  leadsTotal: number | null;
  leadsByTag: Record<string, number> | null;
  sellerSubmissions: number | null;
  probateTotal: number | null;
  probateOpen: number | null;
  probateProSe: number | null;
  fundingByStatus: Record<string, number> | null;
  scoutsByStatus: Record<string, number> | null;
  scoutsW9: number | null;
  cashBuyers: number | null;
  jvListings: number | null;
  vendors: number | null;
}

const EMPTY_STATS: Stats = {
  wholesalers: null,
  verifiedBadges: null,
  leadsTotal: null,
  leadsByTag: null,
  sellerSubmissions: null,
  probateTotal: null,
  probateOpen: null,
  probateProSe: null,
  fundingByStatus: null,
  scoutsByStatus: null,
  scoutsW9: null,
  cashBuyers: null,
  jvListings: null,
  vendors: null,
};

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /does not exist|relation .* does not exist|PGRST205|column .* does not exist|PGRST204/i.test(msg);
}

export default function OperatorStats({ userEmail }: { userEmail: string | null }) {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [missingNotes, setMissingNotes] = useState<string[]>([]);
  const [reports, setReports] = useState<ProblemReport[]>([]);
  const [reportsMissing, setReportsMissing] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [reportMsg, setReportMsg] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const isOperator = userEmail === OPERATOR_EMAIL;

  useEffect(() => {
    if (!isOperator) return;
    let live = true;
    async function load() {
      setLoading(true);
      setLoadError('');
      setMissingNotes([]);
      const next: Stats = { ...EMPTY_STATS };
      const missing: string[] = [];
      try {
        if (!supabase) throw new Error('Supabase is not configured on this deployment.');
        const countHead = async (table: string, eq?: [string, string | boolean]): Promise<number> => {
          let q = supabase.from(table).select('id', { count: 'exact', head: true });
          if (eq) q = q.eq(eq[0], eq[1]);
          const { count, error } = await q;
          if (error) throw error;
          return count ?? 0;
        };
        // Wholesalers + verified-operator badges.
        try {
          next.wholesalers = await countHead('profiles', ['role', 'wholesaler']);
        } catch (e) {
          if (isMissingTable(e)) missing.push('profiles');
        }
        try {
          next.verifiedBadges = await countHead('profiles', ['verified_operator_badge', true]);
        } catch (e) {
          if (isMissingTable(e)) missing.push('profiles');
        }
        // Leads: total, by distress tag, seller submissions.
        try {
          next.leadsTotal = await countHead('leads');
        } catch (e) {
          if (isMissingTable(e)) missing.push('leads');
        }
        try {
          const { data, error } = await supabase.from('leads').select('distress_tag');
          if (error) throw error;
          next.leadsByTag = countBy(((data || []) as { distress_tag?: string | null }[]).map((r) => r.distress_tag));
        } catch (e) {
          if (isMissingTable(e)) missing.push('leads');
        }
        try {
          next.sellerSubmissions = await countHead('leads', ['list_source', 'Seller landing page']);
        } catch (e) {
          if (isMissingTable(e)) missing.push('leads');
        }
        // Probate: total, open, pro se (open and no attorney).
        try {
          const { data, error } = await supabase.from('probate_leads').select('case_status, has_attorney');
          if (error) throw error;
          const rows = (data || []) as { case_status?: string | null; has_attorney?: boolean | null }[];
          next.probateTotal = rows.length;
          next.probateOpen = rows.filter((r) => r.case_status === 'OPEN').length;
          next.probateProSe = rows.filter((r) => r.case_status === 'OPEN' && r.has_attorney !== true).length;
        } catch (e) {
          if (isMissingTable(e)) missing.push('probate_leads — run migration 20261115150000_probate_leads.sql');
        }
        // Funding requests by status.
        try {
          const { data, error } = await supabase.from('funding_requests').select('status');
          if (error) throw error;
          next.fundingByStatus = countBy(((data || []) as { status?: string | null }[]).map((r) => r.status));
        } catch (e) {
          if (isMissingTable(e)) missing.push('funding_requests — run migration 20261115090000_capital_lending_lender_role.sql');
        }
        // Scout leads by status + how many have a W-9 on file. The
        // W-9 column arrives with migration 20261117090000 — if it
        // is not there yet, the status counts still show and only
        // the W-9 line reports the missing migration.
        try {
          const { data, error } = await supabase.from('scout_leads').select('status');
          if (error) throw error;
          next.scoutsByStatus = countBy(((data || []) as { status?: string | null }[]).map((r) => r.status));
        } catch (e) {
          if (isMissingTable(e)) missing.push('scout_leads — run migration 20261115110000_winwin_ecosystem.sql');
        }
        try {
          const { data, error } = await supabase.from('scout_leads').select('w9_received');
          if (error) throw error;
          next.scoutsW9 = ((data || []) as { w9_received?: boolean | null }[]).filter((r) => r.w9_received === true).length;
        } catch (e) {
          if (isMissingTable(e)) missing.push('scout_leads.w9_received — run migration 20261117090000_slice130_operator_visibility.sql');
        }
        // Network: cash buyers, JV listings, vendors.
        try {
          next.cashBuyers = await countHead('cash_buyers');
        } catch (e) {
          if (isMissingTable(e)) missing.push('cash_buyers — run migration 20261115160000_cash_buyers.sql');
        }
        try {
          next.jvListings = await countHead('jv_listings');
        } catch (e) {
          if (isMissingTable(e)) missing.push('jv_listings — run migration 20261115110000_winwin_ecosystem.sql');
        }
        try {
          next.vendors = await countHead('vendor_directory');
        } catch (e) {
          if (isMissingTable(e)) missing.push('vendor_directory — run migration 20261115110000_winwin_ecosystem.sql');
        }
        // Problem reports (operator triage list).
        try {
          if (live) setReports(await loadAllProblemReports());
        } catch (e) {
          if (isMissingTable(e)) {
            if (live) setReportsMissing(true);
            missing.push('problem_reports — run migration 20261117090000_slice130_operator_visibility.sql');
          } else if (live) {
            // A real load failure must not read as "no reports".
            setReportsError(e instanceof Error ? e.message : 'Could not load problem reports.');
          }
        }
        if (live) {
          setStats(next);
          setMissingNotes([...new Set(missing)]);
        }
      } catch (err) {
        if (live) setLoadError(err instanceof Error ? err.message : 'Could not load operator stats.');
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [isOperator]);

  async function changeReportStatus(report: ProblemReport, nextStatus: ProblemStatus) {
    if (!report.id) return;
    setSavingId(report.id);
    setReportMsg('');
    try {
      await setProblemReportStatus(report.id, nextStatus);
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: nextStatus } : r)));
    } catch (err) {
      setReportMsg(err instanceof Error ? err.message : 'The status did not save.');
    } finally {
      setSavingId(null);
    }
  }

  const kpiCard = (label: string, value: string, sub: string) => (
    <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{sub}</div>
    </div>
  );

  const num = (v: number | null) => (v == null ? '—' : String(v));
  const breakdown = (by: Record<string, number> | null) => {
    if (by == null) return <span style={{ color: '#94a3b8' }}>Not loaded.</span>;
    const entries = Object.entries(by);
    if (entries.length === 0) return <span>0 — none yet.</span>;
    return <span>{entries.map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>;
  };

  if (!isOperator) return <p style={{ fontSize: 14 }}>Operator only.</p>;
  if (loading) return <p style={{ fontSize: 14, color: '#cbd5e1' }}>Loading operator stats…</p>;
  if (loadError) return <p style={{ fontSize: 14, color: '#fca5a5' }}>{loadError}</p>;

  const openReports = reports.filter((r) => r.status === 'open');
  const reviewingReports = reports.filter((r) => r.status === 'reviewing');

  return (
    <div>
      <h3>Operator Stats</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Real counts from live rows — nothing here is seeded, so a 0 means none yet, not a missing
        number. Billing is not on this panel; SaaS Admin already covers subscriptions.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {kpiCard('Wholesalers', num(stats.wholesalers), 'profiles with role wholesaler')}
        {kpiCard('Verified Operator badges', num(stats.verifiedBadges), 'profiles with the bootcamp badge')}
        {kpiCard('Leads', num(stats.leadsTotal), 'all leads in sealed offices')}
        {kpiCard('Seller submissions', num(stats.sellerSubmissions), "leads from 'Seller landing page'")}
        {kpiCard('Probate leads', num(stats.probateTotal), `${num(stats.probateOpen)} open · ${num(stats.probateProSe)} pro se`)}
        {kpiCard('Cash buyers', num(stats.cashBuyers), 'buyers in the CRM')}
        {kpiCard('JV listings', num(stats.jvListings), 'open JV posts')}
        {kpiCard('Vendors', num(stats.vendors), 'vendors in the directory')}
      </div>

      <h4 style={{ marginTop: 20 }}>Leads by distress tag</h4>
      <p style={{ fontSize: 13 }}>{breakdown(stats.leadsByTag)}</p>

      <h4 style={{ marginTop: 20 }}>Funding requests by status</h4>
      <p style={{ fontSize: 13 }}>{breakdown(stats.fundingByStatus)}</p>

      <h4 style={{ marginTop: 20 }}>Scout leads by status</h4>
      <p style={{ fontSize: 13 }}>{breakdown(stats.scoutsByStatus)}</p>
      <p style={{ fontSize: 13 }}>
        W-9 received: {stats.scoutsW9 == null ? 'Not loaded — run migration 20261117090000_slice130_operator_visibility.sql.' : `${stats.scoutsW9} scout lead(s) have a W-9 on file.`}
      </p>

      {missingNotes.length > 0 && (
        <p style={{ fontSize: 13, color: '#fcd34d' }}>
          Some tables are not in the database yet: {missingNotes.join('; ')}. See DEPLOYMENT_README.md §3 for the migration order.
        </p>
      )}

      <h4 style={{ marginTop: 20 }}>Problem reports ({openReports.length} open · {reviewingReports.length} reviewing)</h4>
      {reportMsg && <p style={{ fontSize: 13, color: '#fca5a5' }}>{reportMsg}</p>}
      {reportsError && <p style={{ fontSize: 13, color: '#fca5a5' }}>{reportsError}</p>}
      {reportsMissing ? (
        <p style={{ fontSize: 13 }}>The problem_reports table does not exist yet — run migration 20261117090000_slice130_operator_visibility.sql first.</p>
      ) : reports.length === 0 ? (
        <p style={{ fontSize: 13 }}>No problem reports yet.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {reports.map((r) => (
            <li key={r.id} style={{ marginBottom: 12, background: '#0f172a', padding: 12, borderRadius: 10, color: '#e2e8f0' }}>
              <strong>{r.subject}</strong> · {r.category} · {PROBLEM_STATUS_LABELS[r.status]}
              {r.page_context ? ` · page: ${r.page_context}` : ''}
              {r.created_at ? ` · ${new Date(r.created_at).toLocaleString()}` : ''}
              <br />
              {r.details}
              <br />
              {r.status !== 'reviewing' && (
                <button disabled={savingId === r.id} onClick={() => changeReportStatus(r, 'reviewing')} style={{ marginTop: 6, marginRight: 6 }}>
                  Mark reviewing
                </button>
              )}
              {r.status !== 'resolved' && (
                <button disabled={savingId === r.id} onClick={() => changeReportStatus(r, 'resolved')} style={{ marginTop: 6 }}>
                  Mark resolved
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <h4 style={{ marginTop: 20 }}>Managed disposition requests</h4>
      <ManagedDispoRequests operatorEmail={userEmail} />

      <h4 style={{ marginTop: 20 }}>Proof-of-funds verification</h4>
      <ProofOfFundsReview />
    </div>
  );
}
