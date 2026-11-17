// Slice 132 — Part 3: join page (/join).
//
// Role picker cards in OpenBuyersList's structure but OUR words.
// Each card routes to the EXISTING signup with that role
// preselected — no signup change was needed: AuthPanel reads
// localStorage 'ws_pending_role' on mount (components/AuthPanel.tsx)
// and applies it to the new profile on first sign-in, and
// app/page.tsx's pickRole does the same stash + scrolls to #signin.
// This page does the same stash, then navigates to /#signin (a
// full navigation, so AuthPanel mounts fresh and reads the stash).
//
// Real estate agent maps to the existing stored role 'referrer'
// with clear labeling — adding a real 'agent' role was NOT done:
// it would need a role CHECK/enum change plus every role-gated
// code path (lib/portals.ts PORTAL_ROLES, AuthPanel's whitelist,
// PortalHome routing, the access lock in app/page.tsx), and that
// is not fully contained here. The stored value stays 'referrer'.
//
// "I'm multiple": the platform stores ONE role per account, so the
// card routes to signup with NO preselection and says plainly to
// pick a main role first and tell the operator if another role is
// needed. Multi-role is never promised.
// Stored role value 'seller' is untouched — only the display label
// "Property owner" is used here.
//
// Slice 133 — the role also reads from the URL query
// (?role=buyer), not only from localStorage, so a shared invite
// link pre-selects Buyer. One canonical link: /join?role=buyer.
// ?ref=<slug> (the inviter's public_slug) is stashed as
// 'ws_invite_ref' for later attribution — nothing reads it yet,
// and no attribution is claimed.

'use client';

import { useEffect, useState } from 'react';

// Query ?role= value -> card key + stored role. 'agent' maps to
// the stored 'referrer' role, same as the card. An unknown value
// reads as no preselection — never a guessed role.
const ROLE_FROM_QUERY: Record<string, { key: string; role: string }> = {
  buyer: { key: 'buyer', role: 'buyer' },
  wholesaler: { key: 'wholesaler', role: 'wholesaler' },
  agent: { key: 'agent', role: 'referrer' },
  referrer: { key: 'agent', role: 'referrer' },
  seller: { key: 'seller', role: 'seller' },
};

type JoinCard = {
  key: string;
  icon: string;
  title: string;
  body: string;
  note?: string;
  cta: string;
  // Stored role to preselect, or null for "I'm multiple" (no
  // preselection — the sign-in form's own default applies).
  role: string | null;
};

const CARDS: JoinCard[] = [
  {
    key: 'buyer',
    icon: '💵',
    title: 'Buyer',
    body: 'Set your buy box and see off-market deals that match when you check back in the app. Submit your own contact (private by default) + your buy box — matching deals appear in the app when you check back, never by email or text.',
    note: 'After you create your buyer account, complete the Cash Buyer VIP Portal — your contact stays private until you and a wholesaler both agree to share on a deal.',
    cta: 'Join as a buyer — free',
    role: 'buyer',
  },
  {
    key: 'wholesaler',
    icon: '🏘️',
    title: 'Wholesaler',
    body: 'Find matching buyers for your off-market deals.',
    cta: 'Join as a wholesaler',
    role: 'wholesaler',
  },
  {
    key: 'agent',
    icon: '🤝',
    title: 'Real estate agent',
    body: 'Connect your clients\u2019 properties with matching buyers.',
    note: 'Real estate agent — joins as a referrer.',
    cta: 'Join as a real estate agent — free',
    role: 'referrer',
  },
  {
    key: 'seller',
    icon: '🏡',
    title: 'Property owner',
    body: 'Find buyers for a property you own.',
    cta: 'Join as a property owner — free',
    role: 'seller',
  },
  {
    key: 'multiple',
    icon: '🧭',
    title: 'I\u2019m multiple',
    body: 'Pick your main role first — tell the operator if you need another role added.',
    note: 'The platform stores one role per account, so there is no multi-role signup. Choose the role you use most.',
    cta: 'Choose my main role',
    role: null,
  },
];

export default function JoinPage() {
  const [going, setGoing] = useState('');
  const [preselected, setPreselected] = useState('');
  // Slice 133 — ?role=buyer (or another role) pre-selects its
  // card; ?ref= is stashed for later attribution. Reading the
  // query on mount (window.location) needs no Suspense boundary.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const hit = ROLE_FROM_QUERY[(q.get('role') || '').trim().toLowerCase()];
      if (hit) {
        setPreselected(hit.key);
        localStorage.setItem('ws_pending_role', hit.role);
      }
      const ref = (q.get('ref') || '').trim();
      if (ref) localStorage.setItem('ws_invite_ref', ref);
    } catch { /* no storage / no query — cards still work */ }
  }, []);

  function go(card: JoinCard) {
    setGoing(card.key);
    try {
      if (card.role) {
        localStorage.setItem('ws_pending_role', card.role);
      } else {
        localStorage.removeItem('ws_pending_role');
      }
    } catch { /* no storage — signup still works, role defaults */ }
    window.location.href = '/#signin';
  }
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <p className="ws-buildtag">WholesalingOS — Join</p>
      <section style={{ background: '#1e293b', padding: 22, borderRadius: 12, marginTop: 16 }}>
        <h1 style={{ marginTop: 0 }}>Join WholesalingOS for free</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65 }}>
          Pick the role that matches how you use the platform. You register under one role and
          you see that role&rsquo;s dashboard. Wholesalers get 90 days free, then $150/mo — buyers,
          property owners, title companies, referrers, and lenders are free.
        </p>
        <p style={{ fontSize: 13.5 }}>
          Already have an account? <a href="/#signin" style={{ color: '#7dd3fc' }}>Sign in</a>
        </p>
        {preselected && (
          <p style={{ fontSize: 13.5, background: '#064e3b', border: '1px solid #059669', borderRadius: 8, padding: '8px 12px' }}>
            You were invited as a {CARDS.find((c) => c.key === preselected)?.title || 'buyer'} — that
            role is pre-selected below. Tap its card to register; you register yourself, one tap
            at a time.
          </p>
        )}
      </section>
      {/* Slice 133 — min(260px, 100%): the card column shrinks
          to the viewport at phone width instead of forcing a
          260px track that overflows below ~300px. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12, marginTop: 16 }}>
        {CARDS.map((card) => (
          <article key={card.key} style={{ background: '#16213a', border: preselected === card.key ? '2px solid #059669' : '1px solid rgba(148,163,184,0.28)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 22 }}>{card.icon}</div>
            <h2 style={{ fontSize: 16.5, margin: '6px 0' }}>
              {card.title}
              {preselected === card.key && (
                <span style={{ fontSize: 12, color: '#6ee7b7', marginLeft: 8 }}>Pre-selected for you</span>
              )}
            </h2>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.55, margin: '0 0 8px' }}>{card.body}</p>
            {card.note && <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 10px' }}>{card.note}</p>}
            <button
              type="button"
              onClick={() => go(card)}
              disabled={going !== ''}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13.5 }}
            >
              {going === card.key ? 'Taking you to signup…' : card.cta}
            </button>
          </article>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
        Signing up creates one account under one role. If you need a second role later, tell the
        operator — roles can be switched in Your Portal.
      </p>
    </div>
  );
}
