import { checkPhone } from './phone';

// Slice 34 — paste-a-listing extractor. The wholesaler copies a
// listing's text themselves (from Zillow, Redfin, Craigslist, an FSBO
// page — wherever they found it) and pastes it here; this pulls out
// only what the text actually states. The platform never fetches the
// page, and nothing is inferred: an owner name is taken ONLY from an
// explicit "Seller:"/"Owner:" label, an agent only from an explicit
// "Listed by / Courtesy of / Brokered by" line, and anything not
// found stays blank for the wholesaler to fill in or leave empty.
//
// Deterministic patterns, no AI, no network. Phones are extracted as
// candidates and must pass the Slice 32 format check to be kept;
// failures are counted and reported, not stored.

export interface ParsedListing {
  property_address: string;
  city: string;
  state: string;
  zip: string;
  owner_name: string;
  agent_name: string;
  listing_type: 'For Sale By Owner' | 'Agent listed' | 'Not stated in text';
  phones: string[];
  invalid_phone_candidates: number;
  emails: string[];
  /** Human-readable extras that ride in the lead's notes. */
  notes_bits: string[];
}

const STREET =
  /\d{1,6}\s+[A-Za-z0-9 .'#-]+?\s(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Way|Circle|Cir|Terrace|Ter|Place|Pl|Highway|Hwy|Parkway|Pkwy|Trail|Trl|Alley|Aly)\b\.?/i;

const CITY_STATE_ZIP = /([A-Za-z .'-]{2,}),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/;

function first(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? (m[1] || '').trim() : '';
}

export function parseListingText(raw: string): ParsedListing {
  const text = (raw || '').replace(/\s+/g, ' ');
  const out: ParsedListing = {
    property_address: '',
    city: '',
    state: '',
    zip: '',
    owner_name: '',
    agent_name: '',
    listing_type: 'Not stated in text',
    phones: [],
    invalid_phone_candidates: 0,
    emails: [],
    notes_bits: [],
  };
  if (!text) return out;

  const addr = text.match(STREET);
  if (addr) out.property_address = addr[0].replace(/\s+/g, ' ').trim();

  // City/state/ZIP: prefer the ", City, ST 12345" that follows the
  // street address; fall back to the first one anywhere in the text.
  // The city group can swallow leading prose ("home in Fort Pierce"),
  // so rebuild the city from the end: keep trailing capitalized words
  // (max 3 — "West Palm Beach", "Port St Lucie"), stopping at the
  // first lowercase word ("in", "home", ...).
  const afterAddr = addr ? text.slice((addr.index || 0) + addr[0].length) : '';
  const csz = afterAddr.match(CITY_STATE_ZIP) || text.match(CITY_STATE_ZIP);
  if (csz) {
    const words = csz[1].trim().split(/\s+/);
    const kept: string[] = [];
    for (let i = words.length - 1; i >= 0 && kept.length < 3; i--) {
      if (/^[A-Z]/.test(words[i]) || /^(St|Ste|Mt)\.?$/.test(words[i])) kept.unshift(words[i]);
      else break;
    }
    out.city = kept.join(' ');
    out.state = csz[2];
    out.zip = csz[3];
  }

  // Phones: candidates → Slice 32 format check → valid E.164 only.
  const candidates = text.match(/(?:\+?1[\s.()-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || [];
  const seenPhones = new Set<string>();
  for (const cand of candidates) {
    const c = checkPhone(cand);
    if (c.valid && c.e164) {
      if (!seenPhones.has(c.e164)) { seenPhones.add(c.e164); out.phones.push(c.e164); }
    } else {
      out.invalid_phone_candidates++;
    }
  }

  const emailMatches = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  out.emails = Array.from(new Set(emailMatches.map((e) => e.toLowerCase())));

  // Listing type + people — explicit statements only.
  if (/for sale by owner|\bFSBO\b/i.test(text)) {
    out.listing_type = 'For Sale By Owner';
  }
  // Name words must actually be Capitalized in the text — a
  // case-insensitive label match with a loose name pattern otherwise
  // swallows the next sentence ("Seller: Maria Gonzalez. Call me").
  const NAME = "[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?";
  const agent = first(text, new RegExp(`(?:[Ll]isted by|[Ll]isting agent|[Cc]ourtesy of|[Bb]rokered by)[:\\s]+(${NAME}(?:\\s+${NAME}){0,2})`));
  if (agent) {
    out.agent_name = agent;
    if (out.listing_type === 'Not stated in text') out.listing_type = 'Agent listed';
  }
  const owner = first(text, new RegExp(`(?:^|[.;]\\s*)(?:[Ss]eller|[Oo]wner)\\s*:\\s*(${NAME}(?:\\s+${NAME}){1,2})`));
  if (owner) out.owner_name = owner;

  // Extras for the notes — only what the text states, labeled as such.
  const price = first(text, /\$\s?([\d,]{4,}(?:\.\d{2})?)/);
  if (price) out.notes_bits.push(`Asking price in text: $${price}`);
  const beds = first(text, /(\d+(?:\.\d+)?)\s*(?:beds?|bd|br)\b/i);
  const baths = first(text, /(\d+(?:\.\d+)?)\s*(?:baths?|ba)\b/i);
  const sqft = first(text, /([\d,]+)\s*(?:sq\.?\s?ft|sqft|square feet)/i);
  const spec: string[] = [];
  if (beds) spec.push(`${beds} bd`);
  if (baths) spec.push(`${baths} ba`);
  if (sqft) spec.push(`${sqft} sqft`);
  if (spec.length) out.notes_bits.push(`From listing text: ${spec.join(' · ')}`);
  out.notes_bits.push(`Listing type: ${out.listing_type}`);
  if (out.agent_name) out.notes_bits.push(`Agent named in text: ${out.agent_name}`);

  return out;
}
