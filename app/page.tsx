'use client';

import { useEffect, useState } from 'react';
import DealAnalyzer from '../components/DealAnalyzer';
import RepairEstimator from '../components/RepairEstimator';
import RentalAnalyzer from '../components/RentalAnalyzer';
import AuthPanel from '../components/AuthPanel';
import Leads from '../components/Leads';
import TodayCenter from '../components/TodayCenter';
import Contracts from '../components/Contracts';
import Viewings from '../components/Viewings';
import Escrow from '../components/Escrow';
import Buyers from '../components/Buyers';
import VendorDirectory from '../components/VendorDirectory';
import Titles from '../components/Titles';
import Counties from '../components/Counties';
import AuctionDirectory from '../components/AuctionDirectory';
import DashboardBand from '../components/DashboardBand';
import CommandCenter from '../components/CommandCenter';
import Sprint from '../components/Sprint';
import DealRadar from '../components/DealRadar';
import AuctionFeed from '../components/AuctionFeed';
import Landing, { LandingFooter } from '../components/Landing';
import DistressRadar from '../components/DistressRadar';
import MarketBoard from '../components/MarketBoard';
import ListPlaybooks from '../components/ListPlaybooks';
import DeadlineRadar from '../components/DeadlineRadar';
import SpeedToLead from '../components/SpeedToLead';
import ReferralEngine from '../components/ReferralEngine';
import OwnerDealDesk from '../components/OwnerDealDesk';
import ValueReceipt from '../components/ValueReceipt';
import SealedOffice from '../components/SealedOffice';
import ClosingCalendar from '../components/ClosingCalendar';
import StaleMoneyBoard from '../components/StaleMoneyBoard';
import CampaignTracker from '../components/CampaignTracker';
import MarketWatch from '../components/MarketWatch';
import WeeklyReport from '../components/WeeklyReport';
import MyStatesCard from '../components/MyStatesCard';
import KanbanBoard from '../components/KanbanBoard';
import FieldCapture from '../components/FieldCapture';
import RouteBoard from '../components/RouteBoard';
import Paperwork from '../components/Paperwork';
import TaxExport from '../components/TaxExport';
import GlobalSearch from '../components/GlobalSearch';
import DeadLeadWatch from '../components/DeadLeadWatch';
import TitlePacket from '../components/TitlePacket';
import ListingsManager from '../components/ListingsManager';
import WatchlistProbate from '../components/WatchlistProbate';
import BusinessPL from '../components/BusinessPL';
import { supabaseConfigured } from '../lib/supabase';
import { loadLeads, type Lead } from '../lib/leads';
import SubscribeButton from '../components/SubscribeButton';
import PortalHome, { PublicDealsSection } from '../components/PortalHome';
import JVDealRoom from '../components/JVDealRoom';
import Outreach from '../components/Outreach';
import CommsCenter from '../components/CommsCenter';
import StaleDollars from '../components/StaleDollars';
import MoneyScoreboard from '../components/MoneyScoreboard';
import AdminConsole from '../components/AdminConsole';
import PlatformHealth from '../components/PlatformHealth';
import ProbateLeads from '../components/ProbateLeads';
import WholesaleContractGenerator, { type ContractPrefill } from '../components/WholesaleContractGenerator';
import CashBuyersDealBlast from '../components/CashBuyersDealBlast';
import JVCoWholesalingCalculator from '../components/JVCoWholesalingCalculator';
import AdminSaaSDashboard from '../components/AdminSaaSDashboard';
import OperatorStats from '../components/OperatorStats';
import RealtorPocketListings from '../components/RealtorPocketListings';
import ReportProblemModal from '../components/ReportProblemModal';
import SubscriptionBanner from '../components/SubscriptionBanner';
import MyProviders from '../components/MyProviders';
import SellerPageSettingsCard from '../components/SellerPageSettings';
import StorefrontSettingsCard from '../components/StorefrontSettings';
import SignKit from '../components/SignKit';
import AssistantPanel from '../components/AssistantPanel';
import AddFromLink from '../components/AddFromLink';
import ImportInbox from '../components/ImportInbox';
import WebhookPanel from '../components/WebhookPanel';
import ListingParser from '../components/ListingParser';
import Sidebar from '../components/Sidebar';
import { fetchMarketplaceCounts } from '../lib/marketplace-stats';
import { fetchMyPublishedDealById } from '../lib/published-deals';
import { CONTRACT_PREFILL_HANDOFF_KEY } from '../lib/deal-offers';
import { getProfileAccess, hasAccess, type ProfileAccess } from '../lib/access';
import { loadMyProfile } from '../lib/portals';

