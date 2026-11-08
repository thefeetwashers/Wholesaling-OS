import { supabase, supabaseConfigured } from './supabase';

// Slice 69 — JV Board data. Discovery only: posts are real rows under
// RLS (open posts readable by any signed-in user; your own posts
// always readable by you). The JV agreement, signing, and money live
// in the Contracts desk and between the two wholesalers — nothing
// here moves money or forms an agreement.

export interface JvPost {
  id?: string;
  owner_id?: string;
  owner_email: string;
  title: string;
  property_address: string;
  city: string;
  state: string;
  zip: string;
  kind: 'house' | 'land';
  arv?: number | null;
  asking?: number | null;
  split_offered: string;
  notes: string;
  status: 'open' | 'closed';
  created_at?: string;
}

export async function loadJvBoard(): Promise<JvPost[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('jv_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as JvPost[];
}

export async function createJvPost(userId: string, email: string, post: Omit<JvPost, 'status'>): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { error } = await supabase.from('jv_posts').insert({ ...post, owner_id: userId, owner_email: email, status: 'open' });
  return !error;
}

export async function setJvPostStatus(id: string, status: 'open' | 'closed'): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { error } = await supabase.from('jv_posts').update({ status }).eq('id', id);
  return !error;
}

export async function deleteJvPost(id: string): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { error } = await supabase.from('jv_posts').delete().eq('id', id);
  return !error;
}
