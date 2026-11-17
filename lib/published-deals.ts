import { supabase, supabaseConfigured } from './supabase';

// Slice 132 — public off-market deals marketplace data layer.
//
// A published deal is a wholesaler's OPT-IN public listing of one
// of their own deals. Nothing is published automatically: the
// wholesaler taps "Publish as a deal" on their own lead and
// confirms. The public row carries NO street address (ZIP-only
// location) and NO seller contact. Money fields are empty unless
// the wholesaler typed a real value. Comps are wholesaler-entered
// only, max 4, every comp field optional — blank reads
// "not provided", never invented.
//
// Condition values are EXACTLY these five, everywhere (publish
// form, detail page, filters, buy-box matching — see
// lib/match-buy-box.ts). Do not vary them.
export const DEAL_CONDITIONS = [
  'Turnkey',
  'Light rehab',
  'Moderate rehab',
  'Heavy rehab',
  'Gut rehab',
] as const;

export type DealCondition = (typeof DEAL_CONDITIONS)[number];

export interface DealComp {
  address?: string | null;
  sold_price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  sold_date?: string | null;
}

export interface PublishedDeal {
  id?: string;
  user_id?: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  property_type?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  year_built?: number | null;
  lot_size?: string | null;
  condition?: string | null;
  occupancy?: string | null;
  strategy?: string | null;
  asking_price?: number | null;
  arv_low?: number | null;
  arv_high?: number | null;
  repair_estimate?: number | null;
  close_by?: string | null;
  highlights?: string | null;
  notes?: string | null;
  comps?: DealComp[];
  published?: boolean;
  // Slice 133 — deal status, added by sibling migration
  // 20261117144000: 'Active' | 'Under Contract' | 'Sold',
  // NOT NULL DEFAULT 'Active'. A missing status (column not yet
  // applied, or an older row) reads as Active — the deal page
  // normalizes with `deal.status || 'Active'`. The status badge
  // and changer are the sibling's; this file only carries the
  // value so the offer form can respect it.
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DealResponse {
  id?: string;
  deal_id: string;
  responder_id?: string;
  message?: string | null;
  owner_contact_shared?: boolean;
  responder_contact_shared?: boolean;
  status?: string;
  created_at?: string;
}

// Slice 133 — one recorded asking-price value for a deal. The
// initial row has old_price null (no earlier published price).
// Rows are written by the deal owner only (see the migration
// 20261117142000 policy "owner inserts own deal price history").
export interface DealPriceHistoryEntry {
  id?: string;
  deal_id: string;
  old_price: number | null;
  new_price: number | null;
  changed_at?: string;
}

export interface DealFilters {
  market?: string;
  property_type?: string;
  min_price?: number | null;
  max_price?: number | null;
  strategy?: string;
  condition?: string;
  search?: string;
}

const DEAL_SELECT =
  'id, user_id, city, state, zip, county, property_type, beds, baths, sqft, year_built, lot_size, condition, occupancy, strategy, asking_price, arv_low, arv_high, repair_estimate, close_by, highlights, notes, comps, published, created_at, updated_at';

const RESPONSE_SELECT =
  'id, deal_id, responder_id, message, owner_contact_shared, responder_contact_shared, status, created_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so nothing was submitted. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Slice 132 migration, then try again. No submission was faked.'
    );
  }
  return supabase;
}

function cleanComps(comps: DealComp[] | undefined | null): DealComp[] {
  const list = Array.isArray(comps) ? comps.slice(0, 4) : [];
  return list.map((c) => ({
    address: c.address?.trim() || null,
    sold_price: typeof c.sold_price === 'number' && Number.isFinite(c.sold_price) ? c.sold_price : null,
    beds: typeof c.beds === 'number' && Number.isFinite(c.beds) ? c.beds : null,
    baths: typeof c.baths === 'number' && Number.isFinite(c.baths) ? c.baths : null,
    sqft: typeof c.sqft === 'number' && Number.isFinite(c.sqft) ? c.sqft : null,
    sold_date: c.sold_date?.trim() || null,
  }));
}

