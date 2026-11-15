import { supabase, supabaseConfigured } from './supabase';

// Slice 124 — seller storefront profiles. One public profile per
// wholesaler, shown at the top of their /sell/<slug> page. The
// table (supabase/migrations/20261115130000_slice124_storefront.sql)
// holds ONLY fields the wholesaler chooses to publish — name,
// company, logo/headshot URLs, a public phone and email, service
// areas, buy-box property types, a short bio, an optional title
// company and booking link, their own turnaround promise and
// response-time text, their own offer terms, and optional
// testimonials and past-deal cards they enter themselves. Nothing
// private lives there, which is why the public page may read it
// directly under RLS. The wholesaler's private email, internal
// notes, and lead data are never in this table and never shown.

// --- Toggle vocabularies (step 2 of the seller form) ---
export const PROPERTY_TYPES = ['Single-Family', 'Multi-Family', 'Vacant Land', 'Townhouse / Condo'];
export const CONDITIONS = ['Needs Major Repairs', 'Cosmetic Work', 'Move-In Ready'];
export const OCCUPANCIES = ['Owner-Occupied', 'Tenant', 'Vacant'];
export const TIMELINES = ['ASAP', '30 Days', 'Just Exploring'];

export interface StorefrontTestimonial {
  quote: string;
  name: string;
}

export interface StorefrontPastDeal {
  city: string;
  days: string;
  note: string;
}

export interface StorefrontProfile {
  wholesaler_id?: string;
  public_slug: string;
  display_name: string;
  title: string;
  company_name: string;
  logo_url: string;
  headshot_url: string;
  public_phone: string;
  public_email: string;
  service_areas: string[];
  property_types: string[];
  seller_bio: string;
  title_company: string;
  booking_link: string;
  turnaround_promise: string;
  response_time_text: string;
  offer_fees: string;
  offer_repairs: string;
  offer_close_days: string;
  offer_closing_costs: string;
  testimonials: StorefrontTestimonial[];
  past_deals: StorefrontPastDeal[];
  // Slice 125: video hello (storage path in the private
  // storefront-videos bucket; played through a signed URL minted
  // per page load — never a public listing) and the no-strangers
  // promise (opt-in only: the pledge block appears on the page
  // only when the wholesaler turns it on).
  video_url: string;
  no_strangers_enabled: boolean;
  no_strangers_text: string;
}

// What a new profile starts with. These are starting values the
// wholesaler confirms or edits in Storefront Settings — the page
// renders only what the wholesaler has actually saved, so a
// wholesaler who never opens settings makes no promise at all.
// The turnaround default matches the operator's own page ("within
// 24 hours"); the offer terms are the operator's terms as starting
// values, editable per wholesaler.
export const DEFAULT_TURNAROUND = 'within 24 hours';
export const DEFAULT_RESPONSE_TIME = 'We reply to every submission.';
export const DEFAULT_OFFER_TERMS = {
  offer_fees: '$0 — no fees or commissions',
  offer_repairs: 'None needed — we buy as-is',
  offer_close_days: '7–14 days',
  offer_closing_costs: 'We pay them',
};

export function emptyStorefrontProfile(slug: string, company = ''): StorefrontProfile {
  return {
    public_slug: slug,
    display_name: '',
    title: '',
    company_name: company,
    logo_url: '',
    headshot_url: '',
    public_phone: '',
    public_email: '',
    service_areas: [],
    property_types: [],
    seller_bio: '',
    title_company: '',
    booking_link: '',
    turnaround_promise: DEFAULT_TURNAROUND,
    response_time_text: DEFAULT_RESPONSE_TIME,
    ...DEFAULT_OFFER_TERMS,
    testimonials: [],
    past_deals: [],
    video_url: '',
    no_strangers_enabled: false,
    no_strangers_text: '',
  };
}

const cleanList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
const cleanTestimonials = (v: unknown): StorefrontTestimonial[] =>
  Array.isArray(v)
    ? v
        .map((t) => ({ quote: String((t as { quote?: unknown })?.quote || '').trim(), name: String((t as { name?: unknown })?.name || '').trim() }))
        .filter((t) => t.quote)
        .slice(0, 3)
    : [];
const cleanPastDeals = (v: unknown): StorefrontPastDeal[] =>
  Array.isArray(v)
    ? v
        .map((d) => ({
          city: String((d as { city?: unknown })?.city || '').trim(),
          days: String((d as { days?: unknown })?.days || '').trim(),
          note: String((d as { note?: unknown })?.note || '').trim(),
        }))
        .filter((d) => d.city)
        .slice(0, 3)
    : [];

function rowToProfile(row: Record<string, unknown>): StorefrontProfile {
  const s = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : '');
  return {
    wholesaler_id: typeof row.wholesaler_id === 'string' ? row.wholesaler_id : undefined,
    public_slug: s('public_slug'),
    display_name: s('display_name'),
    title: s('title'),
    company_name: s('company_name'),
    logo_url: s('logo_url'),
    headshot_url: s('headshot_url'),
    public_phone: s('public_phone'),
    public_email: s('public_email'),
    service_areas: cleanList(row.service_areas),
    property_types: cleanList(row.property_types),
    seller_bio: s('seller_bio'),
    title_company: s('title_company'),
    booking_link: s('booking_link'),
    turnaround_promise: s('turnaround_promise'),
    response_time_text: s('response_time_text'),
    offer_fees: s('offer_fees'),
    offer_repairs: s('offer_repairs'),
    offer_close_days: s('offer_close_days'),
    offer_closing_costs: s('offer_closing_costs'),
    testimonials: cleanTestimonials(row.testimonials),
    past_deals: cleanPastDeals(row.past_deals),
    video_url: s('video_url'),
    no_strangers_enabled: row.no_strangers_enabled === true,
    no_strangers_text: s('no_strangers_text'),
  };
}

