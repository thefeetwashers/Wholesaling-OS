import React from 'react';

// Privacy Policy — built from production/privacy-terms.md and filled in
// with the platform's real facts (operator, data flows, processors).
// DRAFT banner stays until the owner's attorney review is complete,
// the same gate the contract templates carry.

const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto' };
const panel: React.CSSProperties = { background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 };
const draft: React.CSSProperties = { background: '#422006', padding: '10px 14px', borderRadius: 10, fontSize: 13.5 };

export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS — Privacy Policy</p>
      <section style={panel}>
        <h1>Privacy Policy</h1>
        <p style={draft}>
          <strong>DRAFT — ATTORNEY REVIEW REQUIRED.</strong> This policy is published so users can see exactly what
          the platform does with data today. It takes effect for paying customers only after review by the
          operator’s attorney.
        </p>
        <p style={{ fontSize: 13.5 }}>
          <strong>Effective date:</strong> October 31, 2026 · <strong>Operator:</strong> THE FEET WASHERS, INC., a
          Florida corporation (“WholesalingOS”, “we”) · <strong>Contact:</strong> thefeetwashers@gmail.com
        </p>

        <h3>1. What we collect</h3>
        <p style={{ fontSize: 14 }}>
          Account data (name, email, company, phone); the business data you enter — seller leads, deals, contracts,
          buyer lists, title companies, county links you save, outreach and call logs, disbursements, and KPI
          history; subscription and billing status (payments are processed by Stripe — we never see or store full
          card numbers); and, if you publish a seller page, the submissions sellers send through it (their name,
          contact details, and property address), which are delivered to <em>your</em> account only.
        </p>
        <p style={{ fontSize: 14 }}>
          Do-not-contact protection uses one-way SHA-256 hashes of a phone number or property address. The
          blocklist stores hashes, not readable phone numbers or addresses, and entries are never shown to users.
        </p>

        <h3>2. How we use it</h3>
        <p style={{ fontSize: 14 }}>
          To operate your account, provide the app’s features, process your subscription, and show you your own
          statistics. We do not sell your data. We do not share your buyer lists, seller leads, or deal economics
          with other users, advertisers, or data brokers.
        </p>

        <h3>3. What the platform owner can and cannot see</h3>
        <p style={{ fontSize: 14 }}>
          The owner’s admin console shows account and billing information (email, role, subscription status, trial
          dates) and anonymized platform totals (counts of accounts, deals, listings, offers), plus county names
          and counts in the county Verify Queue. It never shows the owner your leads, your buyer list, your deals,
          or the links you saved. Your data is isolated per account by database Row Level Security.
        </p>

        <h3>4. Who processes data for us</h3>
        <p style={{ fontSize: 14 }}>
          Supabase (database and sign-in), Vercel (hosting), Stripe (payments), and Google (only if you choose
          “Sign in with Google”). The app uses essential sign-in cookies only; it runs no advertising trackers.
        </p>

        <h3>5. Communications and the law</h3>
        <p style={{ fontSize: 14 }}>
          WholesalingOS does not send messages or place calls for you — every call, text, WhatsApp message, and
          email is initiated and sent by you from your own device and accounts. You are responsible for complying
          with the TCPA, state calling/texting laws, and do-not-call rules for your own outreach, including having
          a lawful basis to contact each person and honoring opt-outs immediately. The platform enforces opt-outs
          with its blocklist, and your office marks a lead Do Not Contact the moment you record an opt-out.
        </p>

        <h3>6. Your rights</h3>
        <p style={{ fontSize: 14 }}>
          You may export your data (CSV export in the app) and request deletion of your account and data by
          emailing thefeetwashers@gmail.com. Deletion is completed within 30 days, except where retention is
          required by law (for example, tax records). Sellers who submitted their information through a
          wholesaler’s seller page may ask us at the same email to route a removal request.
        </p>

        <h3>7. Changes</h3>
        <p style={{ fontSize: 14 }}>
          We will notify account holders by email at least 30 days before material changes to this policy take
          effect.
        </p>
        <p style={{ fontSize: 13 }}><a href="/">← Back to WholesalingOS</a></p>
      </section>
    </div>
  );
}
