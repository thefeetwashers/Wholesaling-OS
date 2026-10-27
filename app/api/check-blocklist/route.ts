import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Blocklist check — SERVER ONLY, service-role key required.
// The app sends SHA-256 hashes (hex) of a normalized address / digits-only
// phone, never raw PII in this payload beyond the hash itself. The server
// checks privacy_blocklist (which has NO user policies on purpose) and
// returns only blocked: true/false. No raw entries are ever returned.
// This route exists so outreach can be blocked; the outreach composer
// wiring that calls it before sending is still a future UI step — do not
// claim the app already blocks outreach until that call is wired in.
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Blocklist check not configured on the server.' }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { hashed_address?: string; hashed_phone?: string };
  if (!body.hashed_address && !body.hashed_phone) {
    return NextResponse.json({ error: 'Provide hashed_address or hashed_phone.' }, { status: 400 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  let query = supabase.from('privacy_blocklist').select('id').limit(1);
  if (body.hashed_address) query = query.eq('hashed_address', body.hashed_address);
  else if (body.hashed_phone) query = query.eq('hashed_phone', body.hashed_phone);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Blocklist check failed.' }, { status: 500 });
  return NextResponse.json({ blocked: (data || []).length > 0 });
}
