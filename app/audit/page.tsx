import React from 'react';
import type { Metadata } from 'next';

// Slice 103 — the 10-Minute Audit (Uncopyable Set, part 6).
// Ten questions any wholesaling platform passes or fails in
// public, each with the test a buyer can run themselves and
// this platform's answer — with the link to the machinery that
// backs the answer. No competitor is named: the audit is a
// standard, not an attack, and it applies to us first.

export const metadata: Metadata = {
  title: 'The 10-Minute Audit — ten questions every wholesaling platform should pass in public',
  description: 'Before you pay any wholesaling platform, run these ten tests. Each takes a minute, each is pass-or-fail, and our own answers link to the machinery behind them.',
  alternates: { canonical: '/audit' },
};

const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto' };
const panel: React.CSSProperties = { background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 };
const p: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7 };
const test: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.65, color: '#fbbf24' };
const answer: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7 };
const a: React.CSSProperties = { color: '#7dd3fc' };

const QUESTIONS: { q: string; test: string; answer: React.ReactNode }[] = [
  {
    q: '1. Pick any number on the dashboard. Where did it come from?',
    test: 'The test: point at one figure and ask for its source records. A real platform traces it in one step; a decorated one changes the subject.',
    answer: <>Every counted surface here carries its receipt — a 🧾 line naming the records it was counted from. <a href="/verify" style={a}>How We Verify</a> explains each figure’s source.</>,
  },
  {
    q: '2. Are the buyers real, and can their record be bought?',
    test: 'The test: ask how a buyer earns a better standing. If money, tenure, or self-reporting moves it, the record is marketing.',
    answer: <>Buyer tiers here come only from closings the platform itself counted (accepted offers, signed B–C contracts, escrow outcomes). Money does not move them, and the true zero record prints as zero.</>,
  },
  {
    q: '3. Can the platform’s owner read my leads?',
    test: 'The test: ask exactly which screens the owner sees into your account. “Trust us” is not an architecture.',
    answer: <>Workspaces are sealed by database row-level security — including from us. The owner’s screens show billing status and anonymized totals, never a user’s lists. It is in <a href="/charter" style={a}>the Charter</a>: never peek.</>,
  },
  {
    q: '4. Does the seller ever see my assignment fee?',
    test: 'The test: open the seller’s view of a deal. If your fee is anywhere on it, every negotiation you run starts compromised.',
    answer: <>Seller-facing views show the seller their price, full stop. The fee exists in the wholesaler’s office and at the closing table — nowhere else.</>,
  },
  {
    q: '5. Where did this lead’s phone number come from?',
    test: 'The test: pick a lead and ask for the provenance of its contact data — who supplied it, when, from where. “The system found it” is how liability starts.',
    answer: <>Every lead carries a 🛂 Consent Passport: consent status, when and how it was recorded, each phone and email with the source it came from, and every logged touch. Where provenance is missing, the passport prints the gap as a warning — it never back-fills.</>,
  },
  {
    q: '6. Will it call or text people automatically for me?',
    test: 'The test: if the answer is yes, ask whose name is on the account when the TCPA fines arrive — federal law treats AI and bulk outreach to non-consented people as illegal telemarketing, per message.',
    answer: <>Never built, so it can never be switched on. Sending here is human, one tap at a time, from the wholesaler’s own accounts, behind consent and do-not-contact gates that fail closed.</>,
  },
  {
    q: '7. What does it cost — all of it, forever?',
    test: 'The test: get the total in one sentence, including per-deal cuts, percentages, and the tier the real product hides behind.',
    answer: <>$150 a month after 90 days free, per wholesaler — the only platform fee there is. No per-deal cut, no percentage of your fees, no second tier. The promise is published in <a href="/charter" style={a}>the Charter</a>, with a 90-day-notice rule on any change.</>,
  },
  {
    q: '8. Can I take my data and leave?',
    test: 'The test: export your leads right now, during the trial, before you have paid anything. If leaving is hard, staying is not a choice.',
    answer: <>Leads export to CSV from inside the office; a tax-season export assembles your closed deals and disbursements; a lapsed office is sealed — kept at least twelve months — and reopens exactly as you left it.</>,
  },
  {
    q: '9. Are the reviews and ratings real?',
    test: 'The test: ask what a reviewer had to do before their words could appear, and whether the star ratings in the platform’s search markup were counted or typed.',
    answer: <>Reviews here are recorded only after a counted closing, with the reviewer’s publish permission on the record. Our search markup deliberately carries no rating at all — none has been counted yet, so none is claimed.</>,
  },
  {
    q: '10. Show me what you actually tested before shipping.',
    test: 'The test: ask for the changelog of live verifications — not release notes, but what was clicked, saved, reloaded, and read back, including what is still unproven.',
    answer: <>Ours is public: the <a href="/ledger" style={a}>Verification Ledger</a> records every slice’s live check — and keeps an amber “still to prove” line on each proof that honestly waits for a first real event. A feature without an entry has not shipped.</>,
  },
];

export default function AuditPage() {
  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS — The 10-Minute Audit</p>
      <section style={panel}>
        <h1>The 10-Minute Audit</h1>
        <p style={p}>
          Ten questions. Ten minutes. Run them on any wholesaling platform you are considering — including
          this one, before you pay us anything. Each question is pass-or-fail in public: no demo call, no
          sales rep, no trust required. Our answers are printed under each test, with the link to the
          machinery that backs them — if an answer here is ever not backed by the platform itself, the
          Charter’s rule applies: it gets fixed or removed.
        </p>
      </section>
      {QUESTIONS.map((item) => (
        <section key={item.q} style={panel}>
          <h3 style={{ marginTop: 0 }}>{item.q}</h3>
          <p style={test}>{item.test}</p>
          <p style={answer}><strong style={{ color: '#6ee7b7' }}>Here:</strong> {item.answer}</p>
        </section>
      ))}
      <section style={panel}>
        <p style={p}>
          Run the audit during the 90 free days — that is what they are for. Start at the{' '}
          <a href="/ledger" style={a}>Verification Ledger</a>, read{' '}
          <a href="/charter" style={a}>the Charter</a>, then open an office and count the receipts yourself.
        </p>
      </section>
    </div>
  );
}
