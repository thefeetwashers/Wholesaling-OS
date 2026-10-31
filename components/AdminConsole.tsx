'use client';

import { useEffect, useState } from 'react';
import { loadAdminAggregates, loadAdminRoster, setAdminSuspended, type AdminAggregates, type RosterRow } from '../lib/money';
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
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [rErr, setRErr] = useState('');
  const [rMsg, setRMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshRoster = () => {
    loadAdminRoster().then(setRoster).catch(() => setRErr('The account roster is not available yet — schema v3.6 must be run in Supabase first.'));
  };

  useEffect(() => {
    if (!userId || userEmail !== OWNER_EMAIL) return;
    loadAdminAggregates().then(setAgg).catch(() => setErr('Admin aggregates are not available yet — schema v3.4 must be run in Supabase first.'));
    getProfileAccess(userId).then(setAccess).catch(() => {});
    refreshRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userEmail]);

  const toggleSuspend = async (row: RosterRow) => {
    setBusyId(row.user_id);
    setRMsg('');
    try {
      const ok = await setAdminSuspended(row.user_id, !row.admin_suspended);
      if (ok) {
        setRMsg(row.admin_suspended
          ? `Access restored for ${row.email}.`
          : `${row.email} is suspended — their office is locked until you restore it. Their data is saved.`);
        refreshRoster();
      } else {
        setRMsg('That change was refused by the database (the owner account cannot be suspended).');
      }
    } catch {
      setRMsg('The change failed — check the connection and try again.');
    }
    setBusyId(null);
  };

  if (!userId || userEmail !== OWNER_EMAIL) return null;
  const fmtMap = (m?: Record<string, number>) =>
    m ? Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—';

  return (
    <section style={{ background: '#3b0764', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Owner Admin — command office</h2>
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
      <h3 style={{ marginTop: 16 }}>Accounts — roster &amp; access control</h3>
      {rErr && <p style={{ fontSize: 13, color: '#fbbf24' }}>{rErr}</p>}
      {rMsg && <p style={{ fontSize: 13 }}>{rMsg}</p>}
      {roster === null && !rErr ? (
        <p style={{ fontSize: 13 }}>Loading accounts…</p>
      ) : roster ? (
        <ul style={{ fontSize: 13, paddingLeft: 18 }}>
          {roster.map((r) => (
            <li key={r.user_id} style={{ marginBottom: 8 }}>
              <strong>{r.company || r.email}</strong> — {r.email} · {r.role} · {r.subscription_status}
              {r.subscription_status === 'trialing' && r.trial_ends_at
                ? ` · trial ends ${new Date(r.trial_ends_at).toLocaleDateString()}`
                : ''}
              {r.admin_suspended ? ' · SUSPENDED' : ''}
              <br />
              {r.email === OWNER_EMAIL ? (
                <span style={{ fontSize: 12, color: '#d8b4fe' }}>Owner account — cannot be suspended.</span>
              ) : (
                <button onClick={() => toggleSuspend(r)} disabled={busyId === r.user_id}>
                  {busyId === r.user_id ? 'Working…' : r.admin_suspended ? 'Restore access' : 'Suspend access'}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <p style={{ fontSize: 12, color: '#d8b4fe' }}>
        The roster shows account and billing information only. Individual users' buyer lists, leads, and deal details are never shown here —
        a buyer list is a wholesaler's moat.
      </p>
    </section>
  );
}
