import { supabase, supabaseConfigured } from './supabase';

// Slice 66 — Seller Trust Signal. The count comes from the database's
// own closing records (escrow outcomes) via a security-definer RPC
// that returns ONLY the number for a public seller page. It is the
// same counted philosophy as buyer tiers: earned, never claimed.

export async function loadPublicWholesalerStats(slug: string): Promise<number | null> {
  if (!supabaseConfigured || !supabase || !slug) return null;
  const { data, error } = await supabase.rpc('public_wholesaler_stats', { p_slug: slug });
  if (error || !data || (data as unknown[]).length === 0) return null;
  const row = (data as { closed_deals: number }[])[0];
  return typeof row.closed_deals === 'number' ? row.closed_deals : null;
}
