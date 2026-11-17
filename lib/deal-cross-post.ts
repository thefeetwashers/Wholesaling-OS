// Slice 133 — "Copy Deal & Open OBL" cross-post text.
//
// Pure formatter: builds the plain-text deal summary a wholesaler
// pastes into OpenBuyersList's guided form by hand. There is NO
// OBL public API, so there is no auto-post — the button in
// components/CopyDealToOblButton.tsx copies this text and opens
// https://openbuyerslist.com/ in a new tab, and the wholesaler
// pastes it there.
//
// The summary is built ONLY from real public.published_deals
// columns: city, state, zip, asking_price, arv_low / arv_high,
// property_type, condition, repair_estimate, notes, strategy,
// close_by. NEVER a street address — published_deals stores NO
// street address by design (ZIP-only location). Blank fields read
// "not provided", never invented. No OBL data of any kind is
// copied here: no OBL listings, buyers, comps, photos, or text.
//
// The paste's column names are WRONG and are not used: there is
// no street-address column on this table, state_code is state,
// arv is arv_low / arv_high, and the table is published_deals,
// not "deals".

export const OPEN_BUYERS_LIST_URL = 'https://openbuyerslist.com/';

// The published_deals fields the summary reads. A PublishedDeal
// satisfies this structurally (extra fields are ignored), so
// callers pass the deal row straight in.
export interface DealCrossPostInput {
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  asking_price?: number | null;
  arv_low?: number | null;
  arv_high?: number | null;
  property_type?: string | null;
  condition?: string | null;
  repair_estimate?: number | null;
  notes?: string | null;
  strategy?: string | null;
  close_by?: string | null;
}

function text(v: string | null | undefined): string {
  const t = (v || '').trim();
  return t === '' ? 'not provided' : t;
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'not provided';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function arvRange(d: DealCrossPostInput): string {
  if (d.arv_low == null && d.arv_high == null) return 'not provided';
  if (d.arv_low != null && d.arv_high != null) return `${money(d.arv_low)} – ${money(d.arv_high)}`;
  return money(d.arv_low ?? d.arv_high);
}

export function formatDealCrossPost(deal: DealCrossPostInput): string {
  const location = [text(deal.city), deal.state?.trim() ? deal.state.trim() : null, deal.zip?.trim() ? deal.zip.trim() : null]
    .filter((v): v is string => v !== null && v !== 'not provided')
    .join(', ');
  const lines = [
    'Off-market deal — shared from WholesalingOS',
    `Location: ${location === '' ? 'not provided' : location} (ZIP area only — street address not published)`,
    `Property type: ${text(deal.property_type)}`,
    `Condition: ${text(deal.condition)}`,
    `Asking price: ${money(deal.asking_price)}`,
    `Estimated ARV: ${arvRange(deal)}`,
    `Estimated rehab: ${money(deal.repair_estimate)}`,
    `Strategy: ${text(deal.strategy)}`,
    `Close by: ${text(deal.close_by)}`,
    `Rehab notes: ${text(deal.notes)}`,
  ];
  return lines.join('\n');
}
