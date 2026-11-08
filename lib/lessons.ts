// Slice 95 — WholesalingOS School. Public lessons that teach the
// real routines this platform is built around. Every lesson
// describes doors and steps that exist — official sources, the
// platform's own buttons — and says plainly where a door does
// not exist. The lessons are the SEO content engine and the
// onboarding course in one: a reader can follow any lesson with
// no account, and the last step of each one is the free trial.

export interface Lesson {
  slug: string;
  icon: string;
  title: string;
  dek: string;
  minutes: number;
  steps: { h: string; body: string[] }[];
  cta: string;
}

export const LESSONS: Lesson[] = [
  {
    slug: 'finding-deals-on-government-websites',
    icon: '🏛️',
    title: 'Finding deals on government websites',
    dek: 'The government sells real estate every week — tax deeds, foreclosures, seized property, surplus land. Here is where those doors actually are, and how a wholesaler works them.',
    minutes: 8,
    steps: [
      {
        h: 'Know the four doors',
        body: [
          'Government property reaches the market through four channels: county tax deed sales (property auctioned for unpaid taxes), court-ordered foreclosure auctions run by the clerk of court, federal seized and forfeited property sold through agencies and their contractors, and surplus government land sold by counties, cities, and agencies that no longer need it.',
          'Each channel has its own calendar, deposit rules, and title quality. None of them is a single national website, and anyone selling you "the government list" as one feed is reselling doors you can open yourself for free.',
        ],
      },
      {
        h: 'Start at your county clerk and tax collector',
        body: [
          'In Florida, the clerk of court publishes foreclosure auction calendars and tax deed sales, usually on the county’s own auction site, and the tax collector publishes the tax certificate and Lands Available lists — property already auctioned that nobody bid on, often available over the counter.',
          'Outside Florida the names change but the shape does not: a clerk, recorder, sheriff, or treasurer runs the sale, and the calendar is a public page. WholesalingOS keeps verified links to these doors for all 67 Florida counties plus a nationwide county-records directory.',
        ],
      },
      {
        h: 'Add the federal doors',
        body: [
          'Federal property is sold through agency channels: HUD and VA foreclosure listings, the U.S. Marshals’ asset forfeiture sales, Treasury’s seized-property contractor, and agency surplus sales. Each has its own site and its own rules; most federal homes are listed with licensed brokers at market value, so the wholesaler’s edge there is speed and diligence, not a secret discount.',
          'The platform’s Deal Radar groups these doors by kind and links out to each official source. It does not copy their listings — the official page is the record, and it is the page you verify before you ever bid.',
        ],
      },
      {
        h: 'Do the diligence before the auction, not after',
        body: [
          'Auction property is sold as-is, often without interior access, and tax deed property can carry liens that survive the sale. Before any bid: pull the parcel on the county property appraiser, check the clerk’s records for liens and the case file, and run your numbers with the repair reality of a house you may not have walked through.',
          'Set your maximum bid from the math — after-repair value, minus repairs, minus your fee, minus the costs the sale type leaves on you — and let the auction keep anything above it.',
        ],
      },
      {
        h: 'Win or lose, keep the record',
        body: [
          'Properties you researched and did not win are not wasted work: they are your market file. Wholesalers who log the parcel, the sale result, and the buyer’s name build the county knowledge that wins the next one.',
        ],
      },
    ],
    cta: 'WholesalingOS keeps the doors, the radar, and your records in one office. Start your 90 days free and work your first auction calendar this week.',
  },
  {
    slug: 'finding-off-market-property-from-official-records',
    icon: '🗂️',
    title: 'Finding off-market property from official records',
    dek: 'Off-market does not mean secret. It means the signal is sitting in a public record — a filing, a case, a list — before it becomes a listing. This is the routine for reading those signals.',
    minutes: 9,
    steps: [
      {
        h: 'The signals are filings, not secrets',
        body: [
          'A lis pendens says a foreclosure has started. A probate filing says a family now holds a house it may not want. A code violation says a property is costing its owner money and attention. A tax delinquency list says the county will eventually sell the debt — or the deed. A divorce filing sometimes means a house has to be divided.',
          'Every one of those is a public record at your county clerk, court, code enforcement office, or tax collector. The wholesaler’s skill is not finding a hidden database; it is pulling the right list on a rhythm and working it lawfully.',
        ],
      },
      {
        h: 'Pull one list at a time, by hand',
        body: [
          'Open the clerk’s official records search, set the document type (LP for lis pendens, for example), set the last 30 days, and work the results: owner name, property address or parcel, the filer. Run each parcel through the property appraiser for the owner’s mailing address — the difference between the property address and the mailing address is the classic absentee signal.',
          'There is no free county API streaming these lists into anyone’s software — that product is a paid data license. The record itself is free, and pulling it yourself is what keeps your list accurate and your outreach lawful.',
        ],
      },
      {
        h: 'Tag what you observed, with the date',
        body: [
          'A lead is worth what you know about it. Record the signal as a distress tag with the date you observed it — pre-foreclosure, probate, vacant, tax delinquency — and the platform turns your tags into a work order: a call queue sorted by follow-ups and signals, a market watch that tells you when each list is due to be pulled again.',
          'Never record what you did not see. An estimated signal presented as an observed one poisons every decision after it.',
        ],
      },
      {
        h: 'Contact like a person, because the law requires it',
        body: [
          'Finding a name in a public record does not create consent to call or text them. The lawful pattern: mail a letter to the property or the owner’s mailing address — letters are how this business has always started — and let interested owners contact you, through your seller page, where their consent is recorded when they hand you their number themselves.',
          'Calls and texts follow consent and do-not-contact rules, and every opt-out is honored the second it lands. WholesalingOS enforces that on every in-app send; the routine above is designed so you never need a shortcut.',
        ],
      },
    ],
    cta: 'The playbooks for each list — probate, tax deed, code violations, divorce, evictions, and more — are inside the office, next to the import inbox and the call queue. Start your 90 days free.',
  },
  {
    slug: 'fire-damaged-houses-the-honest-lesson',
    icon: '🔥',
    title: 'Fire-damaged houses: the honest lesson',
    dek: 'You will see pitches promising a list of fire-damaged houses from fire departments. That list does not exist. Here is what does — and how wholesalers actually find burned houses.',
    minutes: 6,
    steps: [
      {
        h: 'The claim, and why it fails',
        body: [
          'The pitch goes: fire departments respond to every house fire, so their records are a ready-made seller list, and some software "unlocks" it. Fire departments do write incident reports — but there is no wholesaler list, no department publishes addresses for marketers, and no feed exists to plug into software.',
          'Any tool claiming a live fire-damage list is either scraping incident data in ways its sources do not allow, or dressing up ordinary distress data with a dramatic label. Both are reasons to keep your name off that account.',
        ],
      },
      {
        h: 'Real source one: code enforcement and vacant registries',
        body: [
          'A burned house quickly becomes a code case — unsafe structure, boarded, unfit for occupancy — and many cities publish open code cases or run vacant-property registries that include fire-damaged homes. That is the same door as the code-violation playbook, and it is a public record you can pull yourself.',
        ],
      },
      {
        h: 'Real source two: the incident report, by request',
        body: [
          'When you already know about a specific fire — from a code case, a drive-by, a neighbor, the local news — the fire incident report for that address is a public record in most states, available by a public-records request to the department or the city clerk. It confirms the date and extent of damage for a property you are already working.',
          'That is case-by-case verification, not a list. The request costs little or nothing, takes days, and gives you a fact instead of a rumor.',
        ],
      },
      {
        h: 'Real source three: your own eyes',
        body: [
          'Driving for dollars finds burned houses the way it finds every distressed house: boarded windows, tarped roofs, the specific look of a house the neighborhood walks around. Log it in the field with the address and what you saw, then pull the owner from the appraiser like any other lead.',
          'And approach the owner with care: a fire is a loss, often recent. The letter is short, plain, and patient — you buy houses in any condition, on their timeline — and it goes to the mailing address, never as a knock on a burned door.',
        ],
      },
      {
        h: 'Price fire damage like fire damage',
        body: [
          'Burned houses carry smoke and water damage beyond the charred rooms, possible structural compromise, and insurance-claim complications. Estimate heavy or gut-level repairs unless a contractor who has walked it says otherwise, and let the math — not the discount you hope for — set your offer.',
        ],
      },
    ],
    cta: 'WholesalingOS teaches the doors that exist and names the ones that do not. Start your 90 days free and work the real sources.',
  },
  {
    slug: 'from-a-found-property-to-your-lead-sheet',
    icon: '📥',
    title: 'From a found property to your lead sheet',
    dek: 'You found a property — at the clerk, on a drive, in a list you pulled. This lesson is the exact path it takes onto your lead sheet, with the buttons that already exist.',
    minutes: 5,
    steps: [
      {
        h: 'One property? Add it directly',
        body: [
          'The Add Lead form takes the property address, city, state, ZIP, and county, the owner’s name, and the owner’s mailing address when the appraiser shows one. Add the parcel ID and year built when you have them — the parcel is your diligence key for every later check.',
          'If the property came from a listing someone sent you, paste the listing text instead and let the parser pull out only what the text actually states — it leaves blanks blank rather than guessing.',
        ],
      },
      {
        h: 'A whole list? Import it in one drop',
        body: [
          'Lists you pulled from official records, or exported from your own account at a list tool, import as CSV in one drop: the importer maps the columns it knows — parcel, assessed value, liens, rent, asking price — dedupes against your existing leads, and stamps the batch with its source.',
          'The source stamp is not decoration. Six months from now, your campaign tracker will tell you which source produced conversations and closings, and which produced paper.',
        ],
      },
      {
        h: 'In the field? Capture it where you stand',
        body: [
          'Field Capture is the fast form for driving for dollars: big fields, address first, a location stamp only when you tap for it, dictation where your browser supports it. Add the route board and the day’s stops become a single maps route, worked in order.',
        ],
      },
      {
        h: 'Tag it, then let the office sort the work',
        body: [
          'Tag the signal you observed and set a follow-up date. From there the machinery takes over: the lead appears on your pipeline board, the distress radar ranks your morning’s work with its formula printed on it, and the weekly report shows what actually got done.',
          'Run the numbers before you spend a dollar on outreach: the deal analyzer’s MAO math, the repair estimator, and the equity flag tell you whether this property deserves a letter, a call, or a pass.',
        ],
      },
    ],
    cta: 'Every button in this lesson is live in the office today. Start your 90 days free and put your first found property on the sheet.',
  },
];

export function lessonBySlug(slug: string): Lesson | null {
  return LESSONS.find((l) => l.slug === slug) || null;
}
