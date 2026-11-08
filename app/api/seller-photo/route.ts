import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MAX_PHOTO_BYTES } from '../../../lib/photos';

// Slice 84 — public seller-page photo intake. A seller who just
// submitted their property on /sell/<slug> may attach photos of
// it. Trust is established server-side, never from the request
// alone: the slug must resolve to an enabled seller page, the
// lead_id must belong to that page's owner, carry the
// 'Seller landing page' source, and be fresh (created within the
// last 2 hours — the photo step follows the submission). Images
// only, 5 MB each, at most 6 seller photos per lead. Files land
// in the private lead-photos bucket under the owner's folder and
// are indexed as source 'seller'; only the owner can ever open
// them, through signed URLs in their own office.

const MAX_SELLER_PHOTOS = 6;
const FRESH_MS = 2 * 60 * 60 * 1000;

function fail(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return fail(503, 'Photo uploads are not configured.');

  let form: FormData;
  try { form = await req.formData(); } catch { return fail(400, 'Expected a multipart form.'); }
  const slug = String(form.get('slug') || '').toLowerCase().trim();
  const leadId = String(form.get('lead_id') || '').trim();
  const file = form.get('file');
  if (!slug || !leadId) return fail(400, 'Missing page or lead reference.');
  if (!(file instanceof File)) return fail(400, 'No file was sent.');
  if (!file.type.startsWith('image/')) return fail(400, 'Only image files are accepted.');
  if (file.size < 1 || file.size > MAX_PHOTO_BYTES) return fail(400, 'Image must be between 1 byte and 5 MB.');

  const service = createClient(supabaseUrl, serviceKey);

  const { data: profile } = await service
    .from('profiles')
    .select('id')
    .eq('public_slug', slug)
    .eq('seller_page_enabled', true)
    .maybeSingle();
  if (!profile) return fail(404, 'That seller page is not available.');

  const { data: lead } = await service
    .from('leads')
    .select('owner_id, list_source, created_at')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead || lead.owner_id !== profile.id) return fail(404, 'That submission was not found.');
  if (lead.list_source !== 'Seller landing page') return fail(400, 'Photos attach only to seller-page submissions.');
  if (Date.now() - Date.parse(lead.created_at as string) > FRESH_MS) {
    return fail(400, 'The photo window for this submission has closed — send photos to the company directly.');
  }

  const { count } = await service
    .from('lead_photos')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId);
  if ((count || 0) >= MAX_SELLER_PHOTOS) return fail(400, `Up to ${MAX_SELLER_PHOTOS} photos per property.`);

  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'photo';
  const path = `${profile.id}/${leadId}/${crypto.randomUUID()}-${safe}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await service.storage
    .from('lead-photos')
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) return fail(500, 'The upload failed. Please try again.');

  const { error: insErr } = await service.from('lead_photos').insert({
    owner_id: profile.id, lead_id: leadId, storage_path: path,
    file_name: file.name.slice(0, 200), content_type: file.type, size_bytes: file.size, source: 'seller',
  });
  if (insErr) {
    await service.storage.from('lead-photos').remove([path]).catch(() => undefined);
    return fail(500, 'The upload failed. Please try again.');
  }
  return NextResponse.json({ ok: true });
}
