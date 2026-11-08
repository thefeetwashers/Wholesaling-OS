import { supabase, supabaseConfigured } from './supabase';

// Slice 71 — Subscriber Referral Engine data ("give a month, get a
// month"). Attribution is first-touch: the ?ref=<slug> in a referral
// link is stashed locally, resolved to a profile id once at signup,
// and written to the new profile's referred_by — only while it is
// still empty. Stats come from the my_referral_stats() RPC, which is
// scoped to the signed-in user inside the database.

export interface ReferralStats {
  signedUp: number;
  paid: number;
}

export async function loadMyReferralStats(): Promise<ReferralStats> {
  if (!supabaseConfigured || !supabase) return { signedUp: 0, paid: 0 };
  const { data, error } = await supabase.rpc('my_referral_stats');
  if (error || !data || !data.length) return { signedUp: 0, paid: 0 };
  const row = data[0] as { signed_up: number | string; paid: number | string };
  return { signedUp: Number(row.signed_up) || 0, paid: Number(row.paid) || 0 };
}
