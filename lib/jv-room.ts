import { supabase, supabaseConfigured } from './supabase';

// Slice 122 — Joint Venture & Co-Wholesaling Deal Room data layer.
// This is the NEW deal room (table `jv_listings`), NOT the older
// JV Board in lib/jv.ts (table `jv_posts`). The difference matters:
// jv_listings carries NO street address and NO seller contact, by
// design — those are shared only after a JV match. Partnering is a
// mutual opt-in recorded in jv_interests: the interested wholesaler
// shares their email by expressing interest, and the originator
// shares theirs by accepting. Before acceptance the interested
// party sees "waiting for the originator" and nobody's contact is
// shown. The JV split agreement itself is generated, not signed,
// in-app — signing happens between the two wholesalers. The
// platform takes no cut of a JV split and wires nothing.

export type JvPropertyType = 'house' | 'land' | 'multifamily';
export type JvListingStatus = 'open' | 'partnered' | 'closed';
export type JvInterestStatus = 'interested' | 'accepted' | 'declined';

export interface JvListing {
  id?: string;
  originating_wholesaler_id?: string;
  property_city?: string | null;
  property_state?: string | null;
  property_type?: JvPropertyType | null;
  contract_price?: number | null;
  estimated_arv?: number | null;
  estimated_repairs?: number | null;
  proposed_jv_split_percent: number;
  deal_summary?: string | null;
  status?: JvListingStatus;
  created_at?: string;
}

export interface JvInterest {
  id?: string;
  jv_listing_id: string;
  wholesaler_id?: string;
  wholesaler_email?: string | null;
  originator_email?: string | null;
  message?: string | null;
  status?: JvInterestStatus;
  created_at?: string;
}

const JV_SELECT =
  'id, originating_wholesaler_id, property_city, property_state, property_type, contract_price, estimated_arv, estimated_repairs, proposed_jv_split_percent, deal_summary, status, created_at';

const INTEREST_SELECT =
  'id, jv_listing_id, wholesaler_id, wholesaler_email, originator_email, message, status, created_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so nothing was submitted. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Slice 122 migration, then try again. No submission was faked.'
    );
  }
  return supabase;
}

// Post a JV listing. City/state/type/prices/split/summary only —
// the form never asks for a street address or a seller contact, and
// this function refuses them if passed.
export async function postJvListing(
  userId: string,
  listing: Omit<JvListing, 'id' | 'originating_wholesaler_id' | 'status' | 'created_at'>
): Promise<JvListing> {
  const client = requireSupabase();
  const split = Number(listing.proposed_jv_split_percent);
  if (!Number.isFinite(split) || split < 0 || split > 100) {
    throw new Error('The partner split must be a percent between 0 and 100.');
  }
  const { data, error } = await client
    .from('jv_listings')
    .insert({
      originating_wholesaler_id: userId,
      property_city: listing.property_city?.trim() || null,
      property_state: listing.property_state || null,
      property_type: listing.property_type || null,
      contract_price: listing.contract_price ?? null,
      estimated_arv: listing.estimated_arv ?? null,
      estimated_repairs: listing.estimated_repairs ?? null,
      proposed_jv_split_percent: split,
      deal_summary: listing.deal_summary?.trim() || null,
      status: 'open',
    })
    .select(JV_SELECT)
    .single();
  if (error) throw error;
  return data as JvListing;
}

// Open listings any signed-in wholesaler may browse. RLS also
// enforces this — a listing that is not in this result was not
// shown because the database refused it.
export async function loadOpenJvListings(): Promise<JvListing[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('jv_listings')
    .select(JV_SELECT)
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as JvListing[];
}

export async function loadMyJvListings(userId: string): Promise<JvListing[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('jv_listings')
    .select(JV_SELECT)
    .eq('originating_wholesaler_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as JvListing[];
}

export async function loadJvListing(id: string): Promise<JvListing | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from('jv_listings').select(JV_SELECT).eq('id', id).single();
  if (error || !data) return null;
  return data as JvListing;
}

export async function setJvListingStatus(listingId: string, status: JvListingStatus): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('jv_listings').update({ status }).eq('id', listingId);
  if (error) throw error;
}

export async function deleteJvListing(listingId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('jv_listings').delete().eq('id', listingId);
  if (error) throw error;
}

// Express interest in a listing. Sharing your email here is the
// first opt-in: the originator sees it so they can answer you.
// One interest per wholesaler per listing (database unique).
export async function expressJvInterest(
  userId: string,
  email: string,
  listingId: string,
  message?: string
): Promise<JvInterest> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('jv_interests')
    .insert({
      jv_listing_id: listingId,
      wholesaler_id: userId,
      wholesaler_email: email || null,
      message: message?.trim() || null,
      status: 'interested',
    })
    .select(INTEREST_SELECT)
    .single();
  if (error) throw error;
  return data as JvInterest;
}

export async function loadMyJvInterests(userId: string): Promise<JvInterest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('jv_interests')
    .select(INTEREST_SELECT)
    .eq('wholesaler_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as JvInterest[];
}

// What the originator sees on their listing: who is interested.
export async function loadInterestsForListing(listingId: string): Promise<JvInterest[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('jv_interests')
    .select(INTEREST_SELECT)
    .eq('jv_listing_id', listingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as JvInterest[];
}

// Accept an interest: the second opt-in. The originator's email is
// written into the interest row at acceptance, so the partner sees
// it only now — and the listing flips to 'partnered' in the same
// step. The street address and seller contact are still not in
// this table; they are shared between the two parties directly, and
// the agreement generator asks the originator for them then.
export async function acceptJvInterest(
  interestId: string,
  listingId: string,
  originatorEmail: string
): Promise<void> {
  const client = requireSupabase();
  const { error: iErr } = await client
    .from('jv_interests')
    .update({ status: 'accepted', originator_email: originatorEmail || null })
    .eq('id', interestId);
  if (iErr) throw iErr;
  const { error: lErr } = await client
    .from('jv_listings')
    .update({ status: 'partnered' })
    .eq('id', listingId);
  if (lErr) throw lErr;
}

export async function declineJvInterest(interestId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('jv_interests')
    .update({ status: 'declined' })
    .eq('id', interestId);
  if (error) throw error;
}

export async function withdrawJvInterest(interestId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('jv_interests').delete().eq('id', interestId);
  if (error) throw error;
}

// Badge lookup for a listing originator: a boolean only, never the
// progress rows. The database function is security-definer, so any
// signed-in user may ask it about any account.
export async function isVerifiedOperator(userId: string): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { data, error } = await supabase.rpc('is_verified_operator', { p_user: userId });
  if (error) return false;
  return !!data;
}