function cleanDealInput(
  deal: Omit<PublishedDeal, 'id' | 'user_id' | 'published' | 'created_at' | 'updated_at'>
): Record<string, unknown> {
  const num = (v: number | null | undefined): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const txt = (v: string | null | undefined): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null;
  // Condition is pinned to the five values above; anything else is
  // stored as null rather than a made-up value.
  const condition =
    typeof deal.condition === 'string' && (DEAL_CONDITIONS as readonly string[]).includes(deal.condition)
      ? deal.condition
      : null;
  return {
    city: txt(deal.city),
    state: txt(deal.state),
    zip: txt(deal.zip),
    county: txt(deal.county),
    property_type: txt(deal.property_type),
    beds: num(deal.beds),
    baths: num(deal.baths),
    sqft: num(deal.sqft),
    year_built: num(deal.year_built),
    lot_size: txt(deal.lot_size),
    condition,
    occupancy: txt(deal.occupancy),
    strategy: txt(deal.strategy),
    asking_price: num(deal.asking_price),
    arv_low: num(deal.arv_low),
    arv_high: num(deal.arv_high),
    repair_estimate: num(deal.repair_estimate),
    close_by: txt(deal.close_by),
    highlights: txt(deal.highlights),
    notes: txt(deal.notes),
    comps: cleanComps(deal.comps),
  };
}

// Public marketplace list. No sign-in needed — the anon grant +
// the public-read policy serve published rows only. Filters are
// applied in the query; the market/search text matches city,
// state, ZIP, or county (no street address exists to match).
export async function fetchPublishedDeals(filters: DealFilters = {}): Promise<PublishedDeal[]> {
  if (!supabaseConfigured || !supabase) return [];
  // Slice 133 — the status column comes from sibling migration
  // 20261117144000; select it when present, retry without it when
  // the migration has not been applied yet (same defensive read
  // as the by-id fetchers below). A missing status reads as
  // Active on the deal page.
  const run = async (withStatus: boolean) => {
    let q = supabase
      .from('published_deals')
      .select(withStatus ? `${DEAL_SELECT}, status` : DEAL_SELECT)
      .eq('published', true)
      .order('created_at', { ascending: false });
    if (filters.property_type) q = q.eq('property_type', filters.property_type);
    if (filters.strategy) q = q.eq('strategy', filters.strategy);
    if (filters.condition) q = q.eq('condition', filters.condition);
    if (filters.min_price != null) q = q.gte('asking_price', filters.min_price);
    if (filters.max_price != null) q = q.lte('asking_price', filters.max_price);
    return q;
  };
  let { data, error } = await run(true);
  if (error) ({ data, error } = await run(false));
  if (error) throw error;
  let rows = (data || []) as PublishedDeal[];
  const market = (filters.market || '').trim().toLowerCase();
  if (market) {
    rows = rows.filter((d) =>
      [d.city, d.state, d.zip, d.county].some((v) => (v || '').toLowerCase().includes(market))
    );
  }
  const search = (filters.search || '').trim().toLowerCase();
  if (search) {
    rows = rows.filter((d) =>
      [d.city, d.state, d.zip, d.county, d.property_type, d.strategy, d.condition, d.highlights, d.notes]
        .some((v) => (v || '').toLowerCase().includes(search))
    );
  }
  return rows;
}

export async function fetchPublishedDealById(id: string): Promise<PublishedDeal | null> {
  if (!supabaseConfigured || !supabase) return null;
  let { data, error } = await supabase
    .from('published_deals')
    .select(`${DEAL_SELECT}, status`)
    .eq('id', id)
    .eq('published', true)
    .single();
  if (error) {
    // Slice 133 — defensive read: the status column comes from
    // sibling migration 20261117144000, which was NOT in the repo
    // when this was written. If the column does not exist yet the
    // select fails, so retry without it; a missing status reads as
    // Active on the deal page. (A genuinely missing row fails the
    // retry too and still returns null.)
    ({ data, error } = await supabase
      .from('published_deals')
      .select(DEAL_SELECT)
      .eq('id', id)
      .eq('published', true)
      .single());
  }
  if (error || !data) return null;
  return data as PublishedDeal;
}

// The owner's own published deal, including when unpublished
// (so the owner can see it and re-publish). RLS still enforces
// ownership — another wholesaler's unpublished row never returns.
export async function fetchMyPublishedDealById(id: string): Promise<PublishedDeal | null> {
  if (!supabaseConfigured || !supabase) return null;
  let { data, error } = await supabase
    .from('published_deals')
    .select(`${DEAL_SELECT}, status`)
    .eq('id', id)
    .single();
  if (error) {
    // Slice 133 — same defensive read as fetchPublishedDealById:
    // retry without status when the sibling migration
    // 20261117144000 has not been applied yet.
    ({ data, error } = await supabase
      .from('published_deals')
      .select(DEAL_SELECT)
      .eq('id', id)
      .single());
  }
  if (error || !data) return null;
  return data as PublishedDeal;
}

