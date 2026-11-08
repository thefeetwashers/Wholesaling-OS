'use client';

import PublicCalculator from './PublicCalculator';

// Slice 60 — the public homepage below the hero: what the office
// does, organized the way a wholesaler's business actually runs;
// the real calculators; the four doors (roles); honest pricing;
// an FAQ that answers the questions wholesalers actually ask —
// including the ones other platforms dodge; the lessons
// experienced wholesalers say every beginner forgets; and a
// teaching footer. Every claim here is a feature that exists in
// the signed-in product today, stated the way it behaves there.

const panel = { background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 14, padding: '16px 18px' } as const;
const h2 = { fontSize: 22, margin: '28px 0 6px' } as const;
const sub = { fontSize: 14, color: '#94a3b8', margin: '0 0 14px', maxWidth: 760 } as const;

const CATEGORIES: { icon: string; title: string; body: string }[] = [
  { icon: '🔎', title: 'Find sellers', body: 'Step-by-step Pull-the-List playbooks for lis pendens, tax deeds & lands available, probate, code violations and vacant/absentee owners — plus a county desk with the official clerk, appraiser and code-enforcement doors for all 67 Florida counties and state directories nationwide, a Deal Radar of 26 verified government sale sources, and a live government-auction feed. Your own seller page and voice intake bring sellers to you.' },
  { icon: '📞', title: 'Your call-center desk', body: 'A call queue ranked by your own distress tags and follow-up dates, 12 call and letter scripts with the merge fields filled from the lead in front of you, click-to-send calling, texting and email with consent and do-not-contact gates on every message — and in-app sending the moment you connect your own Twilio and email keys.' },
  { icon: '🧮', title: 'Run the numbers', body: 'The 70% rule / MAO analyzer, the assignment-fee guide, a rental & DSCR analyzer for landlord buyers, an equity flag from the county assessed value and liens, and a net sheet on every deal. The same calculators sit below, free, before you ever sign up.' },
  { icon: '📝', title: 'Contracts & closing', body: 'A contract engine with signing inside the platform, an escrow tracker with EMD and closing countdowns, a closing checklist derived from your real file, and a one-click title packet. Every clause carries an attorney-review flag — contracts are tools, not legal advice.' },
  { icon: '💵', title: 'Buyers who actually close', body: 'Cash buyers register free, publish their buy boxes, and get matched to your deals by area and criteria. Their platform tier is earned from closings the platform itself counted — never bought, never self-declared. Sellers see their price only; your assignment fee is never shown to them.' },
  { icon: '🏛️', title: 'Title companies & your money', body: 'A title and vendor directory you build from the companies you actually close with, disbursement tracking, an authorization letter that never stores bank numbers, and a dashboard that briefs you every morning from your real pipeline — revenue, contracts, deadlines, follow-ups due.' },
];

const FORGOTTEN: { title: string; body: string }[] = [
  { title: 'Follow-up is the business', body: 'Most contracts are signed on the fifth to twelfth conversation, not the first. Wholesalers who "have no deals" usually have un-worked follow-ups. The call queue and overdue-follow-up radar exist so no seller you already paid to find ever goes cold in a drawer.' },
  { title: 'Buyers first, deals second', body: 'A contract with no buyer is a liability with a deadline. Enter your buyers and their buy boxes BEFORE you chase sellers — the platform matches from criteria, and a deal nobody wants teaches an expensive lesson.' },
  { title: 'EMD dates are real money', body: 'Miss an earnest-money deadline and the deposit is gone, however good the deal was. Every escrow file here counts its EMD and closing dates down in front of you.' },
  { title: 'Order title early', body: 'Liens, judgments, open permits and ownership surprises surface at the title search — in week one, or at the closing table. Early title turns a killed deal into a cheap lesson instead of a blown closing.' },
  { title: 'You market your interest, never the house', body: 'You do not own the property; you hold equitable interest under a contract. Every public listing here says exactly that. Advertising a house as if it were yours is how wholesalers meet regulators.' },
  { title: 'Have the double-close answer ready', body: 'Some sellers, lenders and HOAs restrict assignments. Knowing your double-close path — and what it costs — before you sign keeps one clause from killing a funded deal.' },
  { title: 'Consent is not paperwork, it is the business', body: 'Call and text only people who asked to hear from you or whose contact you lawfully hold, honor every opt-out the second it lands, and keep the log. The platform enforces this on every send — fines start where shortcuts do.' },
  { title: 'Set the tax money aside the day you are paid', body: 'Assignment income is ordinary income. The deal net sheet shows what you kept; moving the tax share out of your spending account the same week is the habit that separates businesses from hobbies.' },
];

