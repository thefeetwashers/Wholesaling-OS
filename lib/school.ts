import { supabase, supabaseConfigured } from './supabase';

// Slice 122 — WholesalingOS School 7-Day Deal Launch Bootcamp.
// The curriculum is drawn ONLY from material the platform already
// teaches: the lessons wall on the homepage, the /learn lessons,
// the Pull-the-List playbooks, the 12 call & letter scripts, the
// calculators, the escrow desk, and the funding flow. No new legal
// or financial claims, no invented statistics. Each lesson ends at
// the same door — the 90-day free trial. Progress lives in
// school_progress (one row per user per day); the Verified Operator
// badge is set only on the day-7 row when the Day 7 quiz is passed,
// and means exactly "completed the 7-day bootcamp and passed the
// Day 7 check" — never a license or regulatory certification.

export interface BootcampStep {
  h: string;
  body: string[];
}

export interface BootcampDay {
  day: number;
  slug: string;
  icon: string;
  title: string;
  dek: string;
  minutes: number;
  steps: BootcampStep[];
  links: { label: string; href: string }[];
}

export const BOOTCAMP: BootcampDay[] = [
  {
    day: 1,
    slug: 'day-1-buyers-first-deals-second',
    icon: '💵',
    title: 'Buyers First, Deals Second',
    dek: 'How to build a real cash-buyer buy box before pulling a single list — because a contract with no buyer is a liability with a deadline.',
    minutes: 6,
    steps: [
      {
        h: 'A contract with no buyer is a liability with a deadline',
        body: [
          'Most contracts are signed on the fifth to twelfth conversation, not the first — and a deal nobody wants teaches an expensive lesson. Enter your buyers and their buy boxes BEFORE you chase sellers. The platform matches from criteria, so a deal that matches a real buyer is a deal you can actually move.',
          'Your first job is not a list. It is a room full of buyers who have told you, in writing, what they buy, where, and for how much.',
        ],
      },
      {
        h: 'Publish a buy box, not a wish',
        body: [
          'A buy box states the property types, the cities and states, and the price range a buyer will actually close on. Cash buyers register free on WholesalingOS, publish their buy box, and get matched to deals by area and criteria.',
          'A buyer’s tier on this platform is earned from closings the platform itself counted — never bought, never self-declared. That is the record you are building toward, one closed deal at a time.',
        ],
      },
      {
        h: 'Then pull your first list',
        body: [
          'Once buyers are waiting, the lists in Day 2 have somewhere to go. A lead that matches a buy box is a lead with a buyer attached — work those first, every morning.',
        ],
      },
    ],
    links: [
      { label: 'See how buyer tiers are earned', href: '/learn/finding-off-market-property-from-official-records' },
      { label: 'Run your first deal’s numbers', href: '/' },
    ],
  },
  {
    day: 2,
    slug: 'day-2-official-county-records-playbook',
    icon: '🗂️',
    title: 'Official County Records Playbook (All 67 Florida Counties & Nationwide)',
    dek: 'Step-by-step guides to pulling lis pendens, probate, tax deeds, and code violations directly from official county clerks — without scraped lists.',
    minutes: 9,
    steps: [
      {
        h: 'The signals are filings, not secrets',
        body: [
          'A lis pendens says a foreclosure has started. A probate filing says a family now holds a house it may not want. A code violation says a property is costing its owner money and attention. A tax delinquency list says the county will eventually sell the debt — or the deed.',
          'Every one of those is a public record at your county clerk, court, code enforcement office, or tax collector. The wholesaler’s skill is not finding a hidden database; it is pulling the right list on a rhythm and working it lawfully.',
        ],
      },
      {
        h: 'Pull one list at a time, by hand',
        body: [
          'Open the clerk’s official records search, set the document type, set the last 30 days, and work the results: owner name, property address or parcel, the filer. Run each parcel through the property appraiser for the owner’s mailing address — the difference between the property address and the mailing address is the classic absentee signal.',
          'WholesalingOS keeps verified links to these doors for all 67 Florida counties plus a nationwide county-records directory, and the Pull-the-List playbooks inside the office walk each list — probate, tax deed, lis pendens, code violations, divorce, evictions — one at a time.',
        ],
      },
      {
        h: 'Tag what you observed, with the date',
        body: [
          'A lead is worth what you know about it. Record the signal as a distress tag with the date you observed it, and the platform turns your tags into a work order: a call queue sorted by follow-ups and signals, and a market watch that tells you when each list is due to be pulled again.',
          'Never record what you did not see. An estimated signal presented as an observed one poisons every decision after it.',
        ],
      },
      {
        h: 'Government auctions are doors, not a feed',
        body: [
          'The government sells real estate every week — tax deeds, foreclosures, seized property, surplus land — through the county clerk, the tax collector, and federal agency channels. Each channel has its own calendar, deposit rules, and title quality, and none of them is a single national website.',
          'Auction property is sold as-is, often without interior access, and tax deed property can carry liens that survive the sale. Before any bid: pull the parcel on the county property appraiser, check the clerk’s records for liens and the case file, and set your maximum bid from the math.',
        ],
      },
    ],
    links: [
      { label: 'Finding deals on government websites', href: '/learn/finding-deals-on-government-websites' },
      { label: 'Finding off-market property from official records', href: '/learn/finding-off-market-property-from-official-records' },
    ],
  },
  {
    day: 3,
    slug: 'day-3-running-real-deal-math',
    icon: '🧮',
    title: 'Running Real Deal Math (70% Rule, MAO & DSCR)',
    dek: 'An interactive walkthrough using WholesalingOS’s built-in calculators — the same math the office runs on every deal.',
    minutes: 7,
    steps: [
      {
        h: 'The 70% rule and your Maximum Allowable Offer',
        body: [
          'MAO = (ARV × 70%) − repairs − your fee. Offer above it and the deal stops working for everyone. The platform’s floor is $10,000 on a house and $5,000 on land, always capped by the room actually in the deal.',
          'Run it on the homepage calculators before you ever sign up — your numbers never leave the page. Then run it again inside the office on a real lead, where the repair estimator and the equity flag fill the same fields from the record.',
        ],
      },
      {
        h: 'Split it, then net it',
        body: [
          'JV deals split the fee; every deal loses a little to referrals and costs. Run both before you celebrate either. Assignment income is ordinary income — the net sheet shows what you kept, and the habit that separates businesses from hobbies is moving the tax share out the same week you are paid.',
        ],
      },
      {
        h: 'Selling to a landlord? The 1% rule and DSCR',
        body: [
          'Rent-to-price of 1.00% or better is the classic landlord screen. DSCR — the rent covering the loan payment — is what lenders want at 1.20 or better. The rental analyzer inside runs it with every cost, not just the headline rent.',
          'A DSCR or bridge loan request goes only to verified partner lenders whose lending box covers your state and program — and only the packet you chose to share ever leaves your office.',
        ],
      },
    ],
    links: [
      { label: 'Run the calculators on the homepage', href: '/' },
      { label: 'From a found property to your lead sheet', href: '/learn/from-a-found-property-to-your-lead-sheet' },
    ],
  },
  {
    day: 4,
    slug: 'day-4-compliant-outreach-and-consent-rules',
    icon: '📞',
    title: 'Compliant Outreach & Consent Rules',
    dek: 'How to use the 12 call & letter scripts lawfully — without robocall or TCPA fines.',
    minutes: 6,
    steps: [
      {
        h: 'Finding a name does not create consent',
        body: [
          'Finding a name in a public record does not create consent to call or text them. The lawful pattern: mail a letter to the property or the owner’s mailing address — letters are how this business has always started — and let interested owners contact you, through your seller page, where their consent is recorded when they hand you their number themselves.',
          'Calls and texts follow consent and do-not-contact rules, and every opt-out is honored the second it lands. WholesalingOS enforces that on every in-app send.',
        ],
      },
      {
        h: 'The scripts are yours to use, in your own voice',
        body: [
          'The office carries 12 call and letter scripts with the merge fields filled from the lead in front of you — intro, code violation, probate, tired landlord, FSBO, follow-up drips, realtor outreach, the direct-mail letter, and a human call script you make yourself, on your own phone.',
          'Call in your own voice. AI-generated voices are "artificial" under the TCPA (FCC, February 2024) and need the other party’s prior express consent. Florida is two-party consent for recording (Florida Statutes §934.03).',
        ],
      },
      {
        h: 'The blocklist is a hard stop',
        body: [
          'The outreach composer refuses to prepare a message until the server-side blocklist check answers "clear". An unconfigured or failed check pauses outreach instead of skipping it — a fail-closed rule, on purpose. The only hard stop on this platform is the Do Not Contact list, which is a legal one.',
          'Courtesy holds are different: a lead tagged probate or inherited carries a 45-day courtesy hold, and fire damage carries 21 days. They are a courtesy convention, never a hidden block — the channels still open, and reaching out anyway is your choice, logged like any other outreach.',
        ],
      },
    ],
    links: [
      { label: 'Finding off-market property from official records', href: '/learn/finding-off-market-property-from-official-records' },
      { label: 'Fire-damaged houses: the honest lesson', href: '/learn/fire-damaged-houses-the-honest-lesson' },
    ],
  },
  {
    day: 5,
    slug: 'day-5-equitable-interest-and-assignment-contracts',
    icon: '📝',
    title: 'Equitable Interest & Assignment Contracts',
    dek: 'How to market your contract rights legally — never advertising a house you don’t own — with attorney-review flags on every document.',
    minutes: 6,
    steps: [
      {
        h: 'You market your interest, never the house',
        body: [
          'You do not own the property; you hold equitable interest under a contract. Every public listing here says exactly that. Advertising a house as if it were yours is how wholesalers meet regulators.',
          'A buyer is purchasing your contract rights, not the property itself. Every listing the platform shows carries that disclosure, and it tells the buyer to verify all figures with the wholesaler and the title company before sending any funds.',
        ],
      },
      {
        h: 'Contracts are tools, not legal advice',
        body: [
          'The contract engine builds purchase agreements, assignments, and the title packet from your real deal, with signing inside the platform and an audit trail of typed-name signatures with timestamps. Every clause carries an attorney-review flag — contracts are tools, not legal advice.',
          'The B–C assignment can only be signed after the seller’s A–B agreement is signed. The platform enforces that order, and the seller sees their price only — never your assignment fee.',
        ],
      },
      {
        h: 'Keep the record straight',
        body: [
          'Every figure on a contract comes from the deal record — contract price, assignment fee, EMD, dates. If a number is not in the record, the document says so rather than inventing it. That is what makes the paperwork survive inspection.',
        ],
      },
    ],
    links: [
      { label: 'How we verify — the platform’s proof standard', href: '/verify' },
      { label: 'The Charter — what this platform will never do', href: '/charter' },
    ],
  },
  {
    day: 6,
    slug: 'day-6-double-close-and-transactional-funding',
    icon: '🏦',
    title: 'Mastering the Double Close & Transactional Funding',
    dek: 'How to close deals when sellers or HOAs restrict assignments, using the platform’s transactional funding desk.',
    minutes: 7,
    steps: [
      {
        h: 'Have the double-close answer ready',
        body: [
          'Some sellers, lenders, and HOAs restrict assignments. Knowing your double-close path — and what it costs — before you sign keeps one clause from killing a funded deal.',
          'In a double close, the wholesaler buys from the seller (A–B) and sells to the end buyer (B–C) the same day, at the same title company. The assignment fee becomes a spread between the two closings instead of a fee on an assignment.',
        ],
      },
      {
        h: 'Transactional funding is direct from the operator',
        body: [
          'Transactional funding — the 1–3 day money for a double close — comes direct from The Feet Washers, Inc. through the platform’s Capital & Lending desk. The request is opt-in, commercial only, to active business entities, for non-owner-occupied investment property — never a personal residence, never a consumer loan.',
          'The funding packet contains only what you chose to share. Your leads, seller contacts, and assignment fees are never in it. The wire releases only when both closings fund at the same title company, and the money returns by 5:00 PM EST if they do not.',
        ],
      },
      {
        h: 'Fix-and-flip, bridge, and DSCR go to the ISO network',
        body: [
          'Longer money — fix-and-flip, bridge, and DSCR — goes only to verified partner lenders whose lending box covers your state and program. A lender must accept the partner agreement before the operator verifies them, and the database refuses verification without it.',
          'Nothing here is a funding commitment. Have your own attorney review any loan documents before you sign them, and no upfront borrower fee is ever charged for a request.',
        ],
      },
    ],
    links: [
      { label: 'Start your 90 days free — request funding inside', href: '/' },
      { label: 'How we verify', href: '/verify' },
    ],
  },
  {
    day: 7,
    slug: 'day-7-title-search-emd-deadlines-and-closing-table-payouts',
    icon: '🏛️',
    title: 'Title Search, EMD Deadlines & Closing Table Payouts',
    dek: 'Ordering title early, tracking escrow, and setting aside taxes on assignment income — the last mile to a funded closing.',
    minutes: 7,
    steps: [
      {
        h: 'Order title early',
        body: [
          'Liens, judgments, open permits, and ownership surprises surface at the title search — in week one, or at the closing table. Early title turns a killed deal into a cheap lesson instead of a blown closing.',
          'The escrow tracker counts EMD and closing dates down in front of you, and the closing checklist is derived from your real file — contract signed, EMD received, title search ordered, commitment received, closing scheduled, closed and funded.',
        ],
      },
      {
        h: 'EMD dates are real money',
        body: [
          'Miss an earnest-money deadline and the deposit is gone, however good the deal was. The EMD countdown is set by you, by hand, and the platform counts it down — a deadline that passes without the EMD marked received is flagged for attention, not quietly forgotten.',
          'Before closing, bind the vacant or landlord insurance your lender requires. Fix-and-flip and DSCR lenders will not release the wire without it.',
        ],
      },
      {
        h: 'Get paid, then set the tax money aside',
        body: [
          'At the closing table the payout is price plus fee minus referral — the net the escrow desk shows before you ever get there. The scout or referrer who brought the deal is paid $1,000 at the table when it closes and funds, recorded on the deal itself.',
          'Assignment income is ordinary income. The deal net sheet shows what you kept; moving the tax share out of your spending account the same week is the habit that separates businesses from hobbies.',
        ],
      },
    ],
    links: [
      { label: 'Fire-damaged houses: the honest lesson', href: '/learn/fire-damaged-houses-the-honest-lesson' },
      { label: 'The Verification Ledger', href: '/ledger' },
    ],
  },
];

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  why: string;
}