// Explicit opt-in only: the wholesaler confirms the publish form.
// The write selects its row back, so a refused save throws
// instead of looking published.
//
// Slice 133 — the initial asking price is recorded in
// public.deal_price_history (old_price null) right after the deal
// row is created, so price drops can later be derived from real
// recorded prices. The history write is best-effort and never
// fails the publish: if it is refused (e.g. the Slice 133
// migration has not been applied yet), the deal is still
// published and the detail page honestly says price history was
// not recorded. No price is ever invented here — a null asking
// price records no row.
export async function publishDeal(
  userId: string,
  deal: Omit<PublishedDeal, 'id' | 'user_id' | 'published' | 'created_at' | 'updated_at'>
): Promise<PublishedDeal> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('published_deals')
    .insert({ ...cleanDealInput(deal), user_id: userId, published: true })
    .select(DEAL_SELECT)
    .single();
  if (error) throw error;
  const created = data as PublishedDeal;
  if (typeof created.asking_price === 'number' && Number.isFinite(created.asking_price)) {
    try {
      await recordDealPriceHistory(created.id!, null, created.asking_price);
    } catch {
      // Best-effort only — see the header note above.
    }
  }
  return created;
}

// Slice 133 — record one asking-price value for a deal the caller
// owns. Used for the initial price at publish time (old_price
// null); a future edit flow for a published deal's asking price
// must call this with the previous price as old_price so drops
// stay derived from real rows. Throws when the write is refused.
export async function recordDealPriceHistory(
  dealId: string,
  oldPrice: number | null,
  newPrice: number | null
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('deal_price_history').insert({
    deal_id: dealId,
    old_price: typeof oldPrice === 'number' && Number.isFinite(oldPrice) ? oldPrice : null,
    new_price: typeof newPrice === 'number' && Number.isFinite(newPrice) ? newPrice : null,
  });
  if (error) throw error;
}

// Owner-only unpublish (hides the deal from the public pages;
// the row is kept so the owner can re-publish).
export async function unpublishDeal(userId: string, dealId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('published_deals')
    .update({ published: false })
    .eq('id', dealId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('The deal could not be unpublished — it may not exist, or the Slice 132 migration has not been applied yet.');
  }
}

export async function republishDeal(userId: string, dealId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('published_deals')
    .update({ published: true })
    .eq('id', dealId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('The deal could not be re-published — it may not exist, or the Slice 132 migration has not been applied yet.');
  }
}

// A signed-in buyer responds to a deal. The response carries a
// message only — contact is shared separately, by mutual opt-in.
export async function respondToDeal(
  userId: string,
  dealId: string,
  message: string
): Promise<DealResponse> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('deal_responses')
    .insert({ deal_id: dealId, responder_id: userId, message: message?.trim() || '', status: 'pending' })
    .select(RESPONSE_SELECT)
    .single();
  if (error) throw error;
  return data as DealResponse;
}

// Mutual opt-in: the caller sets their own side's share flag true.
// Contact is shown only when BOTH flags are true (the page checks
// owner_contact_shared AND responder_contact_shared). The flag is
// one-way here — sharing is a deliberate tap, never automatic.
export async function shareContact(responseId: string, side: 'owner' | 'responder'): Promise<void> {
  const client = requireSupabase();
  const patch =
    side === 'owner' ? { owner_contact_shared: true } : { responder_contact_shared: true };
  const { data, error } = await client
    .from('deal_responses')
    .update(patch)
    .eq('id', responseId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Contact sharing did not save — the response may not exist, or the Slice 132 migration has not been applied yet.');
  }
}

// Responses the signed-in user sent.
export async function fetchMyDealResponses(userId: string): Promise<DealResponse[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('deal_responses')
    .select(RESPONSE_SELECT)
    .eq('responder_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DealResponse[];
}

// Responses on the caller's own deal (the owner reads them).
export async function fetchResponsesForDeal(dealId: string): Promise<DealResponse[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('deal_responses')
    .select(RESPONSE_SELECT)
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as DealResponse[];
}
