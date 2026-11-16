// Slice 129 — SaaS Admin Dashboard (operator only).
//
// Every KPI comes from REAL saas_subscriptions rows — total
// wholesalers, trialing, active, active MRR, pipeline trial MRR.
// There are no fake subscribers: before the migration is applied
// and the first wholesaler signs up, the table is empty and the
// dashboard says so honestly. The operator sees this view because
// app/page.tsx renders it only when the signed-in email is the
// operator's; RLS enforces it server-side too (operator reads all,
// each wholesaler reads only their own row).
//
// Status changes write through a verified update (the row's id +
// the new plan_status only). Billing itself is NOT done here —
// Stripe is not configured yet (founder researching providers);
// the "billing" note in the README lists the owner steps.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SaaSRow {
  id: string;
  user_id: string;
  email: string | null;
  company_name: string | null;
  storefront_slug: string | null;
  plan_status: string;
  trial_ends_at: string | null;
  monthly_rate: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000);
}

export default function AdminSaaSDashboard() {
  const [rows, setRows] = useState<SaaSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setErrorMessage('');
      try {
        if (!supabase) throw new Error('Supabase is not configured on this deployment.');
        const { data, error } = await supabase
          .from('saas_subscriptions')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (live) setRows((data || []) as SaaSRow[]);
      } catch (err) {
        if (live) {
          const msg = err instanceof Error ? err.message : 'Could not load subscriptions.';
          // The table does not exist until migration
          // 20261115170000 is applied — say that plainly.
          setErrorMessage(
            /does not exist|relation .* does not exist|PGRST205/i.test(msg)
              ? 'The saas_subscriptions table does not exist yet — run migration 20261115170000_saas_subscriptions.sql first (see DEPLOYMENT_README.md).'
              : msg,
          );
        }
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const trialing = rows.filter((r) => r.plan_status === 'trialing');
    const active = rows.filter((r) => r.plan_status === 'active');
    const rate = (r: SaaSRow) => (typeof r.monthly_rate === 'number' ? r.monthly_rate : 150);
    return {
      total: rows.length,
      trialing: trialing.length,
      active: active.length,
      activeMrr: active.reduce((sum, r) => sum + rate(r), 0),
      pipelineTrialMrr: trialing.reduce((sum, r) => sum + rate(r), 0),
    };
  }, [rows]);

  async function changeStatus(row: SaaSRow, nextStatus: string) {
    setSavingId(row.id);
    try {
      if (!supabase) throw new Error('Supabase is not configured on this deployment.');
      const { error } = await supabase
        .from('saas_subscriptions')
        .update({ plan_status: nextStatus })
        .eq('id', row.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, plan_status: nextStatus } : r)));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not update the plan status.');
    } finally {
      setSavingId(null);
    }
  }

  const kpiCard = (label: string, value: string, sub: string) => (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{sub}</div>
    </div>
  );

  if (loading) return <p style={{ fontSize: 14, color: '#64748b' }}>Loading subscriptions…</p>;

  return (
    <div>
      <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>
        Every wholesaler on the platform, their trial, and their plan. All numbers below come from real
        subscription rows — there are no sample accounts. Billing itself is not live yet: no Stripe account
        exists, and no money is collected here.
      </p>
      {errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpiCard('Total wholesalers', String(kpis.total), 'subscription rows')}
        {kpiCard('Trialing', String(kpis.trialing), 'in their 90-day free trial')}
        {kpiCard('Active', String(kpis.active), 'paying $150/mo')}
        {kpiCard('Active MRR', `$${kpis.activeMrr.toLocaleString()}`, 'monthly recurring revenue')}
        {kpiCard('Pipeline trial MRR', `$${kpis.pipelineTrialMrr.toLocaleString()}`, 'if every trial converts')}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>No wholesalers yet</div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 0 }}>
            No subscription rows exist. The first row appears automatically when a wholesaler signs up (the
            signup trigger starts their 90-day trial).
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Wholesaler</th>
                <th style={{ padding: '10px 12px' }}>Storefront</th>
                <th style={{ padding: '10px 12px' }}>Plan</th>
                <th style={{ padding: '10px 12px' }}>Trial</th>
                <th style={{ padding: '10px 12px' }}>Rate</th>
                <th style={{ padding: '10px 12px' }}>Stripe</th>
                <th style={{ padding: '10px 12px' }}>Change plan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const left = daysLeft(row.trial_ends_at);
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{row.company_name || '—'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{row.email || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.storefront_slug ? (
                        <a
                          href={`https://wholesalingos.thefeetwashers.com/sell/${row.storefront_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#1d4ed8', fontWeight: 600 }}
                        >
                          /sell/{row.storefront_slug} ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background:
                            row.plan_status === 'active'
                              ? '#dcfce7'
                              : row.plan_status === 'trialing'
                                ? '#dbeafe'
                                : row.plan_status === 'past_due'
                                  ? '#fef3c7'
                                  : '#fee2e2',
                        }}
                      >
                        {row.plan_status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.plan_status === 'trialing'
                        ? left == null
                          ? '—'
                          : left > 0
                            ? `${left} days left`
                            : 'expired'
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>${typeof row.monthly_rate === 'number' ? row.monthly_rate : 150}/mo</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>
                      {row.stripe_subscription_id ? 'connected' : 'not connected'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={row.plan_status}
                        disabled={savingId === row.id}
                        onChange={(e) => changeStatus(row, e.target.value)}
                        style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      >
                        <option value="trialing">trialing</option>
                        <option value="active">active</option>
                        <option value="past_due">past_due</option>
                        <option value="canceled">canceled</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
