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
  createOffer,
  loadBuyerOffers,
  loadIncomingOffers,
  setOfferStatus,
  acceptOffer,
  loadAllBuyBoxes,
  claimDeal,
  claimTitleCompany,
  signDealDocument,
  loadBuyerDeals,
  loadFileMilestones,
  type PortalRole,
  type BuyBox,
  type FeedListing,
  type DashboardData,
  type LinkedDeal,
  type TitleLink,
  type OfferRow,
} from '../lib/portals';

// Full Portals home (Slices 9-10). One signed-in home, routed by
// profiles.role: wholesaler command dashboard + offers inbox + buyer
// demand, buyer buy-box + deal feed + offers, seller linked deals, title
// company files. Every list is real data under RLS with honest empty
// states — nothing is simulated.

const card: React.CSSProperties = { background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 };
const stat: React.CSSProperties = { background: '#0f172a', padding: 12, borderRadius: 10, minWidth: 130, flex: '1 1 130px' };
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const offerAddress = (o: OfferRow) => o.listing?.deals?.documents?.property_address || 'Property';

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
      <OffersInbox userId={userId} />
      <BuyerDemand />
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Every number above is counted from your own leads, deals, listings, and offers in Supabase.
        The full KPI scorecard arrives in Slice 14.
      </p>
    </div>
  );
}

