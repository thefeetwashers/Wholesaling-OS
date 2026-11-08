import React from 'react';

// How We Verify — the public page behind the platform's honesty
// claims (Slice 89). Every statement here describes machinery
// that exists in the app today: counted records, consent gates,
// sealed workspaces. If a line ever stops being true, the line
// is wrong — not the standard — and it comes down.

const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto' };
const panel: React.CSSProperties = { background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 };
const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.65 };

export default function VerifyPage() {
  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS — How We Verify</p>
      <section style={panel}>
        <h1>How we verify</h1>
        <p style={p}>
          Wholesaling runs on numbers people claim. This platform runs on numbers it can count.
          This page says, in plain language, where every figure you see comes from — and what we
          will never do to make a number look bigger. Operated by THE FEET WASHERS, INC., Florida.
          Questions: thefeetwashers@gmail.com.
        </p>

        <h3>1. Closings are counted, not claimed</h3>
        <p style={p}>
          A buyer’s record — the tier on their Proof Card, the record a wholesaler sees at offer
          time — is counted by the database from real events only: offers that were accepted,
          B–C contracts that were signed, and escrow outcomes a wholesaler marked when a file
          ended. A wholesaler’s closing count on their seller page comes from the same closing
          records. Nobody types their own totals, nobody buys a tier, and a brand-new account
          honestly reads zero.
        </p>

        <h3>2. Money figures come from recorded rows</h3>
        <p style={p}>
          Fees, disbursements, and the tax-season export are sums over records the user entered
          and the platform stored — a “closed deal” means an actual sale price is recorded on
          the deal, and that definition is printed wherever the figure appears. Formulas are
          printed where they are used: the assignment-fee guide shows its math, the Distress
          Radar prints its heat formula, the Rental Analyzer shows every ratio it computes.
        </p>

        <h3>3. Reviews are recorded, never seeded</h3>
        <p style={p}>
          A review exists only when a file has closed and a real buyer or seller has actually
          replied. The wholesaler records the person’s name, their role on the deal, the
          rating, and their words verbatim — plus whether they gave permission to publish.
          There is no review import, no review for an open deal, and nothing is shown publicly
          without that permission flag.
        </p>

        <h3>4. Contact data carries its provenance</h3>
        <p style={p}>
          Every phone number or email on a lead was typed in by the wholesaler with its source
          recorded, or submitted by the person themselves through a seller page or voice
          intake — which the platform records as requested contact. The platform pulls no
          one’s phone number from anywhere, buys no skip-trace data, and scrapes nothing.
          Consent status is tracked per lead, and the do-not-contact blocklist is checked
          before any in-app send, failing closed.
        </p>

        <h3>5. Sending is human, every time</h3>
        <p style={p}>
          Nothing leaves this platform on its own. Emails and messages are composed by a
          person and sent on their tap, from their own accounts and numbers, to people whose
          recorded consent allows it. There are no robocalls, no auto-dialers, no mass
          blasts, and no AI voice agents — the laws those would break are named in our Terms,
          and the machinery to break them was never built.
        </p>

        <h3>6. Your workspace is sealed — including from us</h3>
        <p style={p}>
          Every account’s leads, buyers, and deals sit behind database row-level security:
          your rows are readable only by your sign-in. The platform owner’s own screens show
          billing status and anonymized totals — never your lists. List and deal screens
          carry a viewer watermark, and worker roles get no export. If your trial lapses,
          your office is sealed, not deleted, and reopens exactly as you left it.
        </p>

        <h3>7. Sources are linked, not copied</h3>
        <p style={p}>
          County records, auctions, and court filings live at their official sources. The
          platform links to those doors — 67 Florida counties, the state directory, PACER,
          the auction sources — and teaches the routine for pulling each list by hand. It
          does not republish government data as its own, invent coverage it does not have,
          or dress a link directory up as a data feed.
        </p>

        <h3>Hold us to it</h3>
        <p style={p}>
          Every feature ships only after it has been exercised against the live platform and
          its behavior recorded. Where a feature honestly cannot do a thing — where a county
          offers no data feed, where a number cannot be known — the product says so in the
          place you would otherwise be misled. If you find a claim on this platform that its
          own machinery does not back, write to thefeetwashers@gmail.com and it will be fixed
          or removed.
        </p>
        <p style={p}>
          Two companion records keep this public: the{' '}
          <a href="/ledger" style={{ color: '#7dd3fc' }}>Verification Ledger</a> (what was checked, slice by
          slice, including the proofs still outstanding) and{' '}
          <a href="/charter" style={{ color: '#7dd3fc' }}>the Charter</a> (what we promise, in writing,
          including the price).
        </p>
      </section>
    </div>
  );
}
