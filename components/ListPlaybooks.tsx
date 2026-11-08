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
  {
    icon: '🏷️',
    title: 'FSBO & expired listings',
    tag: 'Tag expired ones “Stale listing” · Script: FSBO (for sale by owner)',
    steps: [
      'FSBO sellers are already raising their hand — they listed the house themselves. Browse the for-sale-by-owner listings in your market by hand (the listing sites’ FSBO pages, Craigslist, local classifieds), and write down the address, the asking price, and any rent figure the listing states.',
      'Expired MLS listings live with agents, not on a public shelf: partner with one or two local agents who will share their own expireds where their brokerage allows, in exchange for first look at the deals you cannot use.',
      'Add each property as a lead with the asking price entered — if it is rented, the rent too — and the rent-to-price flag on the lead row does the 1% rule math for your landlord buyers.',
      'Work FSBO sellers with the FSBO script in the Comms Center templates: you are offering a cash alternative alongside their listing, not talking them out of it. Tag expired listings “Stale listing” so they surface in your call queue, and note the listing’s end date in the lead.',
    ],
  },
  {
    icon: '💍',
    title: 'Divorce filings',
    tag: 'Tag it: Divorce / partition',
    steps: [
      'Open the Clerk of Court’s family-law / dissolution filings for your county (the same official-records door linked above) and scan recent filings for cases involving real property.',
      'Note the property address from the filing or by cross-referencing the parties’ names on the Property Appraiser — you are looking for a house that may need to be sold to settle the case.',
      'Add the property as a lead and tag Divorce / partition with the date you observed the filing.',
      'Mail only to the property address or the owner’s mailing address of record, and never mention the divorce, the filing, or the other party in anything you send. The letter is the plain one: you buy houses, in any situation, on their timeline. Two people are going through enough without a wholesaler narrating it back to them.',
    ],
  },
  {
    icon: '🔑',
    title: 'Eviction filings — tired landlords',
    tag: 'The landlord is the lead — there is no tenant tag, on purpose',
    steps: [
      'Open the Clerk’s eviction (unlawful detainer) docket for your county and look at who is FILING, not who is being filed on: every plaintiff is a landlord who just paid court costs to remove a tenant.',
      'Cross-reference the plaintiff’s name on the Property Appraiser to find the rental property and the landlord’s mailing address.',
      'Add the PROPERTY as a lead with the landlord as the owner, and note “landlord — recent eviction filing” in the notes. Never add the tenant to anything.',
      'Your offer to a landlord is different from an offer to a homeowner: a rent-ready house they are tired of is a burden you can lift — price it with the Rental Analyzer (rent, cap rate, DSCR) so you can sell it to your landlord buyers.',
    ],
  },
  {
    icon: '📌',
    title: 'Judgments & liens',
    tag: 'Record the total in the lead’s liens field',
    steps: [
      'Search the Clerk’s official records for money judgments and lien filings against property owners in your ZIPs (judgments, HOA liens, municipal liens, mechanics liens).',
      'Cross-reference the owner on the Property Appraiser for the property and mailing address, and total what the records actually show — one judgment is a fact; a stack of them is a motivated seller.',
      'Enter the total in the lead’s liens / mortgage field: the equity flag on the row does the math against the assessed value and warns you when the equity is too thin to spend money on.',
      'Verify figures against the clerk’s own record before you rely on them — third-party lien lists are stale and often wrong, and your offer math is only as good as the record it came from.',
    ],
  },
  {
    icon: '🤝',
    title: 'Referral partners — people who meet sellers first',
    tag: 'Partners live in the Lenders & Vendors directory',
    steps: [
      'Some of the best leads never reach a list: the probate attorney settling an estate, the divorce attorney dividing a house, the agent holding an expired listing, the estate-sale company clearing a home, the property manager whose owner wants out.',
      'Build the relationship list the same way you build a buyer list: meet them, explain plainly what you do (you buy as-is, cash, on the seller’s timeline), and add them in the Lenders & Vendors directory with a note on who they are.',
      'Send value first — a deal you cannot use, a buyer for their client’s other property, a name they needed. Referrals follow usefulness, not asking.',
      'Keep money out of it unless it is lawful and documented: fee-splitting with attorneys and licensed agents is restricted in many states and professions. Reciprocal referrals are the safe default, and any paid arrangement gets legal advice first — that is a rule, not a preference.',
    ],
  },
  {
    icon: '🔒',
    title: 'Owners in custody — the careful card',
    tag: 'No tag. Mail only to the property address — never to a facility',
    steps: [
      'First, what does not exist: there is no nationwide feed of arrested or jailed homeowners, and this platform will never pull one. Arrest is not conviction, most counties keep their own separate jail roster, and commercial use of criminal records is restricted by state law — a pasted pitch promising this list is promising you a violation.',
      'What exists is narrower: when you ALREADY have a reason to look at one specific property — a vacant house, a code case, a tax record — a county jail roster is a public record you can check by hand for that one name, in that one county.',
      'If the owner of record is in custody, the only lawful, decent move is a plain letter mailed to the PROPERTY address or the owner’s mailing address of record — the same letter you send anyone. It reaches family or forwards like any mail.',
      'Never contact anyone at a jail or prison, never mention custody or charges in outreach, and check your state’s rules on using criminal records in business before making this a routine. One hand-check on a property you already work is research; anything at scale is a data product you do not have.',
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