// Day 7 check: 5 questions, drawn only from this bootcamp's
// lessons. Pass mark is 4 of 5, stated on the quiz itself.
export const DAY7_QUIZ: QuizQuestion[] = [
  {
    question: 'What is the Maximum Allowable Offer (MAO) formula?',
    options: [
      'ARV × 70% − repairs − your fee',
      'ARV − contract price + your fee',
      'ARV × 90% − repairs',
      'Contract price + assignment fee',
    ],
    answer: 0,
    why: 'Day 3: MAO = (ARV × 70%) − repairs − your fee. Offer above it and the deal stops working for everyone.',
  },
  {
    question: 'When you wholesale a house, what are you marketing?',
    options: [
      'The house itself, as if you owned it',
      'Your equitable interest — your contract rights — never the house',
      'The seller’s mortgage',
      'The title company’s services',
    ],
    answer: 1,
    why: 'Day 5: you hold equitable interest under a contract. Advertising a house as if it were yours is how wholesalers meet regulators.',
  },
  {
    question: 'What happens if you miss the EMD deadline?',
    options: [
      'Nothing — deadlines are suggestions',
      'The title company extends it automatically',
      'The deposit can be gone, however good the deal was',
      'The seller pays your fee instead',
    ],
    answer: 2,
    why: 'Day 7: EMD dates are real money. Miss the deadline and the deposit is gone.',
  },
  {
    question: 'When is the scout / referrer $1,000 earned?',
    options: [
      'The moment a property is submitted',
      'When a wholesaler claims the lead',
      'Only when the deal closes and funds',
      'When the contract is signed',
    ],
    answer: 2,
    why: 'Day 7: the scout or referrer is paid $1,000 at the table when the deal closes and funds — nothing is owed for a deal that doesn’t close.',
  },
  {
    question: 'Before you call or text a seller, what do you need?',
    options: [
      'Their address from any list you bought',
      'Their consent — or a lawful basis — with every opt-out honored the second it lands',
      'A script, and nothing else',
      'Their phone number from a data broker',
    ],
    answer: 1,
    why: 'Day 4: finding a name in a public record does not create consent to call or text them.',
  },
];

