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
