'use client';

// Slice 55 — Pull-the-List playbooks. Counties do not offer a free
// API that streams probate, pre-foreclosure, or tax lists into
// anyone's software — that product is a paid data contract
// (ATTOM, PropStream), full stop. What IS free, in every county,
// is the official record itself, and pulling it is a 15-minute
// routine once you know the clicks. These cards are that routine,
// one per distress type, written from the standard clerk /
// appraiser / tax-collector workflow. The wholesaler pulls the
// list from the official source — that is what keeps it lawful
// and accurate — then the platform takes over: import, tags,
// call queue, contracts. The county links at the top of this
// view (and on every lead's Research panel) open the exact
// official pages named in the steps.

const CARDS: { icon: string; title: string; tag: string; steps: string[] }[] = [
  {
    icon: '⚖️',
    title: 'Pre-foreclosure — Lis Pendens',
    tag: 'Tag it: Pre-foreclosure',
    steps: [
      'Open your county Clerk of Court official records search (linked above).',
      'Leave the name fields blank; set Document Type to LP / Lis Pendens and the date range to the last 30 days.',
      'Open each filing: property owner name, property address or parcel ID, and the bank (plaintiff) that filed.',
      'Add each property as a lead (or import the list) and tag it Pre-foreclosure with today\u2019s date as the observed date.',
    ],
  },
  {
    icon: '🧾',
    title: 'Tax deed & Lands Available',
    tag: 'Tag it: Tax delinquency / lien',
    steps: [
      'Open the county tax deed sale page (clerk / tax collector — linked above) and find the Lands Available list: properties already auctioned that nobody bid on.',
      'Download or copy the list with its parcel IDs.',
      'Run each parcel ID through the county Property Appraiser to get the owner\u2019s name and mailing address.',
      'Import the list, tag Tax delinquency, and note the amount owed in the lead notes when the list shows it.',
    ],
  },
  {
    icon: '🕊️',
    title: 'Probate & inherited property',
    tag: 'Tag it: Probate / inherited',
    steps: [
      'Open the Clerk\u2019s court records / probate division search for recent estate filings in your county.',
      'Note the deceased owner, the personal representative (often a family member), and any property address in the filing.',
      'Add the property as a lead and tag Probate / inherited with the filing date you observed.',
      'Approach gently and late, not first: the Probate script in your template library is written for exactly this conversation.',
    ],
  },
  {
    icon: '🚧',
    title: 'Code violations',
    tag: 'Tag it: Code violation',
    steps: [
      'Open your city or county code enforcement portal (many publish open cases; where yours does not, the case list is a free public-records request).',
      'Filter to open cases in your target ZIPs — tall grass, boarded, and unsafe-structure cases are the motivated end of the list.',
      'Cross-reference the address on the Property Appraiser for the owner and mailing address.',
      'Add as leads, tag Code violation, and record the case type in the notes.',
    ],
  },
  {
    icon: '🏚️',
    title: 'Vacant & out-of-state owners',
    tag: 'Tag it: Vacant · Out-of-area owner',
    steps: [
      'Start from any list you already lawfully hold — your imports, your driving-for-dollars notes, stale listings.',
      'On the Property Appraiser, compare the property address to the owner\u2019s mailing address: a different state is the classic absentee signal. Your lead rows flag it automatically once both states are entered (📬).',
      'Confirm vacancy with your own eyes on a drive-by — never from a database guess — and note what you saw.',
      'Tag Vacant and/or Out-of-area owner with the date you observed it.',
    ],
  },
  {
    icon: '🧲',
    title: 'Build a list on Propwire, work it here',
    tag: 'Tag it: Probate / inherited · Pre-foreclosure · Vacant',
    steps: [
      'Open your OWN free Propwire account (propwire.com — the Basic tier is free, no card). WholesalingOS does not connect to Propwire and never holds its data — your account, your export.',
      'Search your state or county and set the Lead Type — Probate/Inherited, Pre-foreclosure, Vacant or Absentee, among their 21 lead types. (Their own pages state a 10,000-download cap for free Basic accounts; the period differs between their FAQ and their Terms, so treat 10,000 per period as the ceiling, not a promise.)',
      'Download the CSV with the Property & Ownership and Tax columns chosen. Their FAQ promises "Property & Ownership Details" at minimum — open the file and confirm the owner mailing columns are there before you build a mailing on it.',
      'Drop the CSV into the Import Inbox here: parcel IDs, addresses and mailing fields land as real lead fields, duplicates are caught, and the list source is stamped. Tag the batch with the matching distress tags and work the Call Queue.',
      'Skip tracing inside Propwire is Propwire’s own paid add-on (10¢ per successful match, inside your own account, under their terms) — it is not a WholesalingOS feature, and the platform never receives or stores those numbers.',
    ],
  },
  {
    icon: '💵',
    title: 'Build your cash buyer list',
    tag: 'Buyers live in the Buyers desk — this card is sourcing',
    steps: [
      'Your strongest buyers are the ones who already closed with you: the platform counts their closings and tiers them automatically (Tier 1 = 3+). Sourcing fills the top of that funnel.',
      'On your own Propwire account, clear the distress filters and set Lead Type to Cash Buyer with Ownership = Corporate/LLC in your ZIPs. Export the CSV; the companies actively buying for cash near your deals are your call list.',
      'Add the real ones in the Buyers desk with their areas, property types and budget. Their buy box is what matches your future listings — a buyer with no buy box matches nothing.',
      'Offline still works: local investor meetups and REIA groups are where active local buyers introduce themselves. Add the ones you meet the same way.',
      'Never buy or import a "national cash buyer database" — the buyers who count are the ones who registered, gave you their criteria, and close. This platform proves buyers by their record, not by a list someone sold you.',
    ],
  },
  {
    icon: '🏛️',
    title: 'Bankruptcy filings — PACER',
    tag: 'No dedicated tag — note the case on the lead',
    steps: [
      'Open your own PACER account (pacer.uscourts.gov). Records cost $0.10 per page, capped at $3 per document — and fees are WAIVED when your quarter totals $30 or less, which covers a working wholesaler’s searching.',
      'Search your federal district for recent Chapter 7 and Chapter 13 filings in your counties. A filing whose schedules list real property is a public-record lead like any other.',
      'Add the property as a lead with the case number and chapter in the notes and a gentle follow-up date. Bankruptcy property sits under court rules, so a letter offers help and information — never pressure.',
      'This is a manual, case-by-case search by design: PACER is the federal courts’ records system, not a list seller, and bulk pulling is not what it exists for.',
    ],
  },
];

export default function ListPlaybooks() {
  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>📋 Pull-the-List Playbooks</h2>
      <p style={{ fontSize: 13.5, color: '#cbd5e1', maxWidth: 880 }}>
        There is no free county API that streams these lists into software — anyone who tells you otherwise is
        selling you one. What is free is the official record, and pulling it is a 15-minute routine. These are
        the routines. You pull the list from the official source, which keeps it lawful and accurate; the
        platform does the rest — import, dedupe, tags, call queue, contracts.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {CARDS.map((c) => (
          <div key={c.title} style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{c.icon} {c.title}</div>
            <ol style={{ margin: '10px 0', paddingLeft: 20, fontSize: 13.5, color: '#cbd5e1' }}>
              {c.steps.map((s) => <li key={s.slice(0, 24)} style={{ marginBottom: 6 }}>{s}</li>)}
            </ol>
            <div style={{ fontSize: 12.5, color: '#6ee7b7', fontWeight: 600 }}>{c.tag}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
