import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Blocklist add — SERVER ONLY, service-role key required.
// The client sends SHA-256 hashes (hex) of the normalized address /
// digits-only phone, never the raw values. The hashes go into
// privacy_blocklist, which has NO user policies on purpose: entries
// can be checked and added only through these server routes, and raw
// entries are never returned to any client.
// A duplicate hash is a success (already blocked), not an error.
// Until SUPABASE_SERVICE_ROLE_KEY is set in the hosting environment
// this returns 500 and the client tells the wholesaler plainly that
// the platform-wide entry is pending — the lead-level do-not-contact
// flag in their own office is set immediately either way.
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Blocklist add not configured on the server.' }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { hashed_address?: string; hashed_phone?: string };
  if (!body.hashed_address && !body.hashed_phone) {
    return NextResponse.json({ error: 'Provide hashed_address or hashed_phone.' }, { status: 400 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const row: Record<string, string> = {};
  if (body.hashed_address) row.hashed_address = body.hashed_address;
  if (body.hashed_phone) row.hashed_phone = body.hashed_phone;
  const { error } = await supabase.from('privacy_blocklist').insert(row);
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ added: false, already: true });
    }
    return NextResponse.json({ error: 'Blocklist add failed.' }, { status: 500 });
  }
  return NextResponse.json({ added: true });
}
