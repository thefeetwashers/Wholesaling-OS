import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Slice 125 — signed playback URL for a wholesaler's video
// hello. The /sell/<slug> page calls this with the page slug;
// the route verifies the slug, reads that wholesaler's video
// path from their storefront profile, and mints a short-lived
// signed URL (1 hour). The 'storefront-videos' bucket stays
// private — there is no public listing of videos, and a video
// plays only on its own wholesaler's page. No video, or no
// configuration, returns { url: null } and the page simply shows
// no video.

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const slug = (req.nextUrl.searchParams.get('slug') || '').toLowerCase().trim();
  if (!slug) return NextResponse.json({ url: null });
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ url: null });

  const service = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await service
    .from('storefront_profiles')
    .select('video_url')
    .eq('public_slug', slug)
    .maybeSingle();
  const path = (profile?.video_url as string) || '';
  if (!path) return NextResponse.json({ url: null });

  const { data, error } = await service.storage
    .from('storefront-videos')
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return NextResponse.json({ url: null });
  return NextResponse.json({ url: data.signedUrl });
}
