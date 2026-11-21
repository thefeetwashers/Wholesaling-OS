'use client';

import { useEffect, useState } from 'react';
import {
  ROLE_LABELS,
  PORTAL_ROLES,
  loadMyProfile,
  setMyRole,
  loadFeed,
  loadDashboard,
  loadSellerDeals,
  loadTitleLink,
  createOffer,
  loadBuyerOffers,
  loadIncomingOffers,
  setOfferStatus,
  acceptOffer,
  loadMyListings,
  setListingStatus,
  type MyListing,
  claimDeal,
  claimTitleCompany,
  signDealDocument,
  loadBuyerDeals,
  loadFileMilestones,
  loadBuyerRecord,
  loadMyProofOfFunds,
  setMyProofOfFunds,
  type BuyerRecord,
  type PortalRole,
  type FeedListing,
  type DashboardData,
  type LinkedDeal,
  type TitleLink,
  type OfferRow,
} from '../lib/portals';
import { supabase } from '../lib/supabase';
import { buyerTier, completionRatePct, compareBuyerTierSummaries, type BuyerTierSummary } from '../lib/buyer-tiers';
import { boxLiveness } from '../lib/match';
import ScoutPortal, { ScoutClaimBoard, MyClaimedLeads } from './ScoutPortal';
import BuyerProofCard from './BuyerProofCard';
import LenderDashboard from './LenderDashboard';
import { loadMySchoolBadge } from '../lib/school';
// Slice 136 — buy-box merge: the buyer portal and the demand
// view read the LIVE table only (lib/buy-box.ts,
// public.wholesaler_buy_boxes — one row per wholesaler). The
// legacy multi-box list on public.buy_boxes is gone from the
// app; there is one buy box per account, saved with
// saveMyBuyBox, and published boxes are the only ones other
// people can see (loadAllPublishedBuyBoxes).
import {
  loadMyBuyBox,
  saveMyBuyBox,
  loadAllPublishedBuyBoxes,
  listingMatchesBox,
  CONDITION_OPTIONS,
  STRATEGY_OPTIONS,
  CLOSING_TIMELINE_OPTIONS,
  type BuyBox as LiveBuyBox,
} from '../lib/buy-box';
// Slice 132 — Matching deals. lib/match-buy-box.ts is built by
// another Slice 132 worker; import its exact contract here, do
// not redefine it. The file lands before the build runs.
// The deal-row type is derived from findMatchingDeals itself
// (DealSummary in the original contract; the matching worker
// calls the row type DealForMatching) so the name difference
// cannot break this file — only the function and the
// BuyBoxForMatching input shape are imported by name.
import { findMatchingDeals, type BuyBoxForMatching } from '../lib/match-buy-box';
type MatchingDealRow = Awaited<ReturnType<typeof findMatchingDeals>>[number];

// Full Portals home (Slices 9-10). One signed-in home, routed by
// profiles.role: wholesaler command dashboard + offers inbox + buyer
// demand, buyer buy-box + deal feed + offers, seller linked deals, title
// company files. Every list is real data under RLS with honest empty
// states — nothing is simulated.

const card: React.CSSProperties = { background: '#1e293b', border: '1px solid rgba(148,163,184,0.25)', padding: 20, borderRadius: 14, marginTop: 16 };
const stat: React.CSSProperties = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', padding: 12, borderRadius: 10, minWidth: 130, flex: '1 1 130px' };
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const offerAddress = (o: OfferRow) => o.listing?.deals?.documents?.property_address || 'Property';

// Slice 97 — portal frame parity. Every role's desk opens with
// the same framed header band the wholesaler surfaces use: an
// icon, the desk's name, and one line stating what the desk
// actually does — each line checked against the portal below it.
// Same shell, same frame, each role's own tools inside.
// Slice 132 — display labels only. The stored role value stays
// 'seller' (lib/portals.ts ROLE_LABELS, the role checks, the URL
// slugs, and every variable name are untouched); only the words
// a person reads say "Property owner" instead of "Seller".
const DISPLAY_ROLE_LABELS: Record<PortalRole, string> = {
  ...ROLE_LABELS,
  seller: 'Property owner',
};

