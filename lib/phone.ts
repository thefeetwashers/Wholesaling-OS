// Slice 32 — phone FORMAT validation for numbers the wholesaler
// already has (typed in, in an imported file, or posted by their own
// webhook source). Pure string rules — no network calls, no carrier
// data, no ownership data.
//
// What this honestly is: Google's libphonenumber-style format checking.
// It answers "could this string be a real phone number, and what is
// its standard +1 form?" It CANNOT answer "is this line active?",
// "who owns it?", or "is it a mobile?" — that information lives with
// the carriers and data brokers, and the platform does not buy or
// scrape it. Copy anywhere this is used must say "format" plainly.

export interface PhoneCheck {
  valid: boolean;
  /** Standard E.164 form ("+1...") when valid, else null. */
  e164: string | null;
  /** Short human-readable verdict. */
  reason: string;
}

export function checkPhone(raw: string): PhoneCheck {
  const input = (raw || '').trim();
  if (!input) return { valid: false, e164: null, reason: 'empty' };

  // Drop a trailing extension ("ext 5", "x12") — the base number is
  // what gets checked and stored.
  const base = input.replace(/\s*(ext\.?|x)\s*\d+\s*$/i, '');
  const digits = base.replace(/\D/g, '');
  const hasPlus = base.trim().startsWith('+');

  if (hasPlus) {
    // International: country code + number, 8–15 digits total, and a
    // country code never starts with 0. Basic shape only — per-country
    // rules are beyond a format check.
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) {
      return { valid: false, e164: null, reason: 'international number with an implausible length or country code' };
    }
    return { valid: true, e164: `+${digits}`, reason: 'international format' };
  }

  let nanp = digits;
  if (digits.length === 11 && digits.startsWith('1')) nanp = digits.slice(1);
  if (nanp.length !== 10) {
    return { valid: false, e164: null, reason: `${digits.length} digits — a US number is 10 digits (or 11 starting with 1)` };
  }
  const area = nanp.slice(0, 3);
  const exchange = nanp.slice(3, 6);
  const line = nanp.slice(6);
  if (!/^[2-9]/.test(area)) {
    return { valid: false, e164: null, reason: 'area code cannot start with 0 or 1' };
  }
  if (/^[2-9]11$/.test(area)) {
    return { valid: false, e164: null, reason: `${area} is a service code (N11), not an area code` };
  }
  if (!/^[2-9]/.test(exchange)) {
    return { valid: false, e164: null, reason: 'exchange cannot start with 0 or 1' };
  }
  if (exchange === '555' && line >= '0100' && line <= '0199') {
    return { valid: false, e164: null, reason: '555-01xx numbers are the reserved fictional range (movies/ads)' };
  }
  return { valid: true, e164: `+1${nanp}`, reason: 'US number, standard format' };
}

/** Validate a list: valid numbers come back in E.164 form; invalid
 *  ones are kept exactly as entered (they are the wholesaler's data)
 *  and counted so the caller can report them. */
export function normalizePhones(list: string[]): { phones: string[]; invalid: number } {
  const phones: string[] = [];
  let invalid = 0;
  for (const p of list) {
    const c = checkPhone(p);
    if (c.valid && c.e164) phones.push(c.e164);
    else { phones.push(p); invalid++; }
  }
  return { phones, invalid };
}