export const FAQS: { q: string; a: string }[] = [
  { q: 'What does it cost?', a: 'One subscription: 90 days free, then $150/month per wholesaler. There is no per-deal cut, no percentage of your assignment fees, and no second platform fee hiding anywhere. Your assignment fees are your money.' },
  { q: 'Who can see my leads and my buyer list?', a: 'Only you. Your workspace is sealed — the platform owner cannot open your leads, your buyers, or your deals. Ownership sees billing status and anonymous counts, never your business.' },
  { q: 'Does the platform find leads for me automatically?', a: 'It hands you the doors and the routines, not a scraped database: official county playbooks, a government-auction radar and live feed, and a seller page that brings motivated sellers to you. Lists you build or lawfully buy import in one drop. Anyone promising you free nationwide probate lists "while you sleep" is selling you a terms-of-service violation with your name on the account.' },
  { q: 'Will it call or text sellers for me?', a: 'No — and that is deliberate. Federal law treats AI and bulk outreach to people who never consented as illegal telemarketing, with fines per message. The platform is your call desk: your queue, your scripts, one tap to send from your own accounts, every send consent-checked and logged.' },
  { q: 'Which states and counties does it cover?', a: 'All 50 states and U.S. territories — you can run a wholesaling business anywhere in the U.S. from this office. Florida is the deepest today (all 67 counties with verified clerk/appraiser/code doors); every other state is reachable through its official state directory and the nationwide NETR county portal, and counties deepen as wholesalers work them.' },
  { q: 'I am a cash buyer / seller / title company. What do I get?', a: 'Your own free portal. Buyers publish buy boxes and see matching deals; sellers see their deal and their price — never the wholesaler\'s fee; title companies track their files. Register under your role below and you land in your dashboard, not the wholesaler\'s.' },
  { q: 'Can my team work in my account?', a: 'Today an account is one wholesaler\'s office. Team seats are the next big build on our public roadmap — until then, JV partners split deals with you through the JV tools and keep their own offices.' },
  { q: 'Is my data sold or shared?', a: 'Never. Your leads, buyers, and deals are yours, exportable by you at any time (CSV), and never sold, shared, or used to train anything.' },
];

const ROLES: { key: string; icon: string; title: string; body: string; cta: string }[] = [
  { key: 'wholesaler', icon: '🏘️', title: 'Wholesaler', body: 'The full office: leads, call desk, analyzers, contracts, buyers, title, money. 90 days free, then $150/mo.', cta: 'Start my 90 days free' },
  { key: 'buyer', icon: '💵', title: 'Cash Buyer', body: 'Free forever. Publish your buy box, see deals that match it, build a closing record that speaks for itself.', cta: 'Register as a buyer — free' },
  { key: 'seller', icon: '🏡', title: 'Seller', body: 'Free. Follow your deal, see your price, sign in your own portal when your wholesaler sends you a deal.', cta: 'Register as a seller — free' },
  { key: 'title', icon: '🏛️', title: 'Title Company', body: 'Free. Receive files, track milestones, and be findable by the wholesalers closing with you.', cta: 'Register as title — free' },
  { key: 'referrer', icon: '🤝', title: 'Referrer', body: 'Free. Know someone who needs to sell? Report the seller you found, follow its status, and earn $1,000 when the deal closes and funds.', cta: 'Register as a referrer — free' },
];

const ONLY_HERE: { tag: string; proof: string }[] = [
  { tag: '🔒 Your leads are sealed — even from us', proof: 'The platform owner sees billing status and anonymous counts. Never your leads, buyers, or deals.' },
  { tag: '🙈 Sellers never see your fee', proof: 'Seller views show their price only. Your assignment fee exists in your office and at the closing table — nowhere else.' },
  { tag: '✅ Every number is a real record', proof: 'No seeded buyers, no invented stats, no fake "live" counters. If it is on your dashboard, it happened in your database.' },
  { tag: '🏆 Buyer tiers that cannot be bought', proof: 'A buyer\'s tier comes only from closings this platform counted. Money and self-declarations do not move it.' },
  { tag: '⚖️ Attorney-review flags on every contract', proof: 'Most platforms hand you a contract and wish you luck. Ours tells you, on the document, to have your attorney review it.' },
  { tag: '🚫 No scraped data. No robocalls.', proof: 'No terms-of-service violations hiding in your supply chain, no AI cold-calling fines with your name on the account.' },
  { tag: '🏛️ The real sources, linked', proof: 'Official county records, clerk sales, and live government auctions — the same sources the data companies resell, opened directly.' },
  { tag: '💸 One flat fee. No cut of your deals.', proof: '90 days free, then $150/month. Your assignment fees are 100% yours — the platform never takes a percentage of a closing.' },
];

