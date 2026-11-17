import React from 'react';
import type { Metadata } from 'next';

// Slice 136 — the public roadmap. This page exists because the
// homepage promises one ("Team seats are the next big build on our
// public roadmap"). Every entry below is traceable to the repo
// itself: shipped slices name their git commit, and nothing listed
// as next or planned carries a date — no date is promised for work
// that has not shipped. "Shipped" means the code is in the repo
// and deployed; first-live-use proofs (first real offer, first
// verified proof of funds, and the rest) are tracked separately in
// the Verification Ledger at /ledger.

export const metadata: Metadata = {
  title: 'Public roadmap — WholesalingOS',
  description: 'What WholesalingOS has shipped, what is being fixed now, what comes next, and what is planned — with no dates promised for work that has not shipped.',
  alternates: { canonical: '/roadmap' },
};

const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto' };
const panel: React.CSSProperties = { background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 };
const p: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7 };
const li: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7, marginBottom: 8 };

export default function RoadmapPage() {
  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS — Public roadmap</p>
      <section style={panel}>
        <h1>Public roadmap</h1>
        <p style={p}>
          What has shipped, what is being worked on now, and what comes next — in that order.
          Shipped entries name the change and the commit that carried it, so any of them can be
          checked against the repo. Nothing listed as next or planned carries a date, because no
          date is promised for work that has not shipped yet.
        </p>

        <h3>Shipped &amp; live</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li style={li}>
            <strong>Slice 132 — the marketplace (Nov 17, 2026, commit eb38fd0).</strong> Public
            off-market deals and a cash-buyers directory, join and managed-dispo pages, buy-box
            matching, and the free-stack underwriting tools (Census, HUD FMR, FEMA flood zone,
            parcel boundary, Broward records, corporate-buyer research).
          </li>
          <li style={li}>
            <strong>Slice 133 — offers, proof of funds &amp; saved searches (Nov 17, 2026, commit 03c9078).</strong> Buyer
            offers on deals with assignment drafting from an accepted offer, proof-of-funds
            upload with operator verification, saved searches, deal attention stats, state-linked
            county markets, and buy-box criteria.
          </li>
          <li style={li}>
            <strong>Slice 135 — API docs, Distressed Finder &amp; agent pocket listings (Nov 17, 2026, commit f10bab5).</strong> Published-deals
            API documentation, the Distressed Finder on 10 verified feeds, the JV submit form,
            agent pocket-listing intake with approve &amp; promote, two realtor scripts, the bulk
            Florida parcel enricher with a per-state registry, and CSV export on both tables.
          </li>
        </ul>

        <h3>Being worked on now</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li style={li}>
            <strong>Slice 136 — audit fixes.</strong> Homepage wording corrected to what the code
            actually proves (buyer tiers, contract signing, county code-enforcement coverage,
            script counts), the sitemap completed with the missing public routes, this roadmap
            page, the go-live checklist refreshed to the real current state, and the lender
            desk&apos;s packet load reporting the database&apos;s real error instead of a generic line.
          </li>
        </ul>

        <h3>Next</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li style={li}>
            <strong>Slice 134 — bring-your-own-provider store &amp; dispatcher.</strong> Slice 134 was
            held back while Slice 135 shipped, so it comes next: the per-wholesaler provider
            store (each wholesaler brings their own email, SMS, and skip-trace accounts) and the
            dispatcher behind &ldquo;Broadcast to My BYOK Buyers&rdquo; and the send-invite-blast. No
            date promised.
          </li>
        </ul>

        <h3>Planned</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li style={li}>
            <strong>Team seats.</strong> Today an account is one wholesaler&apos;s office. Team seats
            are the next big build after the provider store: more than one person working in the
            same office, with their own sign-in. No date promised — until then, JV partners split
            deals through the JV tools and keep their own offices.
          </li>
        </ul>

        <p style={p}>
          First-live-use proofs for the shipped slices — the first real offer accepted, the first
          proof of funds verified, the first Distressed Finder query, the first pocket listing
          promoted — are tracked in the <a href="/ledger" style={{ color: '#7dd3fc' }}>Verification Ledger</a>.
          Nothing is marked proven there until it has actually happened with a real record.
        </p>
      </section>
    </div>
  );
}
