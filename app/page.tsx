'use client';

import { useEffect, useState } from 'react';
import DealAnalyzer from '../components/DealAnalyzer';
import AuthPanel from '../components/AuthPanel';
import Leads from '../components/Leads';
import TodayCenter from '../components/TodayCenter';
import Contracts from '../components/Contracts';
import Viewings from '../components/Viewings';
import Escrow from '../components/Escrow';
import Buyers from '../components/Buyers';
import Titles from '../components/Titles';
import Counties from '../components/Counties';
import WatchlistProbate from '../components/WatchlistProbate';
import BusinessPL from '../components/BusinessPL';
import { supabaseConfigured } from '../lib/supabase';
import { loadLeads, type Lead } from '../lib/leads';
import SubscribeButton from '../components/SubscribeButton';
import PortalHome, { PublicDealsSection } from '../components/PortalHome';
import Outreach from '../components/Outreach';
import CommsCenter from '../components/CommsCenter';
import StaleDollars from '../components/StaleDollars';
import MoneyScoreboard from '../components/MoneyScoreboard';
import AdminConsole from '../components/AdminConsole';
import SellerPageSettingsCard from '../components/SellerPageSettings';
import AssistantPanel from '../components/AssistantPanel';
import AddFromLink from '../components/AddFromLink';
import ImportInbox from '../components/ImportInbox';
import WebhookPanel from '../components/WebhookPanel';
import Sidebar from '../components/Sidebar';
import { getProfileAccess, hasAccess, type ProfileAccess } from '../lib/access';
import { loadMyProfile } from '../lib/portals';

const STAGES = ['Find', 'Qualify', 'Contract', 'Market', 'Show', 'Close', 'Track'];

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [view, setView] = useState('dashboard');
  const [leadsNonce, setLeadsNonce] = useState(0);
  const [access, setAccess] = useState<ProfileAccess | null>(null);
  useEffect(() => { if (userId) { getProfileAccess(userId).then(setAccess).catch(() => {}); } }, [userId]);
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { if (userId) { loadMyProfile(userId).then((p) => setRole(p?.role ?? null)).catch(() => {}); } }, [userId]);
  // Slice 25: the Today view reads the page-level lead list. The Leads
  // component also reports its list up (onLeads) when it mounts; this
  // direct load keeps Today correct even before the Leads view opens.
  useEffect(() => {
    if (userId) { loadLeads(userId).then((rows) => { if (rows) setLeads(rows); }).catch(() => {}); }
  }, [userId]);

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
      <p className="ws-buildtag">WholesalingOS — Production Build, Slice 31</p>
      {!userId && (
        <div className="ws-hero">
          <h1>Your whole wholesaling business. One office.</h1>
          <p>
            WholesalingOS runs your pipeline from the first lead to the funded closing —
            leads, deal analysis, contracts, signing, escrow, and payouts — with private
            portals for your cash buyers, your sellers, and your title company.
          </p>
          <div className="ws-chips">
            <span className="ws-chip">90 days free</span>
            <span className="ws-chip">Then $150/mo</span>
            <span className="ws-chip">No other platform fee</span>
          </div>
          <ul>
            <li>Your company office is sealed: your leads and buyer list are yours alone — not even the platform owner can see them.</li>
            <li>Sellers see their price only. Your assignment fee stays yours.</li>
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

      <div id="signin" style={{ marginTop: 16 }}>
        <AuthPanel onUser={(id, email) => { setUserId(id); setUserEmail(email); }} />
      </div>
      {userId && <div style={{ marginTop: 16, maxWidth: 520 }}><SubscribeButton userId={userId} hasAccess={hasAccess(access)} /></div>}
      {locked ? (
        <section style={{ background: '#450a0a', padding: 16, borderRadius: 12, marginTop: 16 }}>
          <h2>Your office is locked</h2>
          <p style={{ fontSize: 14 }}>
            {suspended
              ? 'Your account has been suspended by the platform owner. Your leads, deals, and records are saved — contact thefeetwashers@gmail.com if you believe this is a mistake.'
              : 'Your free trial or subscription is not active, so your office is locked. Subscribe above to reopen it — your leads, deals, and records are saved.'}
          </p>
        </section>
      ) : userId ? (
        <div className="ws-shell">
          <Sidebar view={view} onView={setView} showAdmin={userEmail === OWNER_EMAIL} />
          <div className="ws-view">
            {view === 'dashboard' && (
              <>
                <div id="dashboard"><PortalHome userId={userId} /></div>
                {role === 'wholesaler' && userId && <SellerPageSettingsCard userId={userId} />}
                <PublicDealsSection />
                <h2 style={{ marginTop: 24 }}>Pipeline</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {STAGES.map((s) => (
                    <span key={s} style={{ background: '#1e293b', padding: '8px 12px', borderRadius: 999 }}>{s}</span>
                  ))}
                </div>
              </>
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
                <ImportInbox userId={userId} onAdded={() => setLeadsNonce((n) => n + 1)} />
                <WebhookPanel userId={userId} onAdded={() => setLeadsNonce((n) => n + 1)} />
                <div id="leads"><Leads key={leadsNonce} userId={userId} onLeads={setLeads} /></div>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 16 }}>
                  No fake leads, buyers, or deals are seeded here. Empty states are
                  honest empty states until you enter your own data. Your buyer list
                  and leads are yours only — Row Level Security in schema.sql blocks
                  other users from reading them.
                </p>
                <StaleDollars userId={userId} />
                <WatchlistProbate />
                <DealAnalyzer />
              </>
            )}
            {view === 'comms' && (
              <>
                <div id="comms"><CommsCenter userId={userId} /></div>
                <div id="outreach"><Outreach userId={userId} /></div>
              </>
            )}
            {view === 'contracts' && (
              <>
                <div id="contracts"><Contracts userId={userId} /></div>
                <Viewings userId={userId} />
                <div id="escrow"><Escrow userId={userId} /></div>
              </>
            )}
            {view === 'buyers' && (
              <div id="buyers"><Buyers userId={userId} /></div>
            )}
            {view === 'money' && (
              <>
                <div id="money"><MoneyScoreboard userId={userId} /></div>
                <BusinessPL />
              </>
            )}
            {view === 'records' && (
              <>
                <Titles userId={userId} />
                <Counties userId={userId} />
              </>
            )}
            {view === 'admin' && (
              <AdminConsole userId={userId} userEmail={userEmail} />
            )}
          </div>
        </div>
      ) : null}
      {!userId && (
        <div style={{ marginTop: 16 }}>
          <PublicDealsSection />
        </div>
      )}
    </div>
  );
}