function OffersInbox({ userId }: { userId: string }) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [counter, setCounter] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const refresh = () => { void loadIncomingOffers(userId).then(setOffers).catch(() => {}); };
  useEffect(refresh, [userId]);
  return (
    <div>
      <h4>Offers inbox</h4>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      {offers.length === 0 ? (
        <p style={{ fontSize: 13 }}>No offers yet. When a buyer offers on one of your listings, it lands here.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {offers.map((o) => (
            <li key={o.id} style={{ marginBottom: 8 }}>
              <strong>{offerAddress(o)}</strong> — offer {money(Number(o.amount))}
              {o.counter_amount != null ? ` · your counter: ${money(Number(o.counter_amount))}` : ''}
              {' '}· status: {o.status}
              {o.message ? <><br />Buyer note: {o.message}</> : null}
              {o.status === 'sent' && (
                <>
                  <br />
                  <button onClick={async () => { await acceptOffer(o); setMsg('Offer accepted — the deal\u2019s B\u2013C status in Contracts now shows the accepted amount.'); refresh(); }}>Accept</button>{' '}
                  <input placeholder="Counter $" style={{ width: 90 }} value={counter[o.id] || ''} onChange={(e) => setCounter({ ...counter, [o.id]: e.target.value })} />{' '}
                  <button onClick={async () => { const v = Number(counter[o.id]); if (v > 0) { await setOfferStatus(o.id, 'countered', v); setMsg('Counter sent.'); refresh(); } }}>Counter</button>{' '}
                  <button onClick={async () => { await setOfferStatus(o.id, 'declined'); setMsg('Offer declined.'); refresh(); }}>Decline</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BuyerDemand() {
  const [boxes, setBoxes] = useState<BuyBox[] | null>(null);
  useEffect(() => { loadAllBuyBoxes().then(setBoxes).catch(() => setBoxes([])); }, []);
  if (boxes === null) return null;
  const places = new Map<string, number>();
  for (const b of boxes) for (const p of [...b.cities, ...b.states]) places.set(p, (places.get(p) || 0) + 1);
  const topList: [string, number][] = [];
  places.forEach((n, p) => topList.push([p, n]));
  const top = topList.sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <div>
      <h4>Buyer demand — active buy boxes ({boxes.length})</h4>
      {boxes.length === 0 ? (
        <p style={{ fontSize: 13 }}>No buyer buy boxes yet. Demand appears here as buyers publish them.</p>
      ) : (
        <>
          {top.length > 0 && <p style={{ fontSize: 13 }}>Most wanted: {top.map(([p, n]) => `${p} (${n})`).join(' · ')}</p>}
          <ul style={{ fontSize: 13 }}>
            {boxes.slice(0, 10).map((b) => (
              <li key={b.id}>
                {[...b.cities, ...b.states].join(', ') || 'Anywhere'}
                {b.property_types.length ? ` · ${b.property_types.join(', ')}` : ''}
                {b.price_max != null ? ` · up to ${money(Number(b.price_max))}` : ''}
                {b.min_beds != null ? ` · ${b.min_beds}+ beds` : ''}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>Criteria only — buyer identities are never shown here.</p>
        </>
      )}
    </div>
  );
}

function BuyerSignatures({ userId }: { userId: string }) {
  const [deals, setDeals] = useState<LinkedDeal[]>([]);
  const [signName, setSignName] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const refresh = () => { loadBuyerDeals(userId).then(setDeals).catch(() => {}); };
  useEffect(refresh, [userId]);
  if (deals.length === 0) return null;
  return (
    <div>
      <h4>Assignments awaiting your signature</h4>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      <ul style={{ fontSize: 13 }}>
        {deals.map((d) => {
          const docs = d.documents || {};
          const abSigned = docs.ab_status === 'Signed';
          const bcSigned = docs.bc_status === 'Signed';
          return (
            <li key={d.id} style={{ marginBottom: 8 }}>
              <strong>{docs.property_address || 'Property'}</strong> — price {d.contract_price != null ? money(Number(d.contract_price)) : '—'}
              {d.assignment_fee != null ? ` · assignment fee ${money(Number(d.assignment_fee))}` : ''}
              <br />A–B agreement: {abSigned ? 'Signed' : 'not signed yet'} · B–C assignment: {bcSigned ? 'Signed' : (docs.bc_status || 'pending')}
              {!abSigned && <><br />Waiting on the seller's A–B signature first — the B–C assignment cannot be signed before it.</>}
              {abSigned && !bcSigned && (
                <>
                  <br />
                  <input placeholder="Type your full name to sign" value={signName[d.id] || ''} onChange={(e) => setSignName({ ...signName, [d.id]: e.target.value })} />{' '}
                  <button onClick={async () => {
                    const name = (signName[d.id] || '').trim();
                    if (name.length < 3) { setMsg('Type your full name to sign.'); return; }
                    try { await signDealDocument(d.id, docs, 'bc', name, 'buyer'); setMsg('B–C assignment signed — timestamp recorded in the deal audit trail.'); refresh(); }
                    catch (e) { setMsg(e instanceof Error ? e.message : 'Signing failed'); }
                  }}>Sign B–C assignment</button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Signatures are typed-name with a recorded timestamp. Contract wording is pending attorney review — not for live transactions yet.
      </p>
    </div>
  );
}

function BuyerPortal({ userId }: { userId: string }) {
  const [boxes, setBoxes] = useState<BuyBox[]>([]);
  const [feed, setFeed] = useState<FeedListing[]>([]);
  const [myOffers, setMyOffers] = useState<OfferRow[]>([]);
  const [offerForm, setOfferForm] = useState<Record<string, { amount: string; message: string }>>({});
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ label: 'My Buy Box', states: '', counties: '', cities: '', types: '', min: '', max: '', beds: '' });

  const refresh = () => {
    loadMyBuyBoxes(userId).then(setBoxes).catch((e) => setErr(e instanceof Error ? e.message : 'Load failed'));
    loadFeed().then(setFeed).catch(() => {});
    loadBuyerOffers(userId).then(setMyOffers).catch(() => {});
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
            const f = offerForm[l.id] || { amount: '', message: '' };
            return (
              <li key={l.id} style={{ marginBottom: 10 }}>
                <strong>{l.deals?.documents?.property_address || 'Address in deal file'}</strong> — total cost {money(Number(l.total_marketplace_cost))}
                {l.deals?.assignment_fee != null ? ` · fee ${money(Number(l.deals.assignment_fee))}` : ''}
                {mine ? ' · Matches your buy box' : ''}
                <br />
                <input placeholder="Your offer $" style={{ width: 110 }} value={f.amount} onChange={(e) => setOfferForm({ ...offerForm, [l.id]: { ...f, amount: e.target.value } })} />{' '}
                <input placeholder="Message (optional)" value={f.message} onChange={(e) => setOfferForm({ ...offerForm, [l.id]: { ...f, message: e.target.value } })} />{' '}
                <button onClick={async () => {
                  const amt = Number(f.amount);
                  if (!(amt > 0)) { setErr('Enter an offer amount first.'); return; }
                  try { await createOffer(userId, l, amt, f.message); setErr(''); refresh(); }
                  catch (e) { setErr(e instanceof Error ? e.message : 'Offer failed'); }
                }}>Make offer</button>
              </li>
            );
          })}
        </ul>
      )}
      <h4>My offers</h4>
      {myOffers.length === 0 ? (
        <p style={{ fontSize: 13 }}>You have not made any offers yet.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {myOffers.map((o) => (
            <li key={o.id}>
              <strong>{offerAddress(o)}</strong> — your offer {money(Number(o.amount))} · status: {o.status}
              {o.counter_amount != null ? ` · wholesaler counter: ${money(Number(o.counter_amount))}` : ''}
              {o.status === 'sent' || o.status === 'countered' ? (
                <> <button onClick={async () => { await setOfferStatus(o.id, 'withdrawn'); refresh(); }}>Withdraw</button></>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <BuyerSignatures userId={userId} />
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Match = your price range plus a plain text match of your cities/states against the property address.
      </p>
    </div>
  );
}

function SellerPortal({ userId }: { userId: string }) {
  const [deals, setDeals] = useState<LinkedDeal[] | null>(null);
  const [claimId, setClaimId] = useState('');
  const [signName, setSignName] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const refresh = () => { loadSellerDeals(userId).then(setDeals).catch(() => setDeals([])); };
  useEffect(refresh, [userId]);
  return (
    <div>
      <h3>Seller Portal</h3>
      <p style={{ fontSize: 13 }}>
        Link a contract your wholesaler sent you: paste the deal ID they gave you.{' '}
        <input placeholder="Deal ID" value={claimId} onChange={(e) => setClaimId(e.target.value)} style={{ width: 280 }} />{' '}
        <button onClick={async () => {
          try { await claimDeal(claimId, userId); setMsg('Deal linked to your account.'); setClaimId(''); refresh(); }
          catch (e) { setMsg(e instanceof Error ? e.message : 'Could not link that deal.'); }
        }}>Link deal</button>
      </p>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      {deals === null ? (
        <p style={{ fontSize: 13 }}>Loading your deals…</p>
      ) : deals.length === 0 ? (
        <p style={{ fontSize: 13 }}>No deals are linked to your account yet. Link one above with its deal ID.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {deals.map((d) => {
            const docs = d.documents || {};
            const signed = docs.ab_status === 'Signed';
            return (
              <li key={d.id} style={{ marginBottom: 10 }}>
                <strong>{docs.property_address || 'Property'}</strong> — purchase price {d.contract_price != null ? money(Number(d.contract_price)) : '—'}
                <br />A–B purchase agreement: {signed ? 'Signed' : 'awaiting your signature'}
                {!signed && (
                  <>
                    <br />
                    <input placeholder="Type your full name to sign" value={signName[d.id] || ''} onChange={(e) => setSignName({ ...signName, [d.id]: e.target.value })} />{' '}
                    <button onClick={async () => {
                      const name = (signName[d.id] || '').trim();
                      if (name.length < 3) { setMsg('Type your full name to sign.'); return; }
                      try { await signDealDocument(d.id, docs, 'ab', name, 'seller'); setMsg('A–B agreement signed — timestamp recorded in the deal audit trail.'); refresh(); }
                      catch (e) { setMsg(e instanceof Error ? e.message : 'Signing failed'); }
                    }}>Sign A–B agreement</button>
                  </>
                )}
                {docs.signatures && docs.signatures.length > 0 && (
                  <><br />Signatures on file: {docs.signatures.map((s) => `${s.party} (${s.name}) — ${s.document}, ${new Date(s.signed_at).toLocaleString()}`).join(' · ')}</>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        You see your purchase price only — the wholesaler's assignment fee is not part of your agreement.
        Signatures are typed-name with a recorded timestamp. Contract wording is pending attorney review — not for live transactions yet.
      </p>
    </div>
  );
}

function TitlePortal({ userId }: { userId: string }) {
  const [link, setLink] = useState<TitleLink | null>(null);
  const [claimId, setClaimId] = useState('');
  const [msg, setMsg] = useState('');
  const [milestones, setMilestones] = useState<Record<string, { milestone_name: string; logged_at: string }[]>>({});
  const refresh = () => { loadTitleLink(userId).then(setLink).catch(() => setLink({ companies: [], files: [] })); };
  useEffect(refresh, [userId]);
  return (
    <div>
      <h3>Title Company Portal</h3>
      <p style={{ fontSize: 13 }}>
        Link your company listing: paste the company ID from the Titles directory.{' '}
        <input placeholder="Title company ID" value={claimId} onChange={(e) => setClaimId(e.target.value)} style={{ width: 280 }} />{' '}
        <button onClick={async () => {
          try { await claimTitleCompany(claimId, userId); setMsg('Company linked to your account.'); setClaimId(''); refresh(); }
          catch (e) { setMsg(e instanceof Error ? e.message : 'Could not link that company.'); }
        }}>Link company</button>
      </p>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      {link === null ? (
        <p style={{ fontSize: 13 }}>Loading your files…</p>
      ) : link.companies.length === 0 ? (
        <p style={{ fontSize: 13 }}>Your account is not linked to a title company listing yet. Link one above with its company ID.</p>
      ) : (
        <div style={{ fontSize: 13 }}>
          <p>Linked company: {link.companies.map((c) => c.name).join(', ')}</p>
          {link.files.length === 0 ? (
            <p>No escrow files assigned yet.</p>
          ) : (
            <ul>
              {link.files.map((f) => (
                <li key={f.id} style={{ marginBottom: 8 }}>
                  File {f.id.slice(0, 8)} — {f.file_status} · EMD {f.emd_status}
                  {f.emd_amount_required != null ? ` · EMD required ${money(Number(f.emd_amount_required))}` : ''}
                  {f.target_closing_date ? ` · target closing ${f.target_closing_date}` : ''}
                  {' '}<button onClick={async () => {
                    try { const ms = await loadFileMilestones(f.id); setMilestones({ ...milestones, [f.id]: ms }); }
                    catch { setMsg('Could not load milestones for that file.'); }
                  }}>View milestones</button>
                  {milestones[f.id] && (
                    <ul>
                      {milestones[f.id].length === 0 ? <li>No milestones logged yet.</li> :
                        milestones[f.id].map((m, i) => <li key={i}>{m.milestone_name} — {new Date(m.logged_at).toLocaleString()}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Public deals page (Slice 10) — visible signed-out. Reads only listings a
// wholesaler deliberately marked public + active (schema v3.2 anon policy);
// signed-in users see the same feed through the v3 policy.
export function PublicDealsSection() {
  const [feed, setFeed] = useState<FeedListing[] | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSharedId(new URLSearchParams(window.location.search).get('deal'));
    }
    loadFeed().then(setFeed).catch(() => setFeed([]));
  }, []);
  const ordered = feed ? [...feed].sort((a, b) => (a.id === sharedId ? -1 : b.id === sharedId ? 1 : 0)) : null;
  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Public Deals</h2>
      <p style={{ fontSize: 13 }}>
        <strong>Disclosure:</strong> listings here are assignments of equitable interest — a buyer is
        purchasing the wholesaler's contract rights, not the property itself. Verify all figures
        with the wholesaler and the title company before sending any funds.
      </p>
      {ordered === null ? (
        <p style={{ fontSize: 13 }}>Loading public deals…</p>
      ) : ordered.length === 0 ? (
        <p style={{ fontSize: 13 }}>No public listings right now. Sign in to see the full buyer feed.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {ordered.map((l) => (
            <li key={l.id} style={{ marginBottom: 8 }}>
              {l.id === sharedId ? <strong>Shared deal: </strong> : null}
              <strong>{l.deals?.documents?.property_address || 'Address in deal file'}</strong> — total cost {money(Number(l.total_marketplace_cost))}
              {l.deals?.assignment_fee != null ? ` · assignment fee ${money(Number(l.deals.assignment_fee))}` : ''}
              {' '}<button onClick={async () => {
                const url = `${window.location.origin}/?deal=${l.id}`;
                try { await navigator.clipboard.writeText(url); setCopied(l.id); } catch { setCopied(''); }
              }}>Copy share link</button>
              {copied === l.id ? ' Link copied.' : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
