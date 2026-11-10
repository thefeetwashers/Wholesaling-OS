// Slice 98 — the Verification Ledger data. One entry per shipped
// slice: what its live verification actually exercised and saw on
// the production system, in the plainest form. Deferred proofs
// are named as deferred — the entry says which first real event
// completes them. This file is the public record behind /verify;
// it is updated in the same commit as each new slice's tag, or
// the slice is not done.

export interface LedgerEntry {
  slice: number;
  date: string;
  title: string;
  verified: string;
  deferred?: string;
}

export const LEDGER_INTRO =
  'Every feature on this platform ships only after it has been exercised against the live production system — clicked, saved, reloaded, and read back from the database — never merely compiled. This ledger is that record, slice by slice. Where a proof honestly has to wait for a first real event (a first closing, a first subscriber), the entry says so instead of rounding up.';

export const LEDGER: LedgerEntry[] = [
  { slice: 48, date: 'Nov 8, 2026', title: 'Command Center', verified: 'Dashboard hero, briefing line, pipeline flow and money strip rendered from the owner’s real rows (1 lead in play, honest zeros elsewhere).' },
  { slice: 49, date: 'Nov 8, 2026', title: 'Deal Radar + verified sources', verified: 'Radar chips resolve to the real directory entries; three new sources (CWS Marketing, U.S. Marshals, Forfeiture.gov) confirmed at their official sites before being added.' },
  { slice: 50, date: 'Nov 8, 2026', title: 'Assignment Fee Guide', verified: 'Suggested fees computed live in the Deal Analyzer and checked against hand-worked math (house base $10,000, land $5,000, capped at the deal room).' },
  { slice: 51, date: 'Nov 8, 2026', title: 'Direct-mail letter template', verified: 'Template renders with its merge fields; display-only, nothing sends.' },
  { slice: 53, date: 'Nov 8, 2026', title: 'Live Auction Feed (BidProwl)', verified: 'Signed-out requests refused (401); without the key the panel shows its honest not-connected state.', deferred: 'Live lots appear when the platform’s BidProwl key is placed in the hosting environment.' },
  { slice: 54, date: 'Nov 8, 2026', title: 'Distress Radar', verified: 'Counts and heat ranking exercised against a real tagged lead; the heat formula is printed on the panel.' },
  { slice: 55, date: 'Nov 8, 2026', title: 'Pull-the-List Playbooks', verified: 'Cards render in Counties & Title; every routine names its official source.' },
  { slice: 56, date: 'Nov 8, 2026', title: 'Property facts on leads', verified: 'Parcel, year built, and mailing address round-tripped through the form, the import mapper, and the CSV export.' },
  { slice: 57, date: 'Nov 8, 2026', title: 'Your Markets', verified: 'A test market appeared from the owner’s lead county and disappeared when the lead was restored; counts read back in SQL.' },
  { slice: 58, date: 'Nov 8, 2026', title: 'NETR + two playbooks', verified: 'Directory entry confirmed at publicrecords.netronline.com; Propwire and PACER facts checked at the sources (prices and caps) before printing.' },
  { slice: 59, date: 'Nov 8, 2026', title: 'Equity flag', verified: 'Assessed value and liens entered on a real lead produced the equity figure and the thin-equity warning, then were cleared back to blank — proven in SQL.' },
  { slice: 60, date: 'Nov 8, 2026', title: 'Public homepage', verified: 'Signed-out page renders the differentiators, role doors, lessons, pricing, and honest FAQs; the public calculator’s default readings were checked by hand (MAO $150,000, suggested fee $10,000).' },
  { slice: 61, date: 'Nov 8, 2026', title: 'Lead edit', verified: 'Editing a lead through the UI persisted; verification caught a real bug — cleared numeric fields did not save — which was fixed and re-proven in Slice 62.' },
  { slice: 62, date: 'Nov 8, 2026', title: 'Lead Letter + Sign Kit', verified: 'A letter merged from a real lead printed with the window-envelope block; the edit-clear fix proven field by field against SQL.' },
  { slice: 63, date: 'Nov 8, 2026', title: 'Seller questionnaire + honesty band', verified: 'The questionnaire’s answers compose into the lead’s notes — proven end to end when the owner’s seller page took its first test submission (Slice 85 session).' },
  { slice: 64, date: 'Nov 8, 2026', title: 'Referrer lane', verified: 'Full round trip on the owner’s account: role flip, test referral submitted, seen in the admin queue, status changed, reflected back, row deleted, counts restored.' },
  { slice: 65, date: 'Nov 8, 2026', title: 'Screen Guard', verified: 'Viewer-email watermark tiles observed live across the Leads list; copy/context-menu blocks active.' },
  { slice: 66, date: 'Nov 8, 2026', title: 'Seller Trust Signal', verified: 'The owner’s live seller page shows the zero-count trust line verbatim: “New on this platform — no closings counted yet.”' },
  { slice: 67, date: 'Nov 8, 2026', title: 'Deal Autopsy + follow-up streaks', verified: 'Streak line rendered live from real outreach rows; the autopsy form’s gating checked in code and UI.', deferred: 'The first autopsy completes with the first real escrow file — no fake closing was created to test it.' },
  { slice: 68, date: 'Nov 8, 2026', title: 'Direct Amazon SES mail', verified: 'SES identity verified with DKIM and custom MAIL FROM successful; the app reports its mail provider as SES live.', deferred: 'A real test send completes when AWS grants production access (request filed Nov 8, 2026).' },
  { slice: 69, date: 'Nov 8, 2026', title: 'JV Board', verified: 'Posted, listed, closed, and deleted a test JV post on the owner’s account; board returned to empty, counts read back.' },
  { slice: 70, date: 'Nov 8, 2026', title: 'Speed to Lead + match counts', verified: 'The owner’s lead row showed its true age, source, and match line (“no buy boxes on the platform yet”).' },
  { slice: 71, date: 'Nov 8, 2026', title: 'Subscriber Referral Engine', verified: 'Panel, link rules, and admin roster credit column rendered live; the owner’s real referral link activated when her seller page went live.' },
  { slice: 72, date: 'Nov 8, 2026', title: 'Public deal pages that recruit', verified: 'Signed-in and signed-out deal sections and the not-a-real-id path render honestly (no card, no crash).', deferred: 'The shared-deal card completes with the first real public listing.' },
  { slice: 73, date: 'Nov 8, 2026', title: 'Owner Deal Desk', verified: 'Desk lists the owner’s one real lead and the (empty) referrals queue with the attorney-review posture printed on the panel.' },
  { slice: 74, date: 'Nov 8, 2026', title: 'Day-91 Value Receipt', verified: 'Live line read verbatim: “Day 10 of your 90 free days — 1 lead built, 0 contracts signed, $0 in fees on closed deals.”' },
  { slice: 75, date: 'Nov 8, 2026', title: 'Sealed-Office Win-Back', verified: 'An active account shows no lock and no seal panel anywhere (searched the page text).', deferred: 'The seal panel’s first exercise comes with the first genuinely lapsed account — the owner’s status was deliberately not flipped.' },
  { slice: 76, date: 'Nov 8, 2026', title: 'Closing Calendar + Stale-Money Board', verified: 'Month grid navigates Nov → Dec → Nov; the empty-month line and the absent stale board (nothing stale) both confirmed.' },
  { slice: 77, date: 'Nov 8, 2026', title: 'Campaign Tracker', verified: 'Exactly one row rendered, matching the records: “Pasted listing | 1 | 0 | 0 | 0 | 0 | 0 | 0”.' },
  { slice: 78, date: 'Nov 8, 2026', title: 'Kanban Pipeline Board', verified: 'The lead card moved New → Contacted → New by button, with SQL read-back of the status after each move.' },
  { slice: 79, date: 'Nov 8, 2026', title: 'Repair Estimator', verified: 'Arithmetic checked to the dollar: $42,000 default build, $50,500 with a roof, feeding the analyzer’s Repairs field and moving MAO to $149,500.' },
  { slice: 80, date: 'Nov 8, 2026', title: 'Money Paperwork trio', verified: 'Offer letter generated from a real lead with every clause line present; JV split and net sheet figures checked at 50%, 40%, and with expenses.' },
  { slice: 81, date: 'Nov 8, 2026', title: 'Rent-to-Price Flag + FSBO lane', verified: 'Rent $1,800 on asking $150,000 produced “1.20% of asking · ✓ clears the 1% rule” on the lead row, then cleared back to NULL in SQL.' },
  { slice: 82, date: 'Nov 8, 2026', title: 'Tax-Season Export', verified: 'The downloaded closed-deals CSV was opened and contains exactly its header line — the honest export for a zero-closing year.' },
  { slice: 83, date: 'Nov 8, 2026', title: 'Market Watch', verified: 'A distress tag added and removed through the UI moved the card between its rhythm state and the empty state, both directions.' },
  { slice: 84, date: 'Nov 8, 2026', title: 'Lead Photo Attachments', verified: 'A test photo uploaded to a real lead, thumbnailed, and deleted; storage read back empty.', deferred: 'The public seller-photo upload path proves with the first real seller photo.' },
  { slice: 85, date: 'Nov 8, 2026', title: 'Field Capture', verified: 'A test lead saved from the field form landed in Leads and on the Pipeline Board with its capture timestamp, then was deleted.', deferred: 'GPS stamping and dictation prove on the first real phone use.' },
  { slice: 86, date: 'Nov 8, 2026', title: 'Route Board', verified: 'The per-stop Navigate link was read character for character: a real Google Maps directions URL for the lead’s address.' },
  { slice: 87, date: 'Nov 8, 2026', title: 'Buyer Proof Card + Lender Fast Lane', verified: 'A test vendor was pinned into the fast lane, unpinned, and deleted; the owner’s proof card (as a buyer) printed the true zero record — Tier 3, all counts 0.' },
  { slice: 88, date: 'Nov 8, 2026', title: 'Reviews After Closing', verified: 'Schema and render gating verified (the panel exists only on closed files; none exist).', deferred: 'The ask-and-record flow exercises with the first real closed escrow file.' },
  { slice: 89, date: 'Nov 8, 2026', title: 'How We Verify page', verified: 'The public /verify page renders signed-out with all seven sections; footer link click-through confirmed.' },
  { slice: 90, date: 'Nov 8, 2026', title: 'Weekly Report', verified: 'All six panel lines matched a SQL cross-check exactly, including the week’s added lead and the honest zeros.' },
  { slice: 91, date: 'Nov 8, 2026', title: 'Bandit Sign with QR', verified: 'The QR generator was proven against the owner’s real page address before shipping; the preview renders in the Sign Kit with the placement-law caution beside it.' },
  { slice: 92, date: 'Nov 8, 2026', title: 'Billing Portal wiring', verified: 'The Manage Subscription button exercised the real route end to end and returned the honest “No billing account yet” message; Stripe’s Customer Portal confirmed already active on the operator’s account.', deferred: 'The full portal redirect proves with the first real subscriber’s click.' },
  { slice: 93, date: 'Nov 8, 2026', title: 'Forgotten Lists pack', verified: 'All 14 playbook cards render in Counties & Title; the divorce and custody guardrail lines read exactly as written.' },
  { slice: 94, date: 'Nov 8, 2026', title: 'SEO foundation', verified: 'robots.txt and sitemap.xml serve live; canonical, social tags, and the structured data (operator, application, real $150 price, FAQs) confirmed in the served HTML. No rating markup — none has been counted.' },
  { slice: 95, date: 'Nov 8, 2026', title: 'WholesalingOS School', verified: 'All four lessons render at /learn; an unknown lesson returns a true 404; the sitemap carries all nine public URLs.' },
  { slice: 96, date: 'Nov 8, 2026', title: 'My States', verified: 'GA + TX saved from the settings card persisted across reload and moved the Auction Feed’s opening state to GA; restored to no saved states and read back empty in SQL.' },
  { slice: 97, date: 'Nov 8, 2026', title: 'Portal Frame Parity', verified: 'All five role desks visited through the role picker; each shows its framed header band above its own tools; role restored to Wholesaler and confirmed in SQL.' },
  { slice: 98, date: 'Nov 8, 2026', title: 'Verification Ledger', verified: 'The /ledger page renders signed-out with every entry spot-checked (48, 67 with its amber deferral line, 92, 97); the sitemap carries it as the tenth public URL.' },
  { slice: 99, date: 'Nov 8, 2026', title: 'The Charter', verified: 'The /charter page renders signed-out with the never list, the pricing covenant, and the portability guarantee; linked from the homepage footer, the sitemap (eleven URLs), and the How We Verify page.' },
  { slice: 100, date: 'Nov 8, 2026', title: 'Closing Certificates', verified: 'Render gating verified (the certificate block exists only on closed escrow files; none exist, and none was fabricated). The certificate ID derives from the escrow file’s own id and every figure comes from the counted deal record.', deferred: 'The first printed certificate comes with the first real closing.' },
  { slice: 101, date: 'Nov 8, 2026', title: 'Consent Passport', verified: 'Exercised against the owner’s real lead: the passport assembled its actual record — no consent on record, no contact entries, no touches — and printed both gap warnings instead of papering over them. Print and CSV export carry the same record.' },
  { slice: 102, date: 'Nov 8, 2026', title: 'Proof captions', verified: 'Receipt lines render under the Command Center briefing, Your numbers, Speed to Lead, the Closing Calendar, and the Business P&L — each caption naming the records its figures were counted from, checked against its loader before it was written.' },
  { slice: 103, date: 'Nov 8, 2026', title: 'The 10-Minute Audit', verified: 'The /audit page renders signed-out with all ten questions, their tests, and this platform’s answers linking to the machinery (Verify, Charter, Ledger, passport, tiers); the sitemap carries it as the twelfth public URL. The Uncopyable Set is complete.' },
  { slice: 104, date: 'Nov 9, 2026', title: 'Florida state records lookup', verified: 'The Counties view searches the Florida Department of Revenue’s statewide cadastral roll live (all 67 counties, one official service) by address, owner, parcel, or city; a result becomes a lead only on the wholesaler’s tap, stamped “FDOR state records” with the roll year and provenance in its notes, consent unknown. Terms read before building: the roll is Ch. 119 public records the state publishes for public use; the design is live lookup only — nothing bulk-copied, resold, or exported, attribution printed on the panel. First live pass caught address and city modes failing — the state service rejects full-field queries that also ask it to sort — and this entry’s first draft overclaimed “every mode”; both were corrected the same night: sorting moved into the app, parcel matching made whitespace-proof (the roll stores some IDs with doubled spaces), a 30-second guard added, and the route now quotes the service’s own error when it refuses a search.' },
];
