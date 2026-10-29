'use client';

import { useEffect, useState } from 'react';
import {
  ROLE_LABELS,
  PORTAL_ROLES,
  loadMyProfile,
  setMyRole,
  loadMyBuyBoxes,
  saveBuyBox,
  deleteBuyBox,
  loadFeed,
  listingMatchesBox,
  loadDashboard,
  loadSellerDeals,
  loadTitleLink,
  type PortalRole,
  type BuyBox,
  type FeedListing,
  type DashboardData,
  type LinkedDeal,
  type TitleLink,
} from '../lib/portals';

// Slice 9 — Full Portals home. One signed-in home, routed by profiles.role:
// wholesaler command dashboard, buyer buy-box + deal feed, seller linked
// deals, title company files. Roles are self-selected at launch (the owner
// can correct them); every list below is real data under RLS, with honest
// empty states — nothing is simulated.

const card: React.CSSProperties = { background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 };
const stat: React.CSSProperties = { background: '#0f172a', padding: 12, borderRadius: 10, minWidth: 130, flex: '1 1 130px' };
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function PortalHome({ userId }: { userId: string | null }) {
  const [role, setRole] = useState<PortalRole | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!userId) return;
    loadMyProfile(userId)
      .then((p) => setRole(p?.role ?? 'wholesaler'))
      .catch(() => setRole('wholesaler'));
  }, [userId]);

  if (!userId) return null;

  return (
    <section style={card}>
      <h2>Your Portal</h2>
      {role === null ? (
        <p style={{ fontSize: 13 }}>Loading your portal…</p>
      ) : (
        <>
          <p style={{ fontSize: 13 }}>
            You are registered as: <strong>{ROLE_LABELS[role]}</strong>{' '}
            <label style={{ marginLeft: 12 }}>
              Switch role:{' '}
              <select
                value={role}
                onChange={async (e) => {
                  const next = e.target.value as PortalRole;
                  try {
                    await setMyRole(userId, next);
                    setRole(next);
                    setNote('Role updated.');
                  } catch (err) {
                    setNote(err instanceof Error ? err.message : 'Could not update role.');
                  }
                }}
              >
                {PORTAL_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </label>
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            Roles are self-selected at launch — pick the one that matches how you use WholesalingOS.
          </p>
          {note && <p style={{ fontSize: 13 }}>{note}</p>}
          {role === 'wholesaler' && <WholesalerDashboard userId={userId} />}
          {role === 'buyer' && <BuyerPortal userId={userId} />}
          {role === 'seller' && <SellerPortal userId={userId} />}
          {role === 'title' && <TitlePortal userId={userId} />}
        </>
      )}
    </section>
  );
}

function WholesalerDashboard({ userId }: { userId: string }) {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    loadDashboard(userId).then(setDash).catch((e) => setErr(e instanceof Error ? e.message : 'Load failed'));
  }, [userId]);
  if (err) return <p style={{ fontSize: 13, color: '#f87171' }}>{err}</p>;
  if (!dash) return <p style={{ fontSize: 13 }}>Loading your dashboard…</p>;
  const stages = ['new', 'contacted', 'qualified', 'under_contract', 'assigned', 'closed'];
  return (
    <div>
      <h3>Wholesaler Dashboard — your numbers, live</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <div style={stat}><strong style={{ fontSize: 20 }}>{dash.leadsTotal}</strong><br />Leads (yours)</div>
        <div style={stat}><strong style={{ fontSize: 20 }}>{dash.followUpsDue}</strong><br />Follow-ups due</div>
        <div style={stat}><strong style={{ fontSize: 20 }}>{dash.dealsCount}</strong><br />Deals saved</div>
        <div style={stat}><strong style={{ fontSize: 20 }}>{money(dash.feesInPipeline)}</strong><br />Assignment fees in pipeline</div>
        <div style={stat}><strong style={{ fontSize: 20 }}>{dash.myActiveListings}</strong><br />Active listings</div>
        <div style={stat}><strong style={{ fontSize: 20 }}>{dash.offersReceived}</strong><br />New offers received</div>
      </div>
      <p style={{ fontSize: 13 }}>
        Pipeline by stage:{' '}
        {stages.map((s) => `${s}: ${dash.leadsByStatus[s] || 0}`).join(' · ')}
        {dash.leadsByStatus.dead ? ` · dead: ${dash.leadsByStatus.dead}` : ''}
      </p>
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Every number above is counted from your own leads, deals, listings, and offers in Supabase.
        Offers inbox actions arrive in Slice 10; the full KPI scorecard in Slice 14.
      </p>
    </div>
  );
}

