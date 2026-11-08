'use client';

import { useEffect, useState } from 'react';
import { loadAdminAggregates, loadAdminRoster, setAdminSuspended, type AdminAggregates, type RosterRow } from '../lib/money';
import { loadCountyDemand, type CountyDemandRow } from '../lib/directories';
import { getProfileAccess, type ProfileAccess } from '../lib/access';
import { loadAllReferrals, setReferralStatus, type Referral, type ReferralStatus } from '../lib/portals';

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
  const [demand, setDemand] = useState<CountyDemandRow[] | null>(null);
  const [refs, setRefs] = useState<Referral[] | null>(null);
  const [refsErr, setRefsErr] = useState('');
  const [dErr, setDErr] = useState('');

  const refreshRoster = () => {
    loadAdminRoster().then(setRoster).catch(() => setRErr('The account roster is not available yet — schema v3.6 must be run in Supabase first.'));
  };

  useEffect(() => {
    if (!userId || userEmail !== OWNER_EMAIL) return;
    loadAdminAggregates().then(setAgg).catch(() => setErr('Admin aggregates are not available yet — schema v3.4 must be run in Supabase first.'));
    getProfileAccess(userId).then(setAccess).catch(() => {});
    refreshRoster();
    loadCountyDemand().then(setDemand).catch(() => setDErr('The county Verify Queue is not available yet — schema v4.0 must be run in Supabase first.'));
    loadAllReferrals().then(setRefs).catch(() => setRefsErr('Referrals are not available yet — schema v4.7 must be run in Supabase first.'));
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
              {r.referrer_email ? ` · referred by ${r.referrer_email}` : ''}
              {r.referral_credit_due ? ' · 💳 REFERRAL CREDIT DUE — $150 to the referrer (settle by hand; it is never billed or paid automatically)' : ''}
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
      <h3 style={{ marginTop: 16 }}>County Verify Queue — where wholesalers are asking for coverage</h3>
      <p style={{ fontSize: 13 }}>
        Counties wholesalers have saved their own links for, ranked by how many distinct wholesalers saved them.
        County names and counts only — never who saved them or what links they entered. A county with a platform
        row is already verified; the rest are candidates for the next verification batch.
      </p>
      {dErr && <p style={{ fontSize: 13, color: '#fbbf24' }}>{dErr}</p>}
      {demand === null && !dErr ? (
        <p style={{ fontSize: 13 }}>Loading the Verify Queue…</p>
      ) : demand && demand.length === 0 ? (
        <p style={{ fontSize: 13 }}>No wholesaler-saved counties yet.</p>
      ) : demand ? (
        <ul style={{ fontSize: 13, paddingLeft: 18 }}>
          {demand.map((d) => (
            <li key={`${d.state_code}-${d.county_name}`} style={{ marginBottom: 6 }}>
              <strong>{d.county_name} County, {d.state_code}</strong> — {d.wholesalers} wholesaler{d.wholesalers === 1 ? '' : 's'} · {d.saved_rows} saved row{d.saved_rows === 1 ? '' : 's'} ·{' '}
              {d.has_platform
                ? <span style={{ color: '#4ade80' }}>Platform verified already</span>
                : <span style={{ color: '#fbbf24' }}>Not platform-verified yet</span>}
            </li>
          ))}
        </ul>
      ) : null}

      <h3 style={{ marginTop: 16 }}>Referrals — sellers reported to you by referrers</h3>
      <p style={{ fontSize: 12.5, color: '#94a3b8', maxWidth: 760 }}>
        These are submissions addressed to you by the referrers who sent them — not a peek into
        anyone&rsquo;s workspace. Work each one like a lead (a referral is not consent), and set its
        status so the referrer sees where it stands. When a referred deal closes and funds, record the
        referrer&rsquo;s $1,000 on the deal&rsquo;s disbursements.
      </p>
      {refsErr && <p style={{ fontSize: 13, color: '#fbbf24' }}>{refsErr}</p>}
      {refs === null && !refsErr ? (
        <p style={{ fontSize: 13 }}>Loading referrals…</p>
      ) : refs && refs.length === 0 ? (
        <p style={{ fontSize: 13 }}>No referrals yet.</p>
      ) : refs ? (
        <ul style={{ fontSize: 13, paddingLeft: 18 }}>
          {refs.map((r) => (
            <li key={r.id} style={{ marginBottom: 8 }}>
              <strong>{r.property_address}</strong>{r.city ? ` — ${r.city}, ${r.state || ''} ${r.zip || ''}` : ''}
              {r.seller_name ? ` · seller: ${r.seller_name}` : ''}
              {` · from ${r.referrer_email} · “${r.relationship}”`}
              {' '}
              <select
                value={r.status}
                onChange={async (e) => {
                  const ok = await setReferralStatus(r.id as string, e.target.value as ReferralStatus);
                  if (ok) loadAllReferrals().then(setRefs).catch(() => {});
                }}
              >
                <option value="received">Received</option>
                <option value="working">In progress</option>
                <option value="closed">Closed — $1,000 earned</option>
                <option value="dead">Not moving forward</option>
              </select>
              {r.notes ? <span style={{ color: '#94a3b8' }}> · {r.notes}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
