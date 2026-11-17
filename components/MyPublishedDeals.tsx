// Slice 133 — "My Published Deals" table in the dashboard.
//
// There was NO table listing the wholesaler's own published deals
// before this: PublishDealButton (components/PublishDealButton.tsx)
// publishes from a lead row in components/Leads.tsx, and the deal
// then lived only on the public /deals pages. This table is wired
// into that same Leads view (the dashboard view where the
// wholesaler's deals live), in the Leads section's own dark-card
// styling — no new dashboard shell, no new route.
//
// Each row shows the deal (ZIP-only location, never a street
// address), its status badge (components/DealStatusBadge.tsx), a
// status dropdown the owner uses to change it (Active / Under
// Contract / Sold — lib/deal-status.ts, owner-only via the Slice
// 132 owner-update RLS policy), and the owner-only "Copy Deal &
// Open OBL" button (components/CopyDealToOblButton.tsx).
//
// Published deals only: the Slice 132 public-read policy serves
// published = true rows. NOTE (pre-existing Slice 132 gap, not
// fixed here): there is no owner SELECT policy for a wholesaler's
// own UNPUBLISHED rows, so an owner cannot list unpublished deals
// through this table — only published ones appear. The detail
// page's fetchMyPublishedDealById has the same limit for an
// unpublished own deal unless the caller is the operator.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchMyPublishedDeals,
  updateDealStatus,
  normalizeDealStatus,
  DEAL_STATUSES,
  type DealStatus,
  type PublishedDealWithStatus,
} from '../lib/deal-status';
import DealStatusBadge from './DealStatusBadge';
import CopyDealToOblButton from './CopyDealToOblButton';

const money = (n: number | null | undefined): string =>
  n == null ? 'not provided' : `$${Math.round(n).toLocaleString()}`;

export default function MyPublishedDeals({ userId }: { userId: string }) {
  const [deals, setDeals] = useState<PublishedDealWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setDeals(await fetchMyPublishedDeals(userId));
    } catch (e) {
      setError((e as Error)?.message || 'Your published deals could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const changeStatus = async (deal: PublishedDealWithStatus, next: DealStatus) => {
    if (!deal.id) return;
    setMsg('');
    setError('');
    setSavingId(deal.id);
    const prev = normalizeDealStatus(deal.status);
    setDeals((rows) => rows.map((r) => (r.id === deal.id ? { ...r, status: next } : r)));
    try {
      await updateDealStatus(userId, deal.id, next);
      setMsg(
        next === 'Active'
          ? 'Deal is Active — it stays on the public deals page and open to offers.'
          : `Deal is now ${next} — new offers are blocked on it.`
      );
    } catch (e) {
      setDeals((rows) => rows.map((r) => (r.id === deal.id ? { ...r, status: prev } : r)));
      setError((e as Error)?.message || 'The deal status could not be changed.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 10,
        padding: 16,
        marginTop: 16,
      }}
    >
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>My Published Deals</h3>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px' }}>
        Deals you published to the public Off-Market Deals page. Locations show the ZIP area only — no street
        address is ever shown. Change a deal&apos;s status here; Under Contract and Sold deals take no new offers.
      </p>
      {loading && <p style={{ fontSize: 14, color: '#94a3b8' }}>Loading your published deals…</p>}
      {error && <p style={{ fontSize: 13, color: '#f87171' }}>{error}</p>}
      {msg && <p style={{ fontSize: 13, color: '#4ade80' }}>{msg}</p>}
      {!loading && !error && deals.length === 0 && (
        <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
          No deals published yet. Publish one from a lead row below — use the &ldquo;Publish as a deal&rdquo; button
          on your own lead.
        </p>
      )}
      {!loading && deals.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>Deal</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>Asking</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>Status</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>Change status</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>Cross-post</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #1e293b', verticalAlign: 'top' }}>
                    <Link href={`/deals/${d.id}`} style={{ color: '#7dd3fc', fontWeight: 700 }}>
                      {d.city || 'City not given'}
                      {d.state ? `, ${d.state}` : ''} {d.zip || ''}
                    </Link>
                    <span style={{ display: 'block', color: '#94a3b8', fontSize: 12.5 }}>
                      {d.property_type || 'Property type not given'}
                      {d.strategy ? ` · ${d.strategy}` : ''}
                    </span>
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #1e293b', verticalAlign: 'top' }}>{money(d.asking_price)}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #1e293b', verticalAlign: 'top' }}>
                    <DealStatusBadge status={d.status} />
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #1e293b', verticalAlign: 'top' }}>
                    <select
                      value={normalizeDealStatus(d.status)}
                      disabled={savingId === d.id}
                      onChange={(e) => changeStatus(d, e.target.value as DealStatus)}
                      aria-label={`Change status for deal in ${d.city || 'unknown city'} ${d.zip || ''}`}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #475569', background: '#1e293b', color: '#fff', fontSize: 13 }}
                    >
                      {DEAL_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #1e293b', verticalAlign: 'top' }}>
                    <CopyDealToOblButton deal={d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && deals.length > 0 && (
        <button
          type="button"
          onClick={load}
          style={{ marginTop: 10, padding: '6px 12px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}
        >
          Refresh list
        </button>
      )}
    </div>
  );
}
