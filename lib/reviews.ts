import { supabase, supabaseConfigured } from './supabase';

// Slice 88 — reviews after closing (schema v5.4). The prompt goes
// out through the wholesaler's own channels (a mailto link or
// copied text — the platform sends nothing), and the reply is
// recorded verbatim against the closed escrow file: who said it,
// their role on the deal, the rating, and whether they agreed to
// it being published. A review can only be recorded against a
// file the platform counts as closed.

export interface DealReview {
  id?: string;
  escrow_file_id: string;
  reviewer_role: 'buyer' | 'seller';
  reviewer_name: string;
  rating: number;
  review_text?: string | null;
  publish_permission: boolean;
  created_at?: string;
}

export async function loadReviews(userId: string, escrowFileId: string): Promise<DealReview[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('deal_reviews')
    .select('id, escrow_file_id, reviewer_role, reviewer_name, rating, review_text, publish_permission, created_at')
    .eq('owner_id', userId)
    .eq('escrow_file_id', escrowFileId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as DealReview[];
}

export async function addReview(userId: string, review: DealReview): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('deal_reviews').insert({
    owner_id: userId,
    escrow_file_id: review.escrow_file_id,
    reviewer_role: review.reviewer_role,
    reviewer_name: review.reviewer_name.trim(),
    rating: review.rating,
    review_text: review.review_text?.trim() || null,
    publish_permission: review.publish_permission,
  });
  if (error) throw error;
}

export async function deleteReview(userId: string, id: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase.from('deal_reviews').delete().eq('id', id).eq('owner_id', userId);
  if (error) throw error;
}

export function reviewAskText(role: 'buyer' | 'seller'): string {
  const otherSide = role === 'buyer' ? 'seller' : 'buyer';
  return [
    `Hi [first name] — thank you for closing on [property address] with us.`,
    '',
    'Would you be willing to share a few words about how it went — the communication, the timeline, whether we did what we said we would? A sentence or two is plenty, and a rating out of 5 helps.',
    '',
    `If you are comfortable with us quoting you, just say "you may publish this" in your reply. Nothing appears anywhere without those words.`,
    '',
    'Thank you again,',
    '[your name]',
    `[P.S. If a future ${otherSide} asks what working with us is like, your words — only with your permission — are the honest answer.]`,
  ].join('\n');
}
