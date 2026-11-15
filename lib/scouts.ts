import { supabase, supabaseConfigured } from './supabase';

// Slice 122 — Mobile "Drive-for-Dollars" Scout Portal data layer.
// A scout snaps a photo of a vacant or distressed property; a
// wholesaler claims it into their sealed office; the $1,000 is
// earned only when the deal closes and funds. Every read/write
// goes through Supabase RLS; the client never decides who may see
// a lead. Photos live in the PRIVATE 'scout-photos' bucket under
// <scout_id>/<lead_id>/<file> and are shown only as short-lived
// signed URLs. No scout, lead, or payout is ever faked: when
// Supabase is not configured these functions throw or return
// empty, and the UI says so plainly.

export const SCOUT_PAYOUT = 1000;

export type ScoutLeadStatus =
  | 'submitted'
  | 'claimed_reviewing'
  | 'under_contract'
  | 'in_escrow'
  | 'closed_paid_1000'
  | 'passed';

export const SCOUT_STATUSES: ScoutLeadStatus[] = [
  'submitted',
  'claimed_reviewing',
  'under_contract',
  'in_escrow',
  'closed_paid_1000',
  'passed',
];

export const SCOUT_STATUS_LABELS: Record<ScoutLeadStatus, string> = {
  submitted: 'Submitted',
  claimed_reviewing: 'Claimed by wholesaler — reviewing',
  under_contract: 'Under contract',
  in_escrow: 'In escrow',
  closed_paid_1000: 'Closed — $1,000 paid',
  passed: 'Passed — not moving forward',
};

// The live tracker steps a scout sees. 'passed' is a terminal branch,
// not a step forward.
export const SCOUT_TRACKER_STEPS: { status: ScoutLeadStatus; label: string }[] = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'claimed_reviewing', label: 'Claimed by wholesaler' },
  { status: 'under_contract', label: 'Under contract' },
  { status: 'in_escrow', label: 'In escrow' },
  { status: 'closed_paid_1000', label: 'Closed & $1,000 paid' },
];

export const DISTRESS_TAGS = [
  { value: 'vacant', label: 'Vacant' },
  { value: 'overgrown_yard', label: 'Overgrown yard' },
  { value: 'code_violation', label: 'Code violation' },
  { value: 'boarded_up', label: 'Boarded up' },
  { value: 'for_sale_by_owner', label: 'For sale by owner' },
] as const;

export interface ScoutLead {
  id?: string;
  scout_id?: string;
  property_address: string;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  distress_tags: string[];
  photo_urls: string[];
  seller_notes?: string | null;
  claimed_by_wholesaler_id?: string | null;
  status: ScoutLeadStatus;
  payout_amount?: number | null;
  created_at?: string;
  updated_at?: string;
}

const SCOUT_SELECT =
  'id, scout_id, property_address, city, state, zip_code, distress_tags, photo_urls, seller_notes, claimed_by_wholesaler_id, status, payout_amount, created_at, updated_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so nothing was submitted. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run the Slice 122 migration, then try again. No submission was faked.'
    );
  }
  return supabase;
}

export async function submitScoutLead(
  userId: string,
  lead: Omit<ScoutLead, 'id' | 'scout_id' | 'status' | 'claimed_by_wholesaler_id' | 'created_at' | 'updated_at'>
): Promise<ScoutLead> {
  const client = requireSupabase();
  if (!lead.property_address.trim()) {
    throw new Error('Add the property address — that is the one thing we must have.');
  }
  const { data, error } = await client
    .from('scout_leads')
    .insert({
      scout_id: userId,
      property_address: lead.property_address.trim(),
      city: lead.city?.trim() || null,
      state: lead.state?.trim() || 'FL',
      zip_code: lead.zip_code?.trim() || null,
      distress_tags: lead.distress_tags || [],
      photo_urls: lead.photo_urls || [],
      seller_notes: lead.seller_notes?.trim() || null,
      status: 'submitted',
      payout_amount: SCOUT_PAYOUT,
    })
    .select(SCOUT_SELECT)
    .single();
  if (error) throw error;
  return data as ScoutLead;
}

export async function loadMyScoutLeads(userId: string): Promise<ScoutLead[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('scout_leads')
    .select(SCOUT_SELECT)
    .eq('scout_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ScoutLead[];
}

// Wholesaler browse: unclaimed 'submitted' leads only. RLS also
// enforces this — a lead that is not in this result was not shown
// because the database refused it.
export async function loadUnclaimedScoutLeads(): Promise<ScoutLead[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('scout_leads')
    .select(SCOUT_SELECT)
    .is('claimed_by_wholesaler_id', null)
    .eq('status', 'submitted')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ScoutLead[];
}

// Leads this wholesaler claimed, for their sealed-office view.
export async function loadMyClaimedScoutLeads(userId: string): Promise<ScoutLead[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('scout_leads')
    .select(SCOUT_SELECT)
    .eq('claimed_by_wholesaler_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ScoutLead[];
}

// Claim an unclaimed 'submitted' lead into this wholesaler's office.
// The RLS claim policy pins the claim to the caller and the first
// status step; a failed claim (already claimed, wrong status) throws
// and nothing changes.
export async function claimScoutLead(leadId: string, userId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('scout_leads')
    .update({ claimed_by_wholesaler_id: userId, status: 'claimed_reviewing' })
    .eq('id', leadId)
    .is('claimed_by_wholesaler_id', null)
    .eq('status', 'submitted')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('That lead is no longer available to claim — it was claimed already or is no longer submitted.');
  }
}

// The claiming wholesaler (or operator) advances the status. The
// $1,000 is earned only at 'closed_paid_1000', which the operator
// marks when the money is paid at the closing table.
export async function setScoutLeadStatus(leadId: string, status: ScoutLeadStatus): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('scout_leads').update({ status }).eq('id', leadId);
  if (error) throw error;
}

// Attach uploaded photo paths to a lead the scout just submitted.
// The scout may only update their own row while it is still
// unclaimed (RLS), so photos are added right after submission.
export async function setScoutLeadPhotos(leadId: string, photoUrls: string[]): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('scout_leads').update({ photo_urls: photoUrls }).eq('id', leadId);
  if (error) throw error;
}

export async function deleteScoutLead(leadId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('scout_leads').delete().eq('id', leadId);
  if (error) throw error;
}

// ---- Scout photos (private 'scout-photos' bucket) ----

export const MAX_SCOUT_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_SCOUT_PHOTOS = 6;

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'photo';
}

// Upload one photo for a lead the scout just submitted. Returns the
// storage path, which is what scout_leads.photo_urls stores. A
// missing bucket (migration not applied) surfaces as a plain error —
// never a fake success.
export async function uploadScoutPhoto(userId: string, leadId: string, file: File): Promise<string> {
  const client = requireSupabase();
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  if (file.size > MAX_SCOUT_PHOTO_BYTES) throw new Error('That image is over 5 MB.');
  const path = `${userId}/${leadId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await client.storage
    .from('scout-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

// Mint short-lived signed URLs for stored photo paths. Paths that
// fail to sign are simply omitted — never replaced with a placeholder.
export async function signScoutPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supabaseConfigured || !supabase || paths.length === 0) return out;
  const { data } = await supabase.storage.from('scout-photos').createSignedUrls(paths, 3600);
  for (const s of data || []) {
    if (s.signedUrl) out.set(s.path, s.signedUrl);
  }
  return out;
}