const STAGES = ['Find', 'Qualify', 'Contract', 'Market', 'Show', 'Close', 'Track'];

// Slice 132 — Marketplace stats strip. Real counts only, from
// lib/marketplace-stats.ts (published deals + published buyers).
// A 0 is honest: nothing published yet (or the Slice 132 tables
// are not there yet) — never OBL's numbers, never estimated.
// Used on the dashboard home and on the public landing page.
function MarketplaceStatsStrip() {
  const [counts, setCounts] = useState<{ publishedDeals: number; publishedBuyers: number } | null>(null);
  useEffect(() => {
    let on = true;
    fetchMarketplaceCounts()
      .then((c) => { if (on) setCounts(c); })
      .catch(() => { if (on) setCounts({ publishedDeals: 0, publishedBuyers: 0 }); });
    return () => { on = false; };
  }, []);
  return (
    <section style={{ background: '#0f172a', border: '1px solid rgba(110,231,183,0.35)', borderRadius: 12, padding: '14px 16px', marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6ee7b7' }}>Marketplace</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 8 }}>
        <div><strong style={{ fontSize: 22 }}>{counts ? counts.publishedDeals : '…'}</strong><br /><span style={{ fontSize: 13, color: '#94a3b8' }}>Off-market deals published</span></div>
        <div><strong style={{ fontSize: 22 }}>{counts ? counts.publishedBuyers : '…'}</strong><br /><span style={{ fontSize: 13, color: '#94a3b8' }}>Cash buyers published</span></div>
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 0' }}>Counted from published marketplace rows. A 0 means nothing published yet — nothing here is estimated.</p>
    </section>
  );
}

// Slice 132 — Part 7: marketplace sections for the public landing
// page. OBL's STRUCTURE only (hero, how-it-works, trust & safety,
// difference table, FAQ, real stats) with OUR words — nothing
// copied from OBL, no OBL numbers, listings, buyers, or prices.
// Every claim below is a feature that exists in the signed-in
// product today; the stats are real published rows only.
const MKT_PANEL: React.CSSProperties = { background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 14, padding: '16px 18px' };
const MKT_H2: React.CSSProperties = { fontSize: 22, margin: '28px 0 6px' };
const MKT_SUB: React.CSSProperties = { fontSize: 14, color: '#94a3b8', margin: '0 0 14px', maxWidth: 760 };

function MarketplaceLanding() {
  const [mode, setMode] = useState<'buyer' | 'owner'>('buyer');
  const steps = mode === 'buyer'
    ? [
        { n: '1', title: 'Publish your buy box', body: 'Tell the marketplace what you buy: the markets, the property types, and the price range. Your buy box is how deals find you — and confirming it keeps it live.' },
        { n: '2', title: 'Find matching deals', body: 'Browse off-market deals and see the ones that match your buy box first. Every listing states plainly that it is an assignment of contract rights, not the property itself.' },
        { n: '3', title: 'Connect when there is interest', body: 'Make an offer on a deal you like. The wholesaler sees it in their offers inbox and replies there — accept, counter, or decline.' },
      ]
    : [
        { n: '1', title: 'Find matching buyers', body: 'See published buy boxes: the markets, property types, and price ranges buyers are actually looking for — criteria, not a cold list of names.' },
        { n: '2', title: 'Share the property', body: 'Share it once: what it is, where it is, and what you are asking. One share is matched against every published buy box.' },
        { n: '3', title: 'Connect when there is interest', body: 'When a buyer matches, you connect through the platform. Only what you chose to publish is shown.' },
      ];
  const toggleBtn = (m: 'buyer' | 'owner', label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      style={{
        background: mode === m ? '#059669' : 'transparent',
        color: mode === m ? '#fff' : '#cbd5e1',
        border: mode === m ? '1px solid #059669' : '1px solid rgba(148,163,184,0.4)',
        borderRadius: 999, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  const cell: React.CSSProperties = { textAlign: 'left', verticalAlign: 'top', padding: '10px 12px', fontSize: 13.5, lineHeight: 1.55, borderBottom: '1px solid rgba(148,163,184,0.2)' };
  return (
    <div>
      <section style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0b2e26 55%, #0b1220 100%)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 14, padding: '22px 20px', marginTop: 18 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 24, color: '#fff' }}>Off-market deals, meet the buyers looking for them.</h2>
        <p style={{ fontSize: 15, color: '#cbd5e1', maxWidth: 720, margin: '0 0 14px' }}>
          WholesalingOS puts the two sides of an off-market deal in one place: buyers publish what they buy,
          property owners and wholesalers share what they have, and the match happens on criteria — not on
          a stale list of names. Free for buyers and property owners.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a href="/deals" style={{ background: '#059669', color: '#fff', borderRadius: 10, padding: '11px 16px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>Browse off-market deals</a>
          <a href="/buyers" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(148,163,184,0.5)', borderRadius: 10, padding: '11px 16px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>See cash buyers</a>
          <a href="/join" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(148,163,184,0.5)', borderRadius: 10, padding: '11px 16px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>Join free</a>
        </div>
      </section>

      <MarketplaceStatsStrip />

      <h2 style={MKT_H2}>How it works</h2>
      <p style={MKT_SUB}>Three steps, whichever side of the deal you are on:</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {toggleBtn('buyer', 'I am a buyer')}
        {toggleBtn('owner', 'I have a property')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {steps.map((s) => (
          <div key={s.n} style={MKT_PANEL}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#6ee7b7' }}>STEP {s.n}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 4 }}>{s.title}</div>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>{s.body}</p>
          </div>
        ))}
      </div>

      <h2 style={MKT_H2}>Trust &amp; safety</h2>
      <p style={MKT_SUB}>No stars, no paid badges. What you can check here is what the platform itself counted or reviewed:</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <div style={MKT_PANEL}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🏆 Earned record</div>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>A buyer&apos;s standing comes from the closing record the platform holds — accepted offers, signed assignments, escrow outcomes. The tier rules read those counts only; buyers do not set their own tier.</p>
        </div>
        <div style={MKT_PANEL}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🚩 Report a problem</div>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>Signed in, anyone can flag a problem from the sidebar — a listing, a buyer, or anything that looks wrong. The report goes to the operator&apos;s desk inside the app.</p>
        </div>
        <div style={MKT_PANEL}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🛡️ Operator review</div>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>Every report is reviewed by the operator — not by an algorithm. There is no public review system yet, so a record here is counted closings, not stars.</p>
        </div>
      </div>

      <h2 style={MKT_H2}>The difference</h2>
      <p style={MKT_SUB}>A buyers list is a list of names. This is a marketplace that keeps the names honest:</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 14 }}>
          <thead>
            <tr>
              <th style={{ ...cell, color: '#fff', fontWeight: 800 }}>What matters</th>
              <th style={{ ...cell, color: '#fff', fontWeight: 800 }}>A plain buyers list</th>
              <th style={{ ...cell, color: '#6ee7b7', fontWeight: 800 }}>WholesalingOS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cell}><strong style={{ color: '#fff' }}>What a buyer wants</strong></td>
              <td style={cell}>Names and phone numbers, if that</td>
              <td style={cell}>A published buy box — markets, property types, price range — kept current by the buyer</td>
            </tr>
            <tr>
              <td style={cell}><strong style={{ color: '#fff' }}>Proof a buyer closes</strong></td>
              <td style={cell}>Their word for it</td>
              <td style={cell}>A tier drawn from the closing record the platform holds for that buyer</td>
            </tr>
            <tr>
              <td style={cell}><strong style={{ color: '#fff' }}>Whose eyes see it</strong></td>
              <td style={cell}>Whoever holds the list</td>
              <td style={cell}>Criteria only — buyer identities are never shown on the demand board</td>
            </tr>
            <tr>
              <td style={cell}><strong style={{ color: '#fff' }}>Cost to join as a buyer</strong></td>
              <td style={cell}>Varies — often a paid list</td>
              <td style={cell}>Free</td>
            </tr>
            <tr>
              <td style={cell}><strong style={{ color: '#fff' }}>Your leads and buyers</strong></td>
              <td style={cell}>On someone else&apos;s list</td>
              <td style={cell}>Sealed in your own office from every other wholesaler — the platform owner can open them for support, and never shares, sells, or contacts them</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 style={MKT_H2}>Marketplace questions, answered straight</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <div style={MKT_PANEL}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>Do buyers pay to join the marketplace?</div>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>No. Cash buyers register free, publish a buy box, and see matching deals. Only wholesalers pay — 90 days free, then $150 a month — and buyers, property owners, title companies, and lenders are free.</p>
        </div>
        <div style={MKT_PANEL}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>What does a published deal actually sell?</div>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>An assignment of contract rights, not the property itself. Every public listing carries that disclosure: verify all figures with the wholesaler and the title company before sending any funds.</p>
        </div>
        <div style={MKT_PANEL}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>Who sees my contact details?</div>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>Buyers are shown by their criteria, not their identity — the demand board lists what buyers want, never who they are. Share your own contact details only when you choose to.</p>
        </div>
        <div style={MKT_PANEL}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>How do I know a buyer is real?</div>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>You do not take their word for it: their tier comes from the closing record the platform holds for them, and their proof of funds is labelled self-reported until you see the letter.</p>
        </div>
        <div style={MKT_PANEL}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>How do I report a problem?</div>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>Sign in and use Report a problem in the sidebar. Your report goes to the operator&apos;s desk in the app for review.</p>
        </div>
      </div>

      <section style={{ background: '#052e16', border: '1px solid #166534', padding: 22, borderRadius: 12, marginTop: 28 }}>
        <h2 style={{ margin: '0 0 8px' }}>Start from your side of the deal.</h2>
        <p style={{ fontSize: 14.5, maxWidth: 720, margin: '0 0 14px' }}>
          Buyers publish what they buy. Property owners share what they have. Wholesalers work the match
          between them — in one office, with real records behind every number.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a href="/join" style={{ background: '#059669', color: '#fff', borderRadius: 10, padding: '11px 16px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>Join free</a>
          <a href="#signin" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(148,163,184,0.5)', borderRadius: 10, padding: '11px 16px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>Sign in</a>
          <a href="/deals" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(148,163,184,0.5)', borderRadius: 10, padding: '11px 16px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>Browse off-market deals</a>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [view, setView] = useState('dashboard');
  const [leadsNonce, setLeadsNonce] = useState(0);
  // Slice 128 — a Draft Contract button on a probate or inbound row
  // carries its prefill here and opens the Contracts view with the
  // generator filled in. Money in the prefill comes only from the
  // wholesaler's own entered offer_amount — never from MAO.
  const [contractPrefill, setContractPrefill] = useState<ContractPrefill | null>(null);
  const openContractDraft = (prefill: ContractPrefill) => {
    setContractPrefill(prefill);
    setView('contracts');
  };
  // Slice 133, item 5 — consume an accepted-offer assignment
  // handoff left by the deal detail page (/deals/[id]) in
  // localStorage. The deal page is a separate route from this
  // dashboard, which has no cross-page prefill channel, so the
  // handoff is the bridge — the same localStorage pattern the app
  // already uses for ws_pending_role and ws_prefill_lead. The key
  // is consumed (removed) on read so it opens once. Before opening
  // anything, the signed-in user must still own the deal the
  // handoff names — a tampered or stale value opens nothing. The
  // generator itself still blocks printing until the wholesaler
  // enters the assignment fee, seller name, and property address.
  useEffect(() => {
    if (!userId) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(CONTRACT_PREFILL_HANDOFF_KEY);
      if (!raw) return;
      localStorage.removeItem(CONTRACT_PREFILL_HANDOFF_KEY);
    } catch {
      return;
    }
    try {
      const h = JSON.parse(raw) as Record<string, unknown>;
      const price = typeof h.purchasePrice === 'number' ? h.purchasePrice : null;
      const dealId = typeof h.dealId === 'string' ? h.dealId : '';
      const offerId = typeof h.offerId === 'string' ? h.offerId : '';
      if (price == null || !Number.isFinite(price) || price <= 0 || !dealId || !offerId) return;
      fetchMyPublishedDealById(dealId)
        .then((deal) => {
          if (!deal || deal.user_id !== userId) return;
          const prefill: ContractPrefill = {
            doc: h.doc === 'assignment' ? 'assignment' : undefined,
            purchasePrice: price,
            closingDate: typeof h.closingDate === 'string' ? h.closingDate : undefined,
            assignmentEmdAmount: typeof h.assignmentEmdAmount === 'number' ? h.assignmentEmdAmount : null,
            endBuyerName: typeof h.endBuyerName === 'string' ? h.endBuyerName : undefined,
            endBuyerEntity: typeof h.endBuyerEntity === 'string' ? h.endBuyerEntity : undefined,
            city: typeof h.city === 'string' ? h.city : undefined,
            county: typeof h.county === 'string' ? h.county : undefined,
          };
          openContractDraft(prefill);
        })
        .catch(() => {});
    } catch {
      // A malformed handoff opens nothing.
    }
    // Runs when the signed-in user is known; openContractDraft is
    // a stable local setter pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const [access, setAccess] = useState<ProfileAccess | null>(null);
  // Slice 130 — Report a Problem modal. The button lives at the
  // foot of the sidebar; the report records the view open at the
  // time as its page context, and goes to the operator's desk in
  // the app (the app never emails).
  const [reportOpen, setReportOpen] = useState(false);
  useEffect(() => { if (userId) { getProfileAccess(userId).then(setAccess).catch(() => {}); } }, [userId]);
  const [role, setRole] = useState<string | null>(null);
  const [authKey, setAuthKey] = useState(0);
  const pickRole = (r: string) => {
    try { localStorage.setItem('ws_pending_role', r); } catch { /* ignore */ }
    setAuthKey((k) => k + 1);
    if (typeof document !== 'undefined') {
      const el = document.getElementById('signin');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  useEffect(() => { if (userId) { loadMyProfile(userId).then((p) => setRole(p?.role ?? null)).catch(() => {}); } }, [userId]);
  // Slice 25: the Today view reads the page-level lead list. The Leads
  // component also reports its list up (onLeads) when it mounts; this
  // direct load keeps Today correct even before the Leads view opens.
  useEffect(() => {
    if (userId) { loadLeads(userId).then((rows) => { if (rows) setLeads(rows); }).catch(() => {}); }
  }, [userId]);

  // Slice 103: first-touch subscriber-referral capture. A ?ref=<slug>
  // on ANY page load is stashed once; AuthPanel resolves it at signup.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref && !localStorage.getItem('ws_ref')) localStorage.setItem('ws_ref', ref);
    } catch { /* no storage, no attribution — nothing depends on it */ }
  }, []);

  // Slice 18 access lock. Suspension locks every role; a lapsed trial or
  // subscription locks wholesalers only (buyers, sellers, and title
  // companies never pay, so their portals never lock for billing). The
  // owner account is exempt, and nothing locks while the profile is
  // still loading. A locked user's data stays saved and RLS-protected.
  const OWNER_EMAIL = 'thefeetwashers@gmail.com';
  const suspended = !!access?.admin_suspended;
  const locked = !!userId && userEmail !== OWNER_EMAIL && access !== null &&
    (suspended || (role === 'wholesaler' && !hasAccess(access)));

  return (
    <div>
      <p className="ws-buildtag">WholesalingOS — Production Build, Slice 141</p>
      {/* Slice 132, Part 5 — landing nav. Join goes to /join; Sign in
          goes to #signin, exactly the way the app already reaches
          sign-in (the AuthPanel lives in the #signin block below,
          and the footer already links there). No auth rebuilt. */}
      {!userId && (
        <nav aria-label="Marketplace" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <a href="/" style={{ fontWeight: 800, fontSize: 16, color: '#fff', textDecoration: 'none' }}>WholesalingOS</a>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginLeft: 'auto', fontSize: 14 }}>
            <a href="/deals" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Off-Market Deals</a>
            <a href="/buyers" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Cash Buyers</a>
            <a href="/distressed-finder" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Distressed Finder</a>
            <a href="/parcel-enricher" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Parcel Enricher</a>
            <a href="/agents" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Agents</a>
            <a href="/api-docs" style={{ color: '#cbd5e1', textDecoration: 'none' }}>API Docs</a>
            <a href="/join" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Join</a>
            <a href="#signin" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Sign in</a>
          </span>
        </nav>
      )}
      {!userId && (
        <div className="ws-hero">
          <h1>Your whole wholesaling business. One office.</h1>
          <p>
            WholesalingOS runs your pipeline from the first lead to the funded closing —
            leads, deal analysis, contracts, signature-status tracking, escrow, and payouts — with private
            portals for your cash buyers, your sellers, and your title company.
          </p>
          <div className="ws-chips">
            <span className="ws-chip">90 days free</span>
            <span className="ws-chip">Then $150/mo</span>
            <span className="ws-chip">No other platform fee</span>
          </div>
          <ul>
            <li>Your company office is sealed from every other wholesaler: your leads and buyer list are yours alone — the platform owner can see them for support and oversight, and never shares, sells, or contacts them.</li>
            <li>Property owners see their price only. Your assignment fee stays yours.</li>
            <li>One pipeline, one deal record: Find → Qualify → Contract → Market → Show → Close → Track.</li>
          </ul>
        </div>
      )}

      <section style={{ background: supabaseConfigured ? '#052e16' : '#422006', padding: '10px 16px', borderRadius: 12 }}>
        <strong style={{ fontSize: 13.5 }}>
          {supabaseConfigured
            ? '● Your office is connected — everything syncs securely to your account.'
            : '● Local-only mode — sign-in and sync are not configured on this deployment yet.'}
        </strong>
      </section>

      {!userId && <Landing onPickRole={pickRole} userId={userId} onOpenJvRoom={() => setView('jvboard')} />}
      {/* Slice 132, Part 7 — marketplace landing sections (hero, real
          stats, how-it-works, trust & safety, difference table, FAQ).
          The existing landing content above is kept as-is. */}
      {!userId && <MarketplaceLanding />}
      <div id="signin" style={{ marginTop: 16 }}>
        <AuthPanel key={authKey} onUser={(id, email) => { setUserId(id); setUserEmail(email); }} />
      </div>
      {userId && <div style={{ marginTop: 16, maxWidth: 520 }}><SubscribeButton userId={userId} hasAccess={hasAccess(access)} /></div>}
      {locked ? (
        <>
        <section style={{ background: '#450a0a', padding: 16, borderRadius: 12, marginTop: 16 }}>
          <h2>Your office is locked</h2>
          <p style={{ fontSize: 14 }}>
            {suspended
              ? 'Your account has been suspended by the platform owner. Your leads, deals, and records are saved — contact thefeetwashers@gmail.com if you believe this is a mistake.'
              : 'Your free trial or subscription is not active, so your office is locked. Subscribe above to reopen it — your leads, deals, and records are saved.'}
          </p>
        </section>
        {!suspended && userId && <SealedOffice userId={userId} access={access} />}
        </>
      ) : userId ? (
        <div className="ws-shell">
          <Sidebar view={view} onView={setView} showAdmin={userEmail === OWNER_EMAIL} onReportProblem={() => setReportOpen(true)} />
          {reportOpen && userId && (
            <ReportProblemModal userId={userId} pageContext={view} onClose={() => setReportOpen(false)} />
          )}
          <div className="ws-view">
            <GlobalSearch userId={userId} onNavigate={setView} onDraftContract={openContractDraft} />
            {view === 'dashboard' && (
              <>
                {/* Slice 132, Part 6 — dashboard refresh: a header band
                    + the Marketplace quick links and the real-data
                    stats strip. Everything below is unchanged: every
                    existing view, role gate, and data flow still runs
                    in the same order. */}
                <section style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0b2e26 55%, #0b1220 100%)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 14, padding: '18px 20px' }}>
                  <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Your dashboard</h2>
                  <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: 0, maxWidth: 720 }}>Your office at a glance — your portal below, your pipeline, and the marketplace in one place.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    <a href="/deals" style={{ background: '#059669', color: '#fff', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>🏠 Off-Market Deals</a>
                    <a href="/buyers" style={{ background: 'rgba(148,163,184,0.12)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>💵 Cash Buyers</a>
                    <a href="/distressed-finder" style={{ background: 'rgba(148,163,184,0.12)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>🚨 Distressed Finder</a>
                    <a href="/parcel-enricher" style={{ background: 'rgba(148,163,184,0.12)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>📦 Parcel Enricher</a>
                    <a href="/agents" style={{ background: 'rgba(148,163,184,0.12)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>🤝 Agents</a>
                    <a href="/api-docs" style={{ background: 'rgba(148,163,184,0.12)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>🔌 API Docs</a>
                    <button type="button" onClick={() => setView('cashbuyers')} style={{ background: 'rgba(148,163,184,0.12)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>🤝 Buyer Networks</button>
                    <a href="/managed-dispo" style={{ background: 'rgba(148,163,184,0.12)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>📣 Managed Dispo</a>
                  </div>
                </section>
                <MarketplaceStatsStrip />
                {/* Slice 129 — the subscription banner: trial countdown
                    + Activate Plan, or Pro Active + Manage Billing.
                    It hides itself when the table does not exist
                    yet (migration 20261115170000 not applied). */}
                {userId && <SubscriptionBanner userId={userId} />}
                {/* Slice 137, Part B — My Providers (BYOK keys for the
                    AI Deal Copilot), next to the billing banner. */}
                {userId && <MyProviders userId={userId} />}
                {role === 'wholesaler' && userId && <CommandCenter userId={userId} onNavigate={setView} />}
                {role === 'wholesaler' && userId && <Sprint userId={userId} onNavigate={setView} />}
                {role === 'wholesaler' && userId && <DealRadar onNavigate={setView} />}
                {role === 'wholesaler' && userId && <AuctionFeed onNavigate={setView} />}
                {role === 'wholesaler' && userId && <DistressRadar userId={userId} onNavigate={setView} />}
                {role === 'wholesaler' && userId && <MarketBoard userId={userId} onNavigate={setView} />}
                {role === 'wholesaler' && userId && <DashboardBand userId={userId} />}
                {role === 'wholesaler' && userId && <DeadlineRadar userId={userId} />}
                {role === 'wholesaler' && userId && <SpeedToLead userId={userId} onNavigate={setView} />}
                {role === 'wholesaler' && userId && <ValueReceipt userId={userId} />}
                {role === 'wholesaler' && userId && <ClosingCalendar userId={userId} />}
                {role === 'wholesaler' && userId && <StaleMoneyBoard userId={userId} />}
                {role === 'wholesaler' && userId && <CampaignTracker userId={userId} />}
                {role === 'wholesaler' && userId && <MarketWatch userId={userId} />}
                {role === 'wholesaler' && userId && <WeeklyReport userId={userId} />}
                <div id="dashboard"><PortalHome userId={userId} /></div>
                {role === 'wholesaler' && userId && <SellerPageSettingsCard userId={userId} />}
                {role === 'wholesaler' && userId && <StorefrontSettingsCard userId={userId} />}
                {role === 'wholesaler' && userId && <MyStatesCard userId={userId} />}
                {role === 'wholesaler' && userId && <SignKit userId={userId} />}
                <PublicDealsSection />
                <h2 style={{ marginTop: 24 }}>Pipeline</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {STAGES.map((s) => (
                    <span key={s} style={{ background: '#1e293b', padding: '8px 12px', borderRadius: 999 }}>{s}</span>
                  ))}
                </div>
              </>
            )}
            {view === 'listings' && (
              <div id="listings"><ListingsManager userId={userId} /></div>
            )}
            {view === 'sellerpage' && (
              <>
                {role === 'wholesaler' && userId && <SellerPageSettingsCard userId={userId} />}
                {role === 'wholesaler' && userId && <StorefrontSettingsCard userId={userId} />}
                {role === 'wholesaler' && userId && <SignKit userId={userId} />}
                {role !== 'wholesaler' && <p style={{ fontSize: 14 }}>The property owner page belongs to wholesaler accounts.</p>}
              </>
            )}
            {view === 'titles' && (
              <Titles userId={userId} />
            )}
            {view === 'today' && (
              <div id="today"><TodayCenter leads={leads} /></div>
            )}
            {view === 'assistant' && (
              <AssistantPanel userId={userId} />
            )}
            {view === 'leads' && (
              <>
                <AddFromLink userId={userId} onAdded={() => setLeadsNonce((n) => n + 1)} />
                <ListingParser userId={userId} onAdded={() => setLeadsNonce((n) => n + 1)} />
                <ImportInbox userId={userId} onAdded={() => setLeadsNonce((n) => n + 1)} />
                <WebhookPanel userId={userId} onAdded={() => setLeadsNonce((n) => n + 1)} />
                <div id="leads"><Leads key={leadsNonce} userId={userId} userEmail={userEmail} onLeads={setLeads} onDraftContract={openContractDraft} /></div>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 16 }}>
                  No fake leads, buyers, or deals are seeded here. Empty states are
                  honest empty states until you enter your own data. Your buyer list
                  and leads are yours only — Row Level Security in schema.sql blocks
                  other users from reading them.
                </p>
                <StaleDollars userId={userId} />
                <WatchlistProbate />
                <DeadLeadWatch userId={userId} />
                <RepairEstimator />
                <DealAnalyzer userId={userId} />
                <RentalAnalyzer userId={userId} />
              </>
            )}
            {view === 'probate' && (
              <div id="probate"><ProbateLeads userId={userId} onDraftContract={openContractDraft} /></div>
            )}
            {view === 'board' && (
              <div id="board"><KanbanBoard userId={userId} /></div>
            )}
            {view === 'field' && userId && (
              <><div id="field"><FieldCapture userId={userId} /></div><RouteBoard userId={userId} /></>
            )}
            {view === 'comms' && (
              <>
                <div id="comms"><CommsCenter userId={userId} /></div>
                <div id="outreach"><Outreach userId={userId} /></div>
              </>
            )}
            {view === 'contracts' && (
              <>
                {userId && (
                  <div id="contract-generator"><WholesaleContractGenerator userId={userId} prefill={contractPrefill} /></div>
                )}
                <div id="contracts"><Contracts userId={userId} userEmail={userEmail} /></div>
                <Paperwork userId={userId} />
                <Viewings userId={userId} />
                <div id="escrow"><Escrow userId={userId} /></div>
                <TitlePacket userId={userId} />
              </>
            )}
            {view === 'buyers' && (
              <div id="buyers"><Buyers userId={userId} userEmail={userEmail} /></div>
            )}
            {view === 'cashbuyers' && userId && (
              <div id="cashbuyers"><CashBuyersDealBlast userId={userId} /></div>
            )}
            {view === 'jvboard' && (
              <div id="jvboard"><JVDealRoom userId={userId} /></div>
            )}
            {view === 'jvcalc' && userId && (
              <div id="jvcalc"><JVCoWholesalingCalculator userId={userId} /></div>
            )}
            {view === 'directory' && (
              <div id="directory"><VendorDirectory userId={userId} /></div>
            )}
            {view === 'money' && (
              <>
                <div id="money"><MoneyScoreboard userId={userId} /></div>
                <BusinessPL />
                {role === 'wholesaler' && userId && <ReferralEngine userId={userId} />}
                {role === 'wholesaler' && userId && <TaxExport userId={userId} />}
              </>
            )}
            {view === 'records' && (
              <>
                <Titles userId={userId} />
                <Counties userId={userId} />
                <AuctionDirectory />
                <ListPlaybooks />
              </>
            )}
            {view === 'admin' && (
              <>
                <AdminConsole userId={userId} userEmail={userEmail} />
                <PlatformHealth userEmail={userEmail} />
                {userId && <OwnerDealDesk userId={userId} />}
              </>
            )}
            {view === 'saasadmin' && userEmail === OWNER_EMAIL && (
              <div id="saasadmin"><AdminSaaSDashboard /></div>
            )}
            {view === 'opstats' && userEmail === OWNER_EMAIL && (
              <div id="opstats"><OperatorStats userEmail={userEmail} />
                {userId && <RealtorPocketListings userId={userId} operatorEmail={userEmail} />}
              </div>
            )}
          </div>
        </div>
      ) : null}
      {!userId && (
        <div style={{ marginTop: 16 }}>
          <PublicDealsSection />
          <LandingFooter userId={userId} />
        </div>
      )}
    </div>
  );
}
