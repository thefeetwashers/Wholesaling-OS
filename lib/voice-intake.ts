// Slice 41 — pure helpers for the seller-page voice intake.
// Extracted from the widget so they can be unit-tested: caller-type
// detection from a spoken phrase, and splitting a spoken one-line
// address into the lead's address fields. Deterministic, no AI, no
// network — the intake asks fixed questions, so its helpers are
// fixed rules.

export type CallerType = 'seller' | 'buyer' | 'unknown';

export function detectCallerType(text: string): CallerType {
  const t = ` ${text.toLowerCase()} `;
  if (/\b(buy|buyer|buying|invest|investor|looking to buy|purchase)\b/.test(t)) return 'buyer';
  if (/\b(sell|seller|selling|my house|my property|my home)\b/.test(t)) return 'seller';
  return 'unknown';
}

export interface SpokenAddress {
  property_address: string;
  city: string;
  state: string;
  zip: string;
}

const STATE_CODES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC',
};

// "321 Main Street, Fort Pierce, Florida 34950" → parts. The state
// must be a real 2-letter code or a real state name (converted to its
// code) — a loose pattern would eat street suffixes ("Palm Dr 34982"
// misread Dr as a state; unit test caught it).
export function splitSpokenAddress(raw: string): SpokenAddress {
  const out: SpokenAddress = { property_address: raw.trim(), city: '', state: '', zip: '' };
  const m = raw.match(/^(.*?)[, ]+([^,]+?)[, ]+([A-Za-z]{2}|[A-Za-z ]+?)\s+(\d{5})(?:-\d{4})?\s*$/);
  if (m) {
    const stRaw = m[3].trim();
    const st = stRaw.length === 2 ? stRaw.toUpperCase() : STATE_CODES[stRaw.toLowerCase()];
    if (st && Object.values(STATE_CODES).includes(st)) {
      out.property_address = m[1].trim();
      out.city = m[2].trim();
      out.state = st;
      out.zip = m[4];
      return out;
    }
  }
  const zipOnly = raw.match(/^(.*?)[, ]+(\d{5})(?:-\d{4})?\s*$/);
  if (zipOnly) {
    out.property_address = zipOnly[1].trim();
    out.zip = zipOnly[2];
  }
  return out;
}