const ROLE_BAND: Record<string, { icon: string; line: string }> = {
  wholesaler: { icon: '🏢', line: 'Your portal summary — pipeline, fees in play, offers received. The full office is in the sidebar; everything here is counted from your own records.' },
  buyer: { icon: '💵', line: 'Publish your buy box so deals can be matched to you, work the offers you make and receive — and your proof card above counts your real record from platform events, never from claims.' },
  seller: { icon: '🏠', line: 'Link a deal your wholesaler sent you, review what is yours, and sign when you are ready. You see your price — never the wholesaler’s fee.' },
  title: { icon: '🏛️', line: 'Link your company listing, see the escrow files assigned to you, and keep their milestones and dates in front of everyone who depends on them.' },
  referrer: { icon: '📨', line: 'Send a seller to the company desk, track the referral’s status, and earn $1,000 when the deal closes and funds — recorded on the deal itself.' },
  lender: { icon: '🏦', line: 'Publish your lending criteria, review only the commercial deal packets wholesalers chose to share with matched lenders, and move them through their statuses. Nothing here is a funding commitment.' },
};

export default function PortalHome({ userId }: { userId: string | null }) {
  const [role, setRole] = useState<PortalRole | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!userId) return;
    loadMyProfile(userId)
      .then((p) => { setRole(p?.role ?? 'wholesaler'); setUserEmail(p?.email ?? null); })
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
            You are registered as: <strong>{DISPLAY_ROLE_LABELS[role]}</strong>{' '}
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
                  <option key={r} value={r}>{DISPLAY_ROLE_LABELS[r]}</option>
                ))}
              </select>
            </label>
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            Roles are self-selected at launch — pick the one that matches how you use WholesalingOS.
          </p>
          {note && <p style={{ fontSize: 13 }}>{note}</p>}
          {ROLE_BAND[role] && (
            <div style={{ background: '#0f172a', border: '1px solid rgba(110,231,183,0.35)', borderRadius: 10, padding: '12px 14px', margin: '10px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{ROLE_BAND[role].icon} Your {DISPLAY_ROLE_LABELS[role]} desk</div>
              <p style={{ fontSize: 13, color: '#cbd5e1', margin: '4px 0 0' }}>{ROLE_BAND[role].line}</p>
            </div>
          )}
          {role === 'wholesaler' && <WholesalerDashboard userId={userId} />}
          {role === 'buyer' && <><BuyerProofCard userId={userId} /><BuyerPortal userId={userId} /></>}
          {role === 'seller' && <SellerPortal userId={userId} />}
          {role === 'title' && <TitlePortal userId={userId} />}
          {role === 'referrer' && <ScoutPortal userId={userId} role={role} />}
          {role === 'lender' && <LenderDashboard userId={userId} userEmail={userEmail} />}
        </>
      )}
    </section>
  );
}