// Public read: the storefront page fetches the profile by slug.
// Returns null when there is no profile yet (the page falls back
// to the company headline/about it already shows) and also when
// the migration has not been applied yet — the page must not break
// before the table exists.
export async function loadPublicStorefront(slug: string): Promise<StorefrontProfile | null> {
  if (!supabaseConfigured || !supabase || !slug) return null;
  try {
    const { data, error } = await supabase
      .from('storefront_profiles')
      .select('*')
      .eq('public_slug', slug.trim().toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return rowToProfile(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

// Owner read/write for the dashboard settings panel.
export async function loadMyStorefront(userId: string): Promise<StorefrontProfile | null> {
  if (!supabaseConfigured || !supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('storefront_profiles')
      .select('*')
      .eq('wholesaler_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToProfile(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function saveMyStorefront(userId: string, p: StorefrontProfile): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const payload = {
    wholesaler_id: userId,
    public_slug: p.public_slug.trim().toLowerCase(),
    display_name: p.display_name.trim() || null,
    title: p.title.trim() || null,
    company_name: p.company_name.trim() || null,
    logo_url: p.logo_url.trim() || null,
    headshot_url: p.headshot_url.trim() || null,
    public_phone: p.public_phone.trim() || null,
    public_email: p.public_email.trim() || null,
    service_areas: p.service_areas.map((a) => a.trim()).filter(Boolean),
    property_types: p.property_types.filter((t) => PROPERTY_TYPES.includes(t)),
    seller_bio: p.seller_bio.trim().slice(0, 250) || null,
    title_company: p.title_company.trim() || null,
    booking_link: p.booking_link.trim() || null,
    turnaround_promise: p.turnaround_promise.trim() || null,
    response_time_text: p.response_time_text.trim() || null,
    offer_fees: p.offer_fees.trim() || null,
    offer_repairs: p.offer_repairs.trim() || null,
    offer_close_days: p.offer_close_days.trim() || null,
    offer_closing_costs: p.offer_closing_costs.trim() || null,
    testimonials: p.testimonials
      .map((t) => ({ quote: t.quote.trim().slice(0, 500), name: t.name.trim().slice(0, 60) }))
      .filter((t) => t.quote)
      .slice(0, 3),
    past_deals: p.past_deals
      .map((d) => ({ city: d.city.trim().slice(0, 80), days: d.days.trim().slice(0, 40), note: d.note.trim().slice(0, 200) }))
      .filter((d) => d.city)
      .slice(0, 3),
    video_url: p.video_url.trim() || null,
    no_strangers_enabled: p.no_strangers_enabled === true,
    no_strangers_text: p.no_strangers_text.trim().slice(0, 500) || null,
  };
  const { error } = await supabase.from('storefront_profiles').upsert(payload, { onConflict: 'wholesaler_id' });
  if (error) throw error;
}

// --- Two-step seller form writes (via the Slice 124 RPCs) ---
export interface SellerStep1 {
  owner_name: string;
  property_address: string;
  phone: string;
  email: string;
  consent: boolean;
}

export async function submitSellerLeadStep1(slug: string, f: SellerStep1, website: string): Promise<string | null> {
  if (!supabaseConfigured || !supabase) return null;
  const notes = [
    'Partial submission — step 1 of 2 (address + contact only); details not yet provided.',
    f.consent ? 'Contact consent: seller checked the box to be called/texted about this property.' : '',
  ]
    .filter(Boolean)
    .join('\n');
  const { data, error } = await supabase.rpc('submit_seller_lead_v2', {
    p_slug: slug,
    p_owner_name: f.owner_name,
    p_property_address: f.property_address,
    p_city: '',
    p_state: '',
    p_zip: '',
    p_phone: f.phone,
    p_email: f.email,
    p_notes: notes,
    p_website: website,
    p_is_partial: true,
    p_consent: f.consent,
    p_property_type: null,
    p_condition: null,
    p_occupancy: null,
    p_timeline: null,
    p_asking_price: null,
  });
  if (error || !data) return null;
  return String(data);
}

export interface SellerStep2 {
  city: string;
  state: string;
  zip: string;
  property_type: string;
  condition: string;
  occupancy: string;
  timeline: string;
  asking_price: number | null;
  notes: string;
  // Slice 125: the closing day the seller picked, and the
  // inherited-home fast-lane answers. All optional; empty means
  // the seller did not use them.
  preferred_closing_date: string;
  inherited_home: boolean;
  estate_role: string;
  letters_issued: string;
  court_approval: string;
  estate_notes: string;
}

export async function completeSellerLead(slug: string, leadId: string, d: SellerStep2): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { data, error } = await supabase.rpc('complete_seller_lead', {
    p_slug: slug,
    p_lead_id: leadId,
    p_city: d.city,
    p_state: d.state,
    p_zip: d.zip,
    p_property_type: d.property_type || null,
    p_condition: d.condition || null,
    p_occupancy: d.occupancy || null,
    p_timeline: d.timeline || null,
    p_asking_price: d.asking_price,
    p_notes: d.notes,
    p_preferred_closing_date: d.preferred_closing_date || null,
    p_inherited_home: d.inherited_home === true,
    p_estate_role: d.estate_role || null,
    p_letters_issued: d.letters_issued || null,
    p_court_approval: d.court_approval || null,
    p_estate_notes: d.estate_notes || null,
  });
  if (error) return false;
  return data === true;
}
