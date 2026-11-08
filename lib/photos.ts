import { supabase, supabaseConfigured } from './supabase';

// Slice 84 — lead photo attachments (schema v5.2). Files live in
// the PRIVATE 'lead-photos' storage bucket under
// <owner_id>/<lead_id>/<file>; the lead_photos table indexes them
// and every display URL is a short-lived signed URL minted for
// the signed-in owner. Nothing about this bucket is public.

export interface LeadPhoto {
  id: string;
  lead_id: string;
  storage_path: string;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  source: 'wholesaler' | 'seller';
  created_at: string;
  url?: string;
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS_PER_LEAD = 12;

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'photo';
}

export async function loadLeadPhotos(userId: string, leadId: string): Promise<LeadPhoto[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('lead_photos')
    .select('id, lead_id, storage_path, file_name, content_type, size_bytes, source, created_at')
    .eq('owner_id', userId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as LeadPhoto[];
  if (rows.length === 0) return rows;
  const { data: signed } = await supabase.storage
    .from('lead-photos')
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  const urlByPath = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) || undefined }));
}

export async function uploadLeadPhoto(userId: string, leadId: string, file: File): Promise<void> {
  if (!supabaseConfigured || !supabase) throw new Error('Storage is not configured.');
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  if (file.size > MAX_PHOTO_BYTES) throw new Error('That image is over 5 MB.');
  const path = `${userId}/${leadId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from('lead-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  const { error: insErr } = await supabase.from('lead_photos').insert({
    owner_id: userId, lead_id: leadId, storage_path: path,
    file_name: file.name.slice(0, 200), content_type: file.type, size_bytes: file.size, source: 'wholesaler',
  });
  if (insErr) {
    await supabase.storage.from('lead-photos').remove([path]).catch(() => undefined);
    throw insErr;
  }
}

export async function deleteLeadPhoto(userId: string, photo: LeadPhoto): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  await supabase.storage.from('lead-photos').remove([photo.storage_path]);
  const { error } = await supabase
    .from('lead_photos')
    .delete()
    .eq('id', photo.id)
    .eq('owner_id', userId);
  if (error) throw error;
}
