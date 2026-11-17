// Slice 135 — Bulk FL Parcel Enricher route (POST).
//
// Server-side only: the browser never calls the cadastral
// service directly — this route is the only caller, same as
// /api/property-lookup. Auth: session-verified against Supabase
// Auth, same pattern as /api/property-lookup and
// /api/state-records — a subscriber feature, not a public
// endpoint. Body: { parcelIds: string[] } (up to 50 —
// lib/parcel-enrich.ts refuses more before any fetch).
//
// The route stores nothing: results are returned to the
// wholesaler, who saves a phone/email per row only by typing it
// in the UI (wholesaler-entered, source + date), and saves a
// row as a lead only by tapping that action. No bulk skip-trace,
// no email/SMS blast, no auto-send.

import { enrichFlParcels, parseParcelIdInput } from '../../../lib/parcel-enrich';

export const dynamic = 'force-dynamic';

async function verifyUserId(req: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !url || !anon) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string };
    return u.id || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return Response.json({ error: 'Sign in required.' }, { status: 401 });

  let parcelIds: string[] = [];
  try {
    const body = (await req.json()) as { parcelIds?: unknown; raw?: unknown };
    if (Array.isArray(body.parcelIds)) {
      parcelIds = body.parcelIds.filter((v): v is string => typeof v === 'string');
    } else if (typeof body.raw === 'string') {
      parcelIds = parseParcelIdInput(body.raw);
    }
  } catch {
    return Response.json({ rows: [], error: 'That request could not be read — paste the parcel IDs and try again.' });
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const result = await enrichFlParcels(parcelIds, ctl.signal);
    return Response.json(result);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return Response.json({ rows: [], error: 'The Florida cadastral service took too long to answer. Try a smaller batch.' });
    }
    return Response.json({ rows: [], error: (e as Error)?.message || 'The Florida cadastral service could not be reached.' });
  } finally {
    clearTimeout(timer);
  }
}
