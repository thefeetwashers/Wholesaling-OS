import { supabase, supabaseConfigured } from './supabase';

// Slice 39 — the wholesaler's own lenders & vendors directory
// (schema v4.3). Private rows under RLS: a wholesaler sees and edits
// only their own contacts. The platform seeds none and verifies
// none — an entry means "I work with this contact", never an
// endorsement, a rate quote, or a funding promise. The Loan Officer
// Bot stays rejected: nothing here packages or submits a loan
// application; this is an address book, with click-to-call/email.

export const VENDOR_CATEGORIES: { key: string; label: string }[] = [
  { key: 'hard_money_lender', label: 'Hard-money lender' },
  { key: 'private_lender', label: 'Private lender' },
  { key: 'transactional_funder', label: 'Transactional funder' },
  { key: 'contractor', label: 'Contractor' },
  { key: 'inspector', label: 'Inspector' },
  { key: 'photographer', label: 'Photographer / media' },
  { key: 'cleaner', label: 'Cleaner / cleanout' },
  { key: 'handyman', label: 'Handyman' },
  { key: 'other', label: 'Other vendor' },
];

export function categoryLabel(key: string): string {
  return VENDOR_CATEGORIES.find((c) => c.key === key)?.label || 'Other vendor';
}

export interface VendorRow {
  id?: string;
  owner_id?: string;
  category: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  service_area?: string | null;
  notes?: string | null;
  created_at?: string;
}

const clean = (v?: string | null): string | null => {
  const t = (v || '').trim();
  return t ? t : null;
};

export async function loadVendors(userId: string): Promise<VendorRow[] | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('directory_contacts')
    .select('*')
    .eq('owner_id', userId)
    .order('category')
    .order('name');
  if (error) throw error;
  return (data || []) as VendorRow[];
}

export async function saveVendor(userId: string, v: VendorRow): Promise<VendorRow | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('directory_contacts')
    .insert({
      owner_id: userId,
      category: v.category,
      name: v.name.trim(),
      phone: clean(v.phone),
      email: clean(v.email),
      website: clean(v.website),
      service_area: clean(v.service_area),
      notes: clean(v.notes),
    })
    .select()
    .single();
  if (error) throw error;
  return data as VendorRow;
}

export async function deleteVendor(userId: string, id: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('directory_contacts')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId);
  if (error) throw error;
}