function WholesalerDashboard({ userId }: { userId: string }) {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [err, setErr] = useState('');
  const [verifiedOperator, setVerifiedOperator] = useState(false);
  useEffect(() => {
    loadDashboard(userId).then(setDash).catch((e) => setErr(e instanceof Error ? e.message : 'Load failed'));
    loadMySchoolBadge(userId).then(setVerifiedOperator).catch(() => {});
  }, [userId]);
  if (err) return <p style={{ fontSize: 13, color: '#f87171' }}>{err}</p>;
  if (!dash) return <p style={{ fontSize: 13 }}>Loading your dashboard…</p>;
  const stages = ['new', 'contacted', 'qualified', 'under_contract', 'assigned', 'closed'];
  return (
    <div>
      <h3>
        Wholesaler Dashboard — your numbers, live{' '}
        {verifiedOperator && (
          <span
            title="Completed the 7-day bootcamp and passed the Day 7 check"
            style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#0f766e', background: '#ccfbf1', border: '1px solid #99f6e4', borderRadius: 999, padding: '3px 10px', verticalAlign: 'middle' }}
          >
            ✓ Verified Operator
          </span>
        )}
      </h3>
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
      <EarnedBuyerTiers userId={userId} />
      <MyListings userId={userId} />
      <BuyerDemand />
      <ScoutClaimBoard userId={userId} />
      <MyClaimedLeads userId={userId} />
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
              <BuyerRecordLine buyerUser={o.buyer_user} />
              {o.status === 'sent' && (
                <>
                  <br />
                  <button onClick={async () => { try { await acceptOffer(o); setMsg('Offer accepted \u2014 the deal\u2019s B\u2013C status in Contracts now shows the accepted amount.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Accept failed \u2014 the offer was not accepted.'); } refresh(); }}>Accept</button>{' '}
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

function EarnedBuyerTiers({ userId }: { userId: string }) {
  const [rows, setRows] = useState<BuyerTierSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const offers = await loadIncomingOffers(userId);
        const grouped = new Map<string, OfferRow[]>();
        for (const offer of offers) {
          const existing = grouped.get(offer.buyer_user) || [];
          existing.push(offer);
          grouped.set(offer.buyer_user, existing);
        }
        const entries = Array.from(grouped.entries());
        const summaries = await Promise.all(entries.map(async ([buyerUser, buyerOffers]) => {
          const record = await loadBuyerRecord(buyerUser);
          if (!record) return null;
          return {
            buyerUser,
            record,
            tier: buyerTier(record),
            offersCount: buyerOffers.length,
            latestAddress: offerAddress(buyerOffers[0]),
            completionRatePct: completionRatePct(record),
          } as BuyerTierSummary;
        }));
        if (on) setRows(summaries.filter((x): x is BuyerTierSummary => x !== null).sort(compareBuyerTierSummaries));
      } catch {
        if (on) { setRows([]); setFailed(true); }
      }
    })();
    return () => { on = false; };
  }, [userId]);

  return (
    <div>
      <h4>Earned buyer tiers — from the closing record the platform holds</h4>
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Only buyers who have offered on your listings appear here. The counts are the buyer&apos;s
        platform record from Slice 21 — accepted offers, B–C signings, and escrow outcomes — not a manual CRM
        label, a buyer&apos;s self-rating, or an outside list. Rules: Tier 1 = 3+ closed; Tier 2 = 1–2 closed;
        Tier 3 = no closings yet; Caution overrides when more escrows fell through than closed.
      </p>
      {rows === null ? (
        <p style={{ fontSize: 13 }}>Loading earned buyer tiers…</p>
      ) : failed ? (
        <p style={{ fontSize: 13 }}>Earned buyer tiers could not be loaded. No tier is shown rather than guessed.</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13 }}>No buyer offers yet, so no earned tiers to rank. Tiers appear as buyers offer on your listings and their platform records develop.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {rows.map((row) => (
            <li key={row.buyerUser} style={{ marginBottom: 8 }}>
              <strong>{row.tier.label}</strong> · Buyer ref {row.buyerUser.slice(0, 8)} · {row.offersCount} offer{row.offersCount === 1 ? '' : 's'} to you · latest: {row.latestAddress}
              <br />
              Platform record: {row.record.accepted_deals} accepted · {row.record.bc_signed} B–C signed · {row.record.closed_deals} closed · {row.record.fell_through} fell through
              {row.completionRatePct !== null ? ` · ${row.completionRatePct.toFixed(0)}% of resolved escrows closed` : ' · no resolved escrows yet'}
              {' · '}Proof of funds: {row.record.pof_status === 'self_reported'
                ? `self-reported${row.record.pof_note ? ` — ${row.record.pof_note}` : ''} (ask for the letter before you rely on it)`
                : 'not provided'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MyListings({ userId }: { userId: string }) {
  const [listings, setListings] = useState<MyListing[]>([]);
  const [msg, setMsg] = useState('');
  const refresh = () => { loadMyListings(userId).then(setListings).catch(() => {}); };
  useEffect(refresh, [userId]);
  if (listings.length === 0) return null;
  return (
    <div>
      <h4>My listings</h4>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      <ul style={{ fontSize: 13 }}>
        {listings.map((l) => (
          <li key={l.id} style={{ marginBottom: 6 }}>
            <strong>{l.deals?.documents?.property_address || 'Property'}</strong> — total {money(Number(l.total_marketplace_cost))} · {l.visibility} · status: {l.listing_status}
            {l.listing_status !== 'active' ? (
              <> <button onClick={async () => { await setListingStatus(l.id, 'active'); setMsg('Listing activated — it now appears in the buyer feed and on the public deals page.'); refresh(); }}>Activate listing</button></>
            ) : (
              <> <button onClick={async () => { await setListingStatus(l.id, 'draft'); setMsg('Listing paused back to draft — hidden from the feed and public page.'); refresh(); }}>Pause listing</button></>
            )}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Escrow creates listings as drafts. Nothing is public until you activate it here.
      </p>
    </div>
  );
}

function BuyerDemand() {
  const [boxes, setBoxes] = useState<LiveBuyBox[] | null>(null);
  useEffect(() => { loadAllPublishedBuyBoxes().then(setBoxes).catch(() => setBoxes([])); }, []);
  if (boxes === null) return null;
  const places = new Map<string, number>();
  for (const b of boxes) for (const p of [...b.markets, ...b.states]) places.set(p, (places.get(p) || 0) + 1);
  const topList: [string, number][] = [];
  places.forEach((n, p) => topList.push([p, n]));
  const top = topList.sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <div>
      <h4>Buyer demand — published buy boxes ({boxes.length})</h4>
      {boxes.length === 0 ? (
        <p style={{ fontSize: 13 }}>No buyer buy boxes yet. Demand appears here as buyers publish them.</p>
      ) : (
        <>
          {top.length > 0 && <p style={{ fontSize: 13 }}>Most wanted: {top.map(([p, n]) => `${p} (${n})`).join(' · ')}</p>}
          <ul style={{ fontSize: 13 }}>
            {boxes.slice(0, 10).map((b) => (
              <li key={b.id}>
                {[...b.markets, ...b.states].join(', ') || 'Anywhere'}
                {b.property_types.length ? ` · ${b.property_types.join(', ')}` : ''}
                {b.max_price != null ? ` · up to ${money(Number(b.max_price))}` : ''}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>Criteria only — buyer identities are never shown here. Only buy boxes their owners published are counted.</p>
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

// Slice 132 — Matching deals for the signed-in buyer.
//
// Loads the buyer's own saved buy box (lib/buy-box.ts) and passes
// the FULL box through to findMatchingDeals() from
// lib/match-buy-box.ts — including zip_codes, rehab_tolerance,
// and states, which another Slice 132 worker is adding to the box.
// The casts below read those fields when they exist and fall back
// to an empty list / null when they do not, so this compiles either
// way; the coordinator reconciles the box type at the end.
//
// Behaviour, all honest: no saved buy box → "Save your buy box to
// see matching deals." No matches → "No matching deals yet."
// (count in the heading is the real row count, 0 until real).
// If the matching function or its table is unavailable, the whole
// section hides itself — it never throws into the dashboard and
// never shows a fake number. No email/SMS alerts anywhere: no
// provider is connected, so buyers check back here for new matches.
function MatchingDeals({ userId }: { userId: string }) {
  const [box, setBox] = useState<LiveBuyBox | null | undefined>(undefined);
  const [deals, setDeals] = useState<MatchingDealRow[] | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const b = await loadMyBuyBox(userId);
        if (!on) return;
        if (!b) { setBox(null); return; }
        setBox(b);
        const boxForMatching: BuyBoxForMatching = {
          user_id: b.user_id ?? userId,
          markets: b.markets || [],
          // Slice 132 follow-up: BuyBoxForMatching gains `states`
          // (U.S. state codes, empty by default). Read the box's
          // real states when the field exists; empty until then.
          states: (b as unknown as { states?: string[] }).states ?? [],
          zip_codes: (b as unknown as { zip_codes?: string[] }).zip_codes ?? [],
          property_types: b.property_types || [],
          min_price: b.min_price ?? null,
          max_price: b.max_price ?? null,
          rehab_tolerance: (b as unknown as { rehab_tolerance?: string | null }).rehab_tolerance ?? null,
        };
        const matches = await findMatchingDeals(boxForMatching);
        if (on) setDeals(matches || []);
      } catch {
        // Matching unavailable (function/table not there yet) —
        // hide the section instead of breaking the dashboard.
        if (on) setHidden(true);
      }
    })();
    return () => { on = false; };
  }, [userId]);

  if (hidden) return null;
  if (box === undefined) return null;
  if (box === null) {
    return (
      <div>
        <h4>Matching deals</h4>
        <p style={{ fontSize: 13 }}>Save your buy box to see matching deals.</p>
      </div>
    );
  }
  if (deals === null) return null;
  return (
    <div>
      <h4>Matching deals ({deals.length})</h4>
      {deals.length === 0 ? (
        <p style={{ fontSize: 13 }}>No matching deals yet.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {deals.map((d) => (
            <li key={d.id} style={{ marginBottom: 6 }}>
              <a href={`/deals/${d.id}`}>{[d.city, d.state].filter(Boolean).join(', ') || 'Property'}</a>
              {d.property_type ? ` · ${d.property_type}` : ''}
              {d.asking_price != null ? ` · asking ${money(Number(d.asking_price))}` : ''}
              {d.zip ? ` · ${d.zip}` : ''}
              {d.condition ? ` · ${d.condition}` : ''}
            </li>
          ))}
        </ul>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Matched from your saved buy box against published deals. No alerts are sent — check back here for new matches.
      </p>
    </div>
  );
}

// Slice 136 — single buy box. The live table holds ONE row per
// wholesaler (UNIQUE(user_id)), so the buyer portal is one form,
// not a list: the same criteria fields the live table supports
// (markets, states, ZIPs, property types, price range, rehab
// tolerance, publish + email-alert flags, and the Slice 133
// criteria — max ARV %, min profit, condition / strategy
// preferences, closing timeline). Nothing is pre-filled; every
// field starts empty until the buyer saves it.
// The legacy "confirm still buying" button is REMOVED, honestly:
// the live table has no confirm column and no confirm flow, so a
// button that wrote nowhere would be fake. Liveness now reads
// the box's last-save date (updated_at, re-stamped on every
// save): saving the box again refreshes it, and boxes go stale
// 120 days after their last save.
function BuyerPortal({ userId }: { userId: string }) {
  const [box, setBox] = useState<LiveBuyBox | null>(null);
  const [boxLoaded, setBoxLoaded] = useState(false);
  const [feed, setFeed] = useState<FeedListing[]>([]);
  const [myOffers, setMyOffers] = useState<OfferRow[]>([]);
  const [offerForm, setOfferForm] = useState<Record<string, { amount: string; message: string }>>({});
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const todayISO = new Date().toISOString().slice(0, 10);
  const [markets, setMarkets] = useState('');
  const [states, setStates] = useState('');
  const [zips, setZips] = useState('');
  const [types, setTypes] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [rehab, setRehab] = useState('');
  const [published, setPublished] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(false);
  // Slice 134 — no toggle on this page; the loaded SMS preference
  // is preserved so saving here never silently resets it.
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [maxArvPct, setMaxArvPct] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [condPrefs, setCondPrefs] = useState<string[]>([]);
  const [stratPrefs, setStratPrefs] = useState<string[]>([]);
  const [closingTimeline, setClosingTimeline] = useState('');
  const [notes, setNotes] = useState('');

  const fillForm = (b: LiveBuyBox) => {
    setMarkets((b.markets || []).join(', '));
    setStates((b.states || []).join(', '));
    setZips((b.zip_codes || []).join(', '));
    setTypes((b.property_types || []).join(', '));
    setMinPrice(b.min_price != null ? String(b.min_price) : '');
    setMaxPrice(b.max_price != null ? String(b.max_price) : '');
    setRehab(b.rehab_tolerance || '');
    setPublished(b.published === true);
    setEmailAlerts(b.email_alerts_opt_in === true);
    setSmsOptIn(b.sms_opt_in === true);
    setMaxArvPct(b.max_arv_pct != null ? String(b.max_arv_pct) : '');
    setMinProfit(b.min_profit != null ? String(b.min_profit) : '');
    setCondPrefs(b.condition_preferences || []);
    setStratPrefs(b.strategy_preferences || []);
    setClosingTimeline(b.closing_timeline || '');
    setNotes(b.notes || '');
  };

  const refresh = () => {
    loadMyBuyBox(userId)
      .then((b) => { setBox(b); if (b) fillForm(b); setBoxLoaded(true); })
      .catch((e) => { setErr(e instanceof Error ? e.message : 'Load failed'); setBoxLoaded(true); });
    loadFeed().then(setFeed).catch(() => {});
    loadBuyerOffers(userId).then(setMyOffers).catch(() => {});
  };
  useEffect(refresh, [userId]);

  const togglePref = (list: string[], setList: (v: string[]) => void, v: string) => {
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const saveBox = async () => {
    try {
      const saved = await saveMyBuyBox(userId, {
        markets: splitList(markets),
        states: splitList(states).map((s) => s.toUpperCase()),
        zip_codes: splitList(zips),
        property_types: splitList(types),
        min_price: minPrice.trim() ? Number(minPrice) : null,
        max_price: maxPrice.trim() ? Number(maxPrice) : null,
        notes,
        published,
        email_alerts_opt_in: emailAlerts,
        sms_opt_in: smsOptIn,
        rehab_tolerance: rehab || null,
        max_arv_pct: maxArvPct.trim() ? Number(maxArvPct) : null,
        min_profit: minProfit.trim() ? Number(minProfit) : null,
        condition_preferences: condPrefs,
        strategy_preferences: stratPrefs,
        closing_timeline: closingTimeline || null,
      });
      setBox(saved);
      setNote(`Buy box saved — last updated ${todayISO}. Save again any time to refresh it.${published ? ' It is published, so wholesalers can match you.' : ' It is not published, so no wholesaler can see it.'}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
  };

  const lv = box ? boxLiveness(box, todayISO) : null;

  return (
    <div>
      <h3>Cash Buyer Portal</h3>
      {err && <p style={{ fontSize: 13, color: '#f87171' }}>{err}</p>}
      {note && <p style={{ fontSize: 13, color: '#34d399' }}>{note}</p>}
      <p style={{ fontSize: 13 }}>One buy box per account — publish it so wholesalers&apos; deals can be matched to you. Comma-separated lists. Nothing is pre-filled.</p>
      <BuyerRecordCard userId={userId} />
      {boxLoaded && box && lv && (
        <p style={{ fontSize: 13 }}>
          {lv.live ? (
            <span style={{ color: '#34d399' }}>✅ Last saved {lv.confirmedOn} — live.</span>
          ) : (
            <span style={{ color: '#fbbf24' }}>⚠️ Last saved {lv.confirmedOn || '—'} — this box reads as STALE to wholesalers (boxes go stale 120 days after their last save). Save it again below to refresh the date.</span>
          )}
        </p>
      )}
      {boxLoaded && !box && (
        <p style={{ fontSize: 13 }}>No buy box saved yet. Fill in what you buy — it stays empty until you save it.</p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input placeholder="Markets — counties (Broward, St. Lucie)" value={markets} onChange={(e) => setMarkets(e.target.value)} />
        <input placeholder="States (FL, GA)" value={states} onChange={(e) => setStates(e.target.value)} />
        <input placeholder="ZIP codes (34950, 33313)" value={zips} onChange={(e) => setZips(e.target.value)} />
        <input placeholder="Types (SFR, Duplex)" value={types} onChange={(e) => setTypes(e.target.value)} />
        <input placeholder="Min price" inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        <input placeholder="Max price" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <input placeholder="Max ARV % (optional)" inputMode="numeric" value={maxArvPct} onChange={(e) => setMaxArvPct(e.target.value)} />
        <input placeholder="Min profit $ (optional)" inputMode="numeric" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} />
        <select value={rehab} onChange={(e) => setRehab(e.target.value)}>
          <option value="">Rehab tolerance: no preference</option>
          <option value="any">Any — no preference</option>
          <option value="light">Light rehab or better</option>
          <option value="moderate">Moderate rehab or better</option>
          <option value="heavy">Heavy rehab — any condition</option>
        </select>
        <select value={closingTimeline} onChange={(e) => setClosingTimeline(e.target.value)}>
          <option value="">Closing timeline: no preference</option>
          {CLOSING_TIMELINE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publish my buy box (wholesalers can match me)
        </label>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} /> Email me when a deal matches (published boxes only)
        </label>
      </div>
      <div style={{ fontSize: 13, marginTop: 8 }}>
        <div>Condition preferences:</div>
        {CONDITION_OPTIONS.map((c) => (
          <label key={c} style={{ marginRight: 10 }}>
            <input type="checkbox" checked={condPrefs.includes(c)} onChange={() => togglePref(condPrefs, setCondPrefs, c)} /> {c}
          </label>
        ))}
        <div style={{ marginTop: 6 }}>Strategy preferences:</div>
        {STRATEGY_OPTIONS.map((s) => (
          <label key={s} style={{ marginRight: 10 }}>
            <input type="checkbox" checked={stratPrefs.includes(s)} onChange={() => togglePref(stratPrefs, setStratPrefs, s)} /> {s}
          </label>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={saveBox}>Save buy box</button>
      </div>
      <MatchingDeals userId={userId} />
      <h4>Deal feed — active public listings</h4>
      {feed.length === 0 ? (
        <p style={{ fontSize: 13 }}>No active public listings yet. When a wholesaler activates a listing, it appears here.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {feed.map((l) => {
            const mine = box ? listingMatchesBox(l, box) : false;
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
        Match = your price range plus a plain text match of your markets/states against the property address.
        This is the same buy box the Cash Buyers directory and deal matching use — one box per account.
      </p>
    </div>
  );
}

function BuyerRecordLine({ buyerUser }: { buyerUser: string }) {
  const [rec, setRec] = useState<BuyerRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let on = true;
    loadBuyerRecord(buyerUser).then((r) => { if (on) { setRec(r); setLoaded(true); } }).catch(() => { if (on) setLoaded(true); });
    return () => { on = false; };
  }, [buyerUser]);
  if (!loaded) return <><br /><span style={{ color: '#94a3b8' }}>Buyer record: loading…</span></>;
  if (!rec) return <><br /><span style={{ color: '#94a3b8' }}>Buyer record: not available.</span></>;
  return (
    <>
      <br />
      <span style={{ color: '#a5b4fc' }}>
        Earned tier: {buyerTier(rec).label} · Buyer record: {rec.accepted_deals === 0
          ? 'no platform deals yet — no closing history'
          : `${rec.bc_signed} B–C signed · ${rec.closed_deals} closed · ${rec.fell_through} fell through (of ${rec.accepted_deals} accepted)`}
        {' · '}Proof of funds: {rec.pof_status === 'self_reported'
          ? `self-reported${rec.pof_note ? ` — ${rec.pof_note}` : ''} (ask for the letter before you rely on it)`
          : 'not provided'}
      </span>
    </>
  );
}

function BuyerRecordCard({ userId }: { userId: string }) {
  const [rec, setRec] = useState<BuyerRecord | null>(null);
  const [has, setHas] = useState(false);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const refresh = () => {
    loadBuyerRecord(userId).then(setRec).catch(() => {});
    loadMyProofOfFunds(userId).then((p) => { setHas(p.status === 'self_reported'); setNote(p.note); }).catch(() => {});
  };
  useEffect(refresh, [userId]);
  return (
    <div style={{ background: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 12 }}>
      <h4 style={{ marginTop: 0 }}>Your buyer record — earned here, shown to wholesalers at offer time</h4>
      <p style={{ fontSize: 13 }}>
        {rec == null
          ? 'Your record is not available yet.'
          : rec.accepted_deals === 0
            ? 'No platform deals yet. When a wholesaler accepts your offer, you sign the B–C, and the escrow closes, it counts here — automatically. Nothing is self-entered.'
            : `${rec.bc_signed} B–C signed · ${rec.closed_deals} closed · ${rec.fell_through} fell through, out of ${rec.accepted_deals} accepted offers.`}
      </p>
      <label style={{ fontSize: 13 }}>
        <input type="checkbox" checked={has} onChange={(e) => setHas(e.target.checked)} />{' '}
        I have proof of funds available
      </label>{' '}
      <input placeholder="Where — e.g. Chase letter dated Oct 2026" value={note} onChange={(e) => setNote(e.target.value)} style={{ minWidth: 260 }} />{' '}
      <button onClick={async () => { try { await setMyProofOfFunds(userId, has ? 'self_reported' : 'none', note); setMsg('Saved. Wholesalers see this as self-reported — expect them to ask for the letter.'); refresh(); } catch { setMsg('Save failed — try again.'); } }}>Save</button>
      {msg && <p style={{ fontSize: 12 }}>{msg}</p>}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>Proof of funds is your own attestation — the platform does not verify bank documents. Your closing record, by contrast, is counted from signed deals and escrow outcomes.</p>
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
      <h3>Property Owner Portal</h3>
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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSharedId(new URLSearchParams(window.location.search).get('deal'));
    }
    loadFeed().then(setFeed).catch(() => setFeed([]));
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)).catch(() => setSignedIn(false));
    } else {
      setSignedIn(false);
    }
  }, []);
  const ordered = feed ? [...feed].sort((a, b) => (a.id === sharedId ? -1 : b.id === sharedId ? 1 : 0)) : null;
  const shared = ordered && sharedId ? ordered.find((l) => l.id === sharedId) || null : null;
  const joinAsBuyer = () => {
    try { localStorage.setItem('ws_pending_role', 'buyer'); } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Public Deals</h2>
      <p style={{ fontSize: 13 }}>
        <strong>Disclosure:</strong> listings here are assignments of equitable interest — a buyer is
        purchasing the wholesaler's contract rights, not the property itself. Verify all figures
        with the wholesaler and the title company before sending any funds.
      </p>
      {shared && (
        <div style={{ background: '#0f172a', border: '1px solid #34d399', padding: 14, borderRadius: 10, marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>👀 You&rsquo;re looking at a shared deal</strong>
          <p style={{ fontSize: 14, margin: '6px 0' }}>
            <strong>{shared.deals?.documents?.property_address || 'Address in deal file'}</strong>
            {shared.deals?.documents?.city ? ` — ${shared.deals.documents.city}, ${shared.deals.documents.state || ''}` : ''}
            {' · '}total cost to the buyer {money(Number(shared.total_marketplace_cost))}
            {shared.deals?.status ? ` · status: ${shared.deals.status}` : ''}
          </p>
          <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '4px 0' }}>
            Total cost is the buyer&rsquo;s all-in figure for the contract rights. The disclosure above applies:
            verify every figure with the wholesaler and the title company before sending any funds.
          </p>
          {signedIn === false && (
            <>
              <p style={{ fontSize: 13.5, margin: '8px 0 4px' }}>
                <strong>Buying?</strong> A free buyer account lets you make offers, save your buy boxes, and get
                matched to deals like this one.{' '}
                <button onClick={joinAsBuyer}>I&rsquo;m a buyer — create my free account</button>
              </p>
              <p style={{ fontSize: 13.5, margin: '4px 0 0' }}>
                <strong>Selling a house of your own?</strong> Use your wholesaler&rsquo;s seller link — or talk to
                the platform&rsquo;s operator, The Feet Washers, Inc., at 772-971-6129. No fee to talk.
              </p>
            </>
          )}
        </div>
      )}
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
              {' '}<button onClick={async () => {
                const url = `${window.location.origin}/?deal=${l.id}`;
                const text = `🏠 ${l.deals?.documents?.property_address || 'Property'}${l.deals?.documents?.city ? `, ${l.deals.documents.city}, ${l.deals.documents.state || ''}` : ''} — total cost ${money(Number(l.total_marketplace_cost))}. Assignment of equitable interest (contract rights, not the property itself) via WholesalingOS: ${url}`;
                try { await navigator.clipboard.writeText(text); setCopied(l.id + '-text'); } catch { setCopied(''); }
              }}>Copy share text</button>
              {copied === l.id ? ' Link copied.' : copied === l.id + '-text' ? ' Share text copied.' : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
