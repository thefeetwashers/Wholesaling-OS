import React from 'react';

// Terms of Service — built from production/privacy-terms.md and filled
// in with the platform's real terms (90-day trial, $150/mo, office lock
// on lapse, acceptable use incl. the no-scraping / no-unlawful-outreach
// rules the app is actually built on). DRAFT banner stays until the
// owner's attorney review is complete.

const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto' };
const panel: React.CSSProperties = { background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 };
const draft: React.CSSProperties = { background: '#422006', padding: '10px 14px', borderRadius: 10, fontSize: 13.5 };

export default function TermsPage() {
  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS — Terms of Service</p>
      <section style={panel}>
        <h1>Terms of Service</h1>
        <p style={draft}>
          <strong>DRAFT — ATTORNEY REVIEW REQUIRED.</strong> These terms are published so users can see the real
          rules of the platform today. They take effect for paying customers only after review by the operator’s
          attorney.
        </p>
        <p style={{ fontSize: 13.5 }}>
          <strong>Effective date:</strong> October 31, 2026 · <strong>Operator:</strong> THE FEET WASHERS, INC., a
          Florida corporation · <strong>Contact:</strong> thefeetwashers@gmail.com
        </p>

        <h3>1. The service</h3>
        <p style={{ fontSize: 14 }}>
          WholesalingOS is a workflow tool for real estate wholesaling: lead management, deal analysis, contract
          templates, buyer and seller portals, outreach preparation and tracking, escrow tracking, and
          disbursement paperwork. It is a tool — not a brokerage, law firm, escrow agent, or title company.
        </p>
        <p style={{ fontSize: 14 }}>
          The service does <strong>not</strong> scrape websites, auto-dial phone numbers, or auto-send messages,
          and it provides no AI calling or automated texting. Outreach tools prepare messages and links; you send
          them yourself from your own phone and accounts.
        </p>

        <h3>2. Subscription</h3>
        <p style={{ fontSize: 14 }}>
          WholesalingOS Pro is $150 per month after a 90-day free trial, billed through Stripe. That subscription
          is the only platform fee — assignment fees and joint-venture splits are your own money between you and
          your counterparties, and the platform takes no cut of them. You may cancel through Stripe at any time;
          access continues to the end of the paid period. If a trial lapses or a payment fails, the wholesaler
          office locks until the subscription is active again; your data stays saved. Buyers, sellers, and title
          companies use their portals free and are never locked for billing.
        </p>

        <h3>3. Acceptable use</h3>
        <p style={{ fontSize: 14 }}>You agree not to:</p>
        <ul style={{ fontSize: 14 }}>
          <li>Use the service to scrape people-search, listing, or government sites, or to pull data you have no right to use;</li>
          <li>Make calls or send texts that violate the TCPA, state solicitation laws, or do-not-call rules — including contacting anyone without a lawful basis, or anyone who has opted out;</li>
          <li>Attempt to access another user’s data, or misrepresent the service’s outputs as legal, tax, or investment advice;</li>
          <li>Upload content you have no right to use, or use the service for any unlawful purpose.</li>
        </ul>
        <p style={{ fontSize: 14 }}>
          You are responsible for the consent basis behind your own outreach. If a person opts out, record it —
          the platform’s blocklist and Do Not Contact tools exist for exactly that, and working around them is a
          terms violation.
        </p>

        <h3>4. Contracts and compliance are your responsibility</h3>
        <p style={{ fontSize: 14 }}>
          Contract templates in the app are general information labeled “Attorney review required before use” —
          they are not legal advice. Wholesaling, assignment, disclosure, and advertising rules vary by state;
          have a local real estate attorney review your contracts and practices. Verify buyer, seller, and
          title-company information independently before relying on it. In every deal record, the seller sees
          their price only; how you structure your assignment is your responsibility.
        </p>

        <h3>5. Your data</h3>
        <p style={{ fontSize: 14 }}>
          Your leads, buyer lists, deals, and records are yours. You grant us only the license needed to store,
          display, and process them to run your account. You may export your data from the app at any time.
        </p>

        <h3>6. No earnings claims</h3>
        <p style={{ fontSize: 14 }}>
          We make no promise of income, deals, or assignment fees. Your results depend on your effort, market,
          and compliance.
        </p>

        <h3>7. Liability</h3>
        <p style={{ fontSize: 14 }}>
          To the maximum extent permitted by law, the service is provided “as is,” and the operator’s liability is
          limited to the fees you paid in the 12 months before the claim. We may suspend accounts for terms
          violations, non-payment, or unlawful use; you may export your data before a suspension for violations
          takes effect unless the use is unlawful.
        </p>

        <h3>8. Governing law</h3>
        <p style={{ fontSize: 14 }}>
          These terms are governed by Florida law. [Venue and dispute-resolution clause to be finalized in
          attorney review.]
        </p>
        <p style={{ fontSize: 13 }}><a href="/">← Back to WholesalingOS</a></p>
      </section>
    </div>
  );
}
