'use client';

import { useEffect, useState } from 'react';
import { loadAdminAggregates, type AdminAggregates } from '../lib/money';
import { getProfileAccess, type ProfileAccess } from '../lib/access';

// Owner admin console — visible ONLY to the owner account. Privacy rule
// (standing): the owner sees billing status and anonymized aggregates,
// never another user's buyer list, leads, or deals. The aggregates come
// from a security-definer database function (schema v3.4) that returns
// counts only, and only to the owner's JWT.

const OWNER_EMAIL = 'thefeetwashers@gmail.com';

export default function AdminConsole({ userId, userEmail }: { userId: string | null; userEmail: string | null }) {
  const [agg, setAgg] = useState<AdminAggregates | null>(null);
  const [access, setAccess] = useState<ProfileAccess | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!userId || userEmail !== OWNER_EMAIL) return;
    loadAdminAggregates().then(setAgg).catch(() => setErr('Admin aggregates are not available yet — schema v3.4 must be run in Supabase first.'));
    getProfileAccess(userId).then(setAccess).catch(() => {});
  }, [userId, userEmail]);

  if (!userId || userEmail !== OWNER_EMAIL) return null;
  const fmtMap = (m?: Record<string, number>) =>
    m ? Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—';

  return (
    <section style={{ background: '#3b0764', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Owner Admin — aggregates only</h2>
      <p style={{ fontSize: 13 }}>
        Your account: {userEmail}
        {access ? ` · your subscription status: ${String((access as unknown as Record<string, unknown>).status ?? (access as unknown as Record<string, unknown>).subscription_status ?? 'on file')}` : ''}
      </p>
      {err && <p style={{ fontSize: 13, color: '#fbbf24' }}>{err}</p>}
      {agg === null && !err ? (
        <p style={{ fontSize: 13 }}>Loading platform aggregates…</p>
      ) : agg ? (
        <div style={{ fontSize: 13 }}>
          <p>
            Registered accounts: <strong>{agg.profiles_total ?? 0}</strong><br />
            By role: {fmtMap(agg.profiles_by_role)}<br />
            Subscriptions: {fmtMap(agg.subscriptions_by_status)}<br />
            Deals (all users): <strong>{agg.deals_total ?? 0}</strong> · Active listings: <strong>{agg.listings_active ?? 0}</strong> ·
            Offers: <strong>{agg.offers_total ?? 0}</strong> · Buy boxes: <strong>{agg.buy_boxes_total ?? 0}</strong>
          </p>
        </div>
      ) : null}
      <p style={{ fontSize: 12, color: '#d8b4fe' }}>
        Counts only, by design. Individual users' buyer lists, leads, and deal details are never shown here —
        a buyer list is a wholesaler's moat.
      </p>
    </section>
  );
}
