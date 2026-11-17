// Slice 132 — Cash Buyer VIP Portal: the buyer's own contact info.
//
// Stored on the EXISTING public.profiles table (migration
// 20261117133000, ALTER TABLE only — no new table; the earlier
// buyer_profiles table instruction was withdrawn and that file is
// deleted). Column mapping, read from the repo's actual use of
// profiles (lib/portals.ts, lib/access.ts, components/AuthPanel.tsx):
//   contact_email -> profiles.email (already existed; the account
//     email AuthPanel upserts at signup and loadMyProfile returns).
//   contact_name, contact_phone, contact_private -> added by the
//     ALTER above; no such columns existed on profiles in any code
//     read.
// Contact is PRIVATE BY DEFAULT (contact_private defaults true):
// it is never shown on the public /buyers directory, never in a
// plain public read, and only revealed through the mutual-opt-in
// RPC below — the buyer and the wholesaler must BOTH have shared
// on the same deal response (see loadBuyerContactForResponse).
// Form fields are empty by default; nothing is pre-filled. The
// email field shows the account email the buyer signed up with
// (their own real address, loaded from their own profile row) and
// can be changed if deals should reach a different inbox.
// No buyer contact from anywhere else is stored here. The VIP
// form is for signed-in buyers only — it updates the caller's own
// profiles row; there is no anonymous write anywhere.

import { supabase, supabaseConfigured } from './supabase';

export interface BuyerProfile {
  // profiles.id — the buyer's account id (same as auth user id).
  id?: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_private: boolean;
}

export interface SharedBuyerContact {
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

export interface ContactReveal {
  // True only when the mutual-opt-in RPC returned a contact.
  available: boolean;
  contact: SharedBuyerContact | null;
  // Human-readable reason when not available — shown in the app,
  // never a silent empty.
  reason: string;
}

const BUYER_PROFILE_SELECT =
  'id, email, contact_name, contact_phone, contact_private';

function rowToProfile(row: Record<string, unknown>): BuyerProfile {
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    contact_name: typeof row.contact_name === 'string' ? row.contact_name : '',
    contact_email: typeof row.email === 'string' ? row.email : '',
    contact_phone: typeof row.contact_phone === 'string' ? row.contact_phone : '',
    contact_private: row.contact_private !== false,
  };
}

export async function loadMyBuyerProfile(userId: string): Promise<BuyerProfile | null> {
  if (!supabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(BUYER_PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToProfile(data as Record<string, unknown>);
  } catch {
    // The contact columns arrive with migration 20261117133000. If
    // it has not been applied yet, the select above fails on the
    // missing columns — fall back to the columns that already
    // existed (id, email) so the page still loads with the account
    // email and empty contact fields, instead of breaking. Saving
    // before that migration is applied surfaces the real error.
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', userId)
        .maybeSingle();
      if (error || !data) return null;
      return rowToProfile(data as Record<string, unknown>);
    } catch {
      return null;
    }
  }
}

// Upsert on profiles.id (one row per account; the row is created at
// signup — AuthPanel upserts { id, email } — so this normally
// updates). Same pattern as AuthPanel's ensureProfile. Verified
// write: the saved row is selected back, and a missing row is an
// honest error. An empty contact email leaves the existing account
// email untouched instead of blanking it.
export async function saveMyBuyerProfile(
  userId: string,
  p: Omit<BuyerProfile, 'id'>,
): Promise<BuyerProfile> {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so the contact was not saved. No contact was faked.',
    );
  }
  const email = p.contact_email?.trim();
  const payload: Record<string, unknown> = {
    id: userId,
    contact_name: p.contact_name?.trim() || '',
    contact_phone: p.contact_phone?.trim() || '',
    contact_private: p.contact_private !== false,
  };
  if (email) payload.email = email;
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select(BUYER_PROFILE_SELECT)
    .single();
  if (error) throw error;
  if (!data) throw new Error('The contact was not saved — nothing was written.');
  return rowToProfile(data as Record<string, unknown>);
}

// Mutual-opt-in reveal (JV-room pattern: jv_interests records the
// two opt-ins before either contact is shown).
//
//   get_buyer_contact_for_response(p_response_id uuid)
//     — SECURITY DEFINER function, created by migration
//       20261117133000 (deal_responses itself is created by
//       migration 20261117130000, which runs first). It returns the
//       buyer's contact from public.profiles ONLY when a
//       deal_responses row for that response has BOTH
//       owner_contact_shared AND responder_contact_shared true,
//       AND the caller is the operator or one of the two parties
//       to that response. Otherwise it returns no rows. The
//       buyer's contact_private flag is the floor: private by
//       default, and the RPC never reveals on a single side's
//       share alone.
//
// Until that function exists this call returns available: false
// with an honest reason — it never throws into a page and never
// falls back to a plain read of profiles (owner-only RLS means
// another user cannot read the buyer's contact row anyway).
//
// The "Share my contact" buttons live on Worker A's deal-response
// view (it owns the owner_contact_shared / responder_contact_shared
// flags): the buyer sets their side, the wholesaler sets theirs;
// only when both are true does this RPC reveal anything.
export async function loadBuyerContactForResponse(responseId: string): Promise<ContactReveal> {
  if (!supabaseConfigured || !supabase || !responseId) {
    return { available: false, contact: null, reason: 'No deal response was given, so no contact can be shown.' };
  }
  try {
    const { data, error } = await supabase.rpc('get_buyer_contact_for_response', {
      p_response_id: responseId,
    });
    if (error) {
      return {
        available: false,
        contact: null,
        reason:
          'Contact sharing for deal responses is not built yet — the buyer and the wholesaler have not both shared on this deal, or the reveal is not wired up. No contact is shown.',
      };
    }
    const row = (Array.isArray(data) ? data[0] : data) as SharedBuyerContact | null | undefined;
    if (!row || !row.contact_email) {
      return {
        available: false,
        contact: null,
        reason: 'No contact shared yet — both sides must share their contact on this deal before either is shown.',
      };
    }
    return { available: true, contact: row, reason: '' };
  } catch {
    return {
      available: false,
      contact: null,
      reason: 'Contact sharing for deal responses is not available right now. No contact is shown.',
    };
  }
}
