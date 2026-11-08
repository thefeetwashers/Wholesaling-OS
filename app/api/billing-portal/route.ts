import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Slice 92 — the Stripe Customer Portal, wired for real.
// The SubscribeButton's "Manage Subscription" used to say the
// portal session was not wired, because a portal link cannot be
// faked: Stripe requires a server-generated session tied to the
// customer's own Stripe record. This route is that server step:
//   * the caller must be signed in (same /auth/v1/user check the
//     send route uses — the client is never trusted);
//   * the caller's profile must carry a stripe_customer_id,
//     which only the checkout webhook writes after a real
//     subscription starts — no customer record, no portal, and
//     the route says so instead of inventing one;
//   * the session is created for that customer only, with the
//     return address fixed to the app itself.
// Required server env: STRIPE_SECRET_KEY + SUPABASE_SERVICE_ROLE_KEY
// (already in place for the webhook). If Stripe answers that the
// portal is not activated in the dashboard, the route relays that
// honestly rather than swallowing it.

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function verifyUserId(req: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !url || !anon) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } });
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string };
    return j.id || null;
  } catch { return null; }
}

export async function GET() {
  return Response.json({ configured: !!process.env.STRIPE_SECRET_KEY });
}

export async function POST(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return Response.json({ error: 'Sign in required.' }, { status: 401 });

  const secret = process.env.STRIPE_SECRET_KEY || '';
  if (!secret) return Response.json({ error: 'Billing is not configured on the server.' }, { status: 500 });

  const svc = serviceClient();
  if (!svc) return Response.json({ error: 'Billing is not configured on the server.' }, { status: 500 });

  const { data, error } = await svc.from('profiles').select('stripe_customer_id').eq('id', userId).single();
  if (error) return Response.json({ error: 'Your account record could not be read.' }, { status: 500 });

  const customer = (data?.stripe_customer_id as string | null) || null;
  if (!customer) {
    return Response.json({
      error: 'No billing account yet — your subscription starts through the trial link, and this button opens your billing page once Stripe has your account.',
    }, { status: 400 });
  }

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: 'https://wholesalingos.thefeetwashers.com/',
    });
    return Response.json({ url: session.url });
  } catch {
    return Response.json({
      error: 'Stripe could not open the billing portal. If this keeps happening, the Customer Portal may still need activating in the Stripe dashboard.',
    }, { status: 502 });
  }
}