export const DAY7_PASS_MARK = 4;

export interface SchoolProgress {
  id?: string;
  user_id?: string;
  day_number: number;
  completed_at?: string | null;
  verified_operator_badge?: boolean;
}

export async function loadMySchoolProgress(userId: string): Promise<SchoolProgress[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('school_progress')
    .select('id, user_id, day_number, completed_at, verified_operator_badge')
    .eq('user_id', userId)
    .order('day_number', { ascending: true });
  if (error) throw error;
  return (data || []) as SchoolProgress[];
}

export async function loadMySchoolBadge(userId: string): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { data, error } = await supabase
    .from('school_progress')
    .select('verified_operator_badge')
    .eq('user_id', userId)
    .eq('day_number', 7)
    .single();
  if (error || !data) return false;
  return !!(data as { verified_operator_badge?: boolean }).verified_operator_badge;
}

// Mark a bootcamp day (1–6) complete. Day 7 is completed only by
// passing the quiz — passDay7Quiz below — so a badge can never be
// clicked into existence.
export async function completeSchoolDay(userId: string, dayNumber: number): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Sign in with Supabase configured to track School progress.');
  }
  if (dayNumber < 1 || dayNumber > 6) {
    throw new Error('Day 7 is completed by passing the quiz, not by a button.');
  }
  const { error } = await supabase.from('school_progress').upsert(
    {
      user_id: userId,
      day_number: dayNumber,
      completed_at: new Date().toISOString(),
      verified_operator_badge: false,
    },
    { onConflict: 'user_id,day_number' }
  );
  if (error) throw error;
}

// Pass the Day 7 quiz: stamps day 7 complete AND sets the Verified
// Operator badge on that row. The badge is earned here and nowhere
// else — days 1–6 alone never set it.
export async function passDay7Quiz(userId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Sign in with Supabase configured to record the quiz result.');
  }
  const { error } = await supabase.from('school_progress').upsert(
    {
      user_id: userId,
      day_number: 7,
      completed_at: new Date().toISOString(),
      verified_operator_badge: true,
    },
    { onConflict: 'user_id,day_number' }
  );
  if (error) throw error;
}
