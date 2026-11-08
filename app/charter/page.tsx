import React from 'react';
import type { Metadata } from 'next';

// Slice 99 — the Charter (Uncopyable Set, part 2). The
// operator's public covenant: the never list, the pricing
// covenant, and the portability guarantee, signed and dated.
// These are commitments the platform's machinery was built to
// keep — each one names the mechanism, not just the intent.

export const metadata: Metadata = {
  title: 'The Charter — what WholesalingOS promises, in writing',
  description: 'The operator’s covenant: what this platform will never do, the pricing promise ($150 a month after 90 free days, the only fee ever), and the guarantee that your records are yours.',
  alternates: { canonical: '/charter' },
};

const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto' };
const panel: React.CSSProperties = { background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 };
const p: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7 };
const li: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7, marginBottom: 8 };

export default function CharterPage() {
  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS — The Charter</p>
      <section style={panel}>
        <h1>The Charter</h1>
        <p style={p}>
          Platforms make promises in advertising and break them in fine print. This page is the opposite
          arrangement: the promises are the product. WholesalingOS is operated by THE FEET WASHERS, INC.,
          a Florida corporation, and this charter is its public covenant with every wholesaler, buyer,
          seller, title company, and referrer who uses it. If we ever change a word of it, the change and
          its date will be published here — the old words will not quietly disappear.
        </p>

        <h3>What we will never do</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li style={li}><strong>Never scrape.</strong> No county site, no listing site, no directory is scraped to fill this platform. Data arrives through official doors, your own lawful imports, your own accounts at list tools, and people who hand it to you.</li>
          <li style={li}><strong>Never robocall, auto-dial, or AI-call.</strong> No AI voice agents, no power dialers, no automated cold outreach of any kind. The machinery was never built, so it can never be switched on.</li>
          <li style={li}><strong>Never auto-send.</strong> Every message that leaves this platform is composed and sent by a human, on a human tap, to someone whose recorded consent allows it.</li>
          <li style={li}><strong>Never fake a number.</strong> No seeded buyers, no invented counters, no stock reviews, no projected income. Every figure shown is counted from a real record — or it is not shown. Proofs deferred are labeled deferred, in public, in the Verification Ledger.</li>
          <li style={li}><strong>Never sell, rent, or share your data.</strong> Your leads, buyers, and deals are yours. They are not a product, not an ad audience, not a training set.</li>
          <li style={li}><strong>Never peek.</strong> Your workspace is sealed by database row-level security — including from us. The operator’s own screens show billing status and anonymized totals, never your lists.</li>
          <li style={li}><strong>Never show a seller your fee.</strong> Seller-facing views show the seller their price, full stop. Your assignment fee is your business.</li>
          <li style={li}><strong>Never take a cut of your deals.</strong> Assignment fees and JV splits are the wholesalers’ own money. The platform wires nothing, splits nothing, and skims nothing.</li>
          <li style={li}><strong>Never hold your records hostage.</strong> A lapsed account is sealed, not deleted, and reopens exactly as you left it.</li>
        </ul>

        <h3>The pricing covenant</h3>
        <p style={p}>
          The price is <strong>$150 a month</strong>, after <strong>90 days free</strong>, per wholesaler.
          That subscription is the only platform fee — there is no per-deal fee, no percentage, no
          transaction skim, no paid tier hiding the real product. If the price ever changes, it changes
          for new accounts first, and existing subscribers get at least 90 days’ notice before any change
          touches them. The trial is the evaluation: 90 full days to test every screen with your own real
          leads, before the first dollar is charged.
        </p>

        <h3>The portability guarantee</h3>
        <p style={p}>
          Your records are portable because they were always yours. Your leads export to CSV from inside
          the office; your tax-season export assembles your closed deals and disbursements for your own
          books; your photos, letters, and contracts are generated from your data, in the open formats you
          printed them in. If you leave, your office stays sealed and kept for at least twelve months —
          and if you return inside that window, it reopens exactly as you left it. A platform confident in
          its machinery does not need your data as a hostage.
        </p>

        <h3>Hold us to it</h3>
        <p style={p}>
          The companion records are public: <a href="/verify" style={{ color: '#7dd3fc' }}>How We Verify</a>{' '}
          explains where every figure comes from, and the{' '}
          <a href="/ledger" style={{ color: '#7dd3fc' }}>Verification Ledger</a> records, slice by slice, what
          was actually checked on the live system. If any claim on this platform is not backed by its own
          machinery, write to thefeetwashers@gmail.com — it will be fixed or removed, and the correction
          will show in the Ledger.
        </p>

        <p style={{ ...p, marginTop: 22, borderTop: '1px solid rgba(148,163,184,0.3)', paddingTop: 16 }}>
          Adopted and published November 8, 2026.<br />
          <strong>THE FEET WASHERS, INC.</strong>, operator of WholesalingOS<br />
          Lauderdale Lakes, Florida · thefeetwashers@gmail.com · 772-971-6129
        </p>
      </section>
    </div>
  );
}