function BuyerPortal({ userId }: { userId: string }) {
  const [boxes, setBoxes] = useState<BuyBox[]>([]);
  const [feed, setFeed] = useState<FeedListing[]>([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ label: 'My Buy Box', states: '', counties: '', cities: '', types: '', min: '', max: '', beds: '' });

  const refresh = () => {
    loadMyBuyBoxes(userId).then(setBoxes).catch((e) => setErr(e instanceof Error ? e.message : 'Load failed'));
    loadFeed().then(setFeed).catch(() => {});
  };
  useEffect(refresh, [userId]);

  return (
    <div>
      <h3>Cash Buyer Portal</h3>
      {err && <p style={{ fontSize: 13, color: '#f87171' }}>{err}</p>}
      <p style={{ fontSize: 13 }}>Publish a buy box so wholesalers' deals can be matched to you. Comma-separated lists.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input placeholder="States (FL, GA)" value={form.states} onChange={(e) => setForm({ ...form, states: e.target.value })} />
        <input placeholder="Counties" value={form.counties} onChange={(e) => setForm({ ...form, counties: e.target.value })} />
        <input placeholder="Cities" value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} />
        <input placeholder="Types (SFR, Duplex)" value={form.types} onChange={(e) => setForm({ ...form, types: e.target.value })} />
        <input placeholder="Min price" inputMode="numeric" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} />
        <input placeholder="Max price" inputMode="numeric" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
        <input placeholder="Min beds" inputMode="numeric" value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} />
        <button onClick={async () => {
          try {
            await saveBuyBox(userId, {
              label: form.label.trim() || 'My Buy Box',
              states: splitList(form.states), counties: splitList(form.counties),
              cities: splitList(form.cities), property_types: splitList(form.types),
              price_min: form.min ? Number(form.min) : null,
              price_max: form.max ? Number(form.max) : null,
              min_beds: form.beds ? Number(form.beds) : null,
              active: true,
            });
            refresh();
          } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
        }}>Save buy box</button>
      </div>
      {boxes.length > 0 && (
        <ul style={{ fontSize: 13 }}>
          {boxes.map((b) => (
            <li key={b.id}>
              <strong>{b.label}</strong> — {[...b.cities, ...b.states].join(', ') || 'Anywhere'}
              {b.price_max != null ? ` · up to ${money(Number(b.price_max))}` : ''}
              {' '}<button onClick={async () => { if (b.id) { await deleteBuyBox(b.id); refresh(); } }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      <h4>Deal feed — active public listings</h4>
      {feed.length === 0 ? (
        <p style={{ fontSize: 13 }}>No active public listings yet. When a wholesaler activates a listing, it appears here.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {feed.map((l) => {
            const mine = boxes.some((b) => listingMatchesBox(l, b));
            return (
              <li key={l.id}>
                <strong>{l.deals?.documents?.property_address || 'Address in deal file'}</strong> — total cost {money(Number(l.total_marketplace_cost))}
                {l.deals?.assignment_fee != null ? ` · fee ${money(Number(l.deals.assignment_fee))}` : ''}
                {mine ? ' · Matches your buy box' : ''}
              </li>
            );
          })}
        </ul>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Match = your price range plus a plain text match of your cities/states against the property address.
        Making an offer from the feed arrives in Slice 10.
      </p>
    </div>
  );
}

function SellerPortal({ userId }: { userId: string }) {
  const [deals, setDeals] = useState<LinkedDeal[] | null>(null);
  useEffect(() => { loadSellerDeals(userId).then(setDeals).catch(() => setDeals([])); }, [userId]);
  return (
    <div>
      <h3>Seller Portal</h3>
      {deals === null ? (
        <p style={{ fontSize: 13 }}>Loading your deals…</p>
      ) : deals.length === 0 ? (
        <p style={{ fontSize: 13 }}>
          No deals are linked to your account yet. When a wholesaler links a contract to your account,
          it appears here for review. In-portal signing arrives in Slice 11.
        </p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {deals.map((d) => (
            <li key={d.id}>
              <strong>{d.documents?.property_address || 'Property'}</strong> — price {d.contract_price != null ? money(Number(d.contract_price)) : '—'} · status {d.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TitlePortal({ userId }: { userId: string }) {
  const [link, setLink] = useState<TitleLink | null>(null);
  useEffect(() => { loadTitleLink(userId).then(setLink).catch(() => setLink({ companies: [], files: [] })); }, [userId]);
  return (
    <div>
      <h3>Title Company Portal</h3>
      {link === null ? (
        <p style={{ fontSize: 13 }}>Loading your files…</p>
      ) : link.companies.length === 0 ? (
        <p style={{ fontSize: 13 }}>
          Your account is not linked to a title company listing yet. Once a wholesaler links your
          company, its escrow files appear here.
        </p>
      ) : (
        <div style={{ fontSize: 13 }}>
          <p>Linked company: {link.companies.map((c) => c.name).join(', ')}</p>
          {link.files.length === 0 ? (
            <p>No escrow files assigned yet.</p>
          ) : (
            <ul>
              {link.files.map((f) => (
                <li key={f.id}>File {f.id.slice(0, 8)} — {f.file_status} · EMD {f.emd_status}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