export default function Landing({ onPickRole }: { onPickRole: (role: string) => void }) {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
      <h2 style={h2}>What no other wholesaling platform gives you</h2>
      <p style={sub}>Read the fine print anywhere else, then read ours. These eight are true of this office today — each one is how the system actually behaves, not a slogan:</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        {ONLY_HERE.map((o) => (
          <span key={o.tag} title={o.proof} style={{ background: '#065f46', border: '1px solid rgba(110,231,183,0.5)', color: '#ecfdf5', borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 600 }}>
            {o.tag}
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
        {ONLY_HERE.map((o) => (
          <p key={o.tag} style={{ fontSize: 12.5, color: '#94a3b8', margin: 0, lineHeight: 1.55 }}>
            <strong style={{ color: '#6ee7b7' }}>{o.tag}</strong> — {o.proof}
          </p>
        ))}
      </div>

      <section style={{ background: '#052e16', border: '1px solid #166534', padding: 22, borderRadius: 12, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Real. Nothing fake. That&rsquo;s why you get 90 days.</h2>
        <p style={{ fontSize: 15, maxWidth: 760 }}>
          Fake platforms need your money fast — before you look closely. We do the opposite:
          <strong> 90 full days free</strong>, before the first $150 is ever charged, so you can test
          every screen with your own real leads and your own real deals. If something here were fake,
          90 days is more than enough time to catch it. That&rsquo;s the point.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ background: '#0b1526', border: '1px solid #1f3350', borderRadius: 10, padding: 14 }}>
            <strong>🚫 No fake numbers</strong>
            <p style={{ fontSize: 13.5, margin: '6px 0 0' }}>No seeded buyers, no invented counters, no projected income. Every figure in your office is counted from a real record — or it isn&rsquo;t shown.</p>
          </div>
          <div style={{ background: '#0b1526', border: '1px solid #1f3350', borderRadius: 10, padding: 14 }}>
            <strong>🚫 No fake features</strong>
            <p style={{ fontSize: 13.5, margin: '6px 0 0' }}>If a button exists, it works. If something needs a key or an account to light up, the screen says so plainly instead of pretending.</p>
          </div>
          <div style={{ background: '#0b1526', border: '1px solid #1f3350', borderRadius: 10, padding: 14 }}>
            <strong>✅ Nothing to hide</strong>
            <p style={{ fontSize: 13.5, margin: '6px 0 0' }}>Your leads stay sealed — even from us. Your data exports with you any time. Judge us the way you&rsquo;d judge any partner: by what survives inspection.</p>
          </div>
        </div>
      </section>

      <h2 style={h2}>Everything a wholesaling business runs on — one office</h2>
      <p style={sub}>Built for solo wholesalers and companies, in every U.S. state and territory. Pick a lane:</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {CATEGORIES.map((c) => (
          <div key={c.title} style={panel}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{c.icon} {c.title}</div>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>{c.body}</p>
          </div>
        ))}
      </div>

      <h2 style={h2}>How a deal flows through the office</h2>
      <p style={sub}>Find → Qualify → Contract → Market → Show → Close → Track. One deal record from the first knock to the funded wire — nothing re-typed, nothing lost between apps.</p>

      <h2 style={h2}>Run your first deal&rsquo;s numbers — right here, free</h2>
      <p style={sub}>These are the platform&rsquo;s own calculators, live on the homepage. Your numbers never leave this page.</p>
      <PublicCalculator />

      <h2 style={h2}>Five doors in — pick yours</h2>
      <p style={sub}>You register under one role and you see that role&rsquo;s dashboard — wholesalers never land in a buyer&rsquo;s portal, sellers never see a wholesaler&rsquo;s office, and nobody sees anyone else&rsquo;s business.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {ROLES.map((r) => (
          <div key={r.key} style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{r.icon} {r.title}</div>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 14px', lineHeight: 1.6, flex: 1 }}>{r.body}</p>
            <button type="button" onClick={() => onPickRole(r.key)}
              style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
              {r.cta}
            </button>
          </div>
        ))}
      </div>

      <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Selling your house?</h2>
        <p style={{ fontSize: 14.5, maxWidth: 760 }}>
          If a wholesaler sent you here, use <strong>their</strong> link — it opens their own free seller
          page, and your details go to their desk only, never to a marketplace. If you found us on your
          own, the platform&rsquo;s first buyer is its operator: <strong>The Feet Washers, Inc.</strong> buys
          houses for cash in Florida. Reach them at{' '}
          <a href="mailto:thefeetwashers@gmail.com" style={{ color: '#93c5fd' }}>thefeetwashers@gmail.com</a>{' '}
          or <a href="tel:+17729716129" style={{ color: '#93c5fd' }}>772-971-6129</a> — a person answers,
          and there is no fee to talk.
        </p>
      </section>

      <h2 style={h2}>What experienced wholesalers wish someone had told them</h2>
      <p style={sub}>The lessons that cost the most tuition in this business — written on the wall of your new office, free.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {FORGOTTEN.map((f) => (
          <div key={f.title} style={panel}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>⚑ {f.title}</div>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>{f.body}</p>
          </div>
        ))}
      </div>

      <h2 style={h2}>Pricing, in one breath</h2>
      <div style={panel}>
        <p style={{ fontSize: 15, lineHeight: 1.7, margin: 0 }}>
          <strong>90 days free.</strong> Then <strong>$150/month</strong> for wholesalers — the only platform fee there is.
          Buyers, sellers, and title companies are free. No per-deal cut, no percentage of your assignment fee,
          no charge for the calculators, playbooks, or scripts. If a feature ever costs extra, it will say so
          here first — that is the deal.
        </p>
      </div>

      <h2 style={h2}>Questions, answered straight</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {FAQS.map((f) => (
          <div key={f.q} style={panel}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{f.q}</div>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0', lineHeight: 1.6 }}>{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingFooter() {
  const col = { display: 'flex', flexDirection: 'column' as const, gap: 7, fontSize: 13.5 };
  const link = { color: '#7dd3fc', textDecoration: 'none' } as const;
  return (
    <footer style={{ marginTop: 36, borderTop: '1px solid rgba(148,163,184,0.3)', paddingTop: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>WholesalingOS</div>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: '8px 0 0' }}>
            The wholesaling office that does what it says: real records, real math, real closings —
            for wholesalers, buyers, sellers, and title companies in all 50 states and U.S. territories.
            Operated by The Feet Washers, Inc., Florida.
          </p>
        </div>
        <div style={col}>
          <strong style={{ color: '#fff' }}>Learn the business</strong>
          <span style={{ color: '#cbd5e1' }}>Inside the office, free with your account:</span>
          <span style={{ color: '#94a3b8' }}>Pull-the-List playbooks — probate, tax deed, lis pendens, code violations</span>
          <span style={{ color: '#94a3b8' }}>12 call &amp; letter scripts, including the direct-mail letter</span>
          <span style={{ color: '#94a3b8' }}>The fee guide, the equity flag, and the lessons wall above</span>
          <span style={{ color: '#94a3b8' }}>Start with the calculators — they teach the math as you type</span>
        </div>
        <div style={col}>
          <strong style={{ color: '#fff' }}>The platform</strong>
          <a href="#signin" style={link}>Create your account</a>
          <a href="#signin" style={link}>Sign in</a>
          <span style={{ color: '#94a3b8' }}>90 days free · then $150/mo · buyers, sellers &amp; title free</span>
          <span style={{ color: '#94a3b8' }}>Questions: thefeetwashers@gmail.com</span>
        </div>
        <div style={col}>
          <strong style={{ color: '#fff' }}>Legal</strong>
          <a href="/privacy" style={link}>Privacy Policy</a>
          <a href="/terms" style={link}>Terms of Service</a>
          <a href="/verify" style={link}>How We Verify</a>
          <span style={{ color: '#94a3b8' }}>WholesalingOS is software, not legal, tax, or investment advice. Contract templates carry an attorney-review flag — use your own attorney for your state.</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 18 }}>
        © {new Date().getFullYear()} The Feet Washers, Inc. Wholesaling laws differ by state — know yours before you contract.
      </p>
    </footer>
  );
}
