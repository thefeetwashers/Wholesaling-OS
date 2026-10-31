import { supabase, supabaseConfigured } from './supabase';

// Trial / subscription access, read from the user's own profiles row.
// This mirrors the database has_access() function — it is a read, not
// an enforcement gate for the server. Stripe webhooks (server route)
// are what actually move a profile between trialing / active / past_due.
export interface ProfileAccess {
  subscription_status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  admin_suspended?: boolean | null;
}

export function hasAccess(p: ProfileAccess | null): boolean {
  if (!p) return false;
  if (p.admin_suspended) return false;
  if (p.subscription_status === 'active') return true;
  if (p.subscription_status === 'trialing' && p.trial_ends_at) {
    return new Date(p.trial_ends_at).getTime() > Date.now();
  }
  return false;
}

export async function getProfileAccess(userId: string): Promise<ProfileAccess | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, stripe_customer_id, admin_suspended')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as ProfileAccess;
}
