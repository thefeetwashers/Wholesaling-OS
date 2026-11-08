'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Corrected SubscribeButton. This replaces the pasted version that
// imported a non-existent lib/supabaseClient, used generic stripe.com
// URLs, and faked a Customer Portal link with ?prefilled_email=.
// - Checkout goes to the owner-pasted Payment Link from env, with the
//   user ID as client_reference_id so Stripe can be matched back.
// - The Payment Link is NOT hardcoded here, and it must be the
//   for-profit (THE FEET WASHERS, INC.) link, NOT the nonprofit link
//   that was verified on Oct 27, 2026.
// - Manage Subscription (Slice 92): opens a REAL Stripe Customer
//   Portal session created on the server (/api/billing-portal) for
//   this account's own Stripe customer record. Until a subscription
//   exists there is no customer record — the server says so and the
//   message shows here, instead of a link that would fail.
export default function SubscribeButton({ userId, hasAccess }: { userId: string; hasAccess: boolean }) {
  const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || '';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (hasAccess) {
    const openPortal = async () => {
      setBusy(true);
      setMsg('');
      try {
        const { data } = await supabase!.auth.getSession();
        const token = data.session?.access_token || '';
        const res = await fetch('/api/billing-portal', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (j.url) { window.location.href = j.url; return; }
        setMsg(j.error || 'The billing portal could not be opened.');
      } catch {
        setMsg('The billing portal could not be opened.');
      }
      setBusy(false);
    };
    return (
      <div>
        <button onClick={openPortal} disabled={busy} style={{ width: '100%', padding: '12px 24px', borderRadius: 8, background: '#1e293b', color: '#fff', fontWeight: 600 }}>
          {busy ? 'Opening your billing page…' : 'Manage Subscription'}
        </button>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          Opens your Stripe billing page — update your card, download invoices, or cancel. The session is
          generated on our server for your account only.
        </p>
        {msg && <p style={{ fontSize: 13, color: '#fca5a5' }}>{msg}</p>}
      </div>
    );
  }

  if (!paymentLink) {
    return (
      <div>
        <button disabled style={{ width: '100%', padding: '12px 24px', borderRadius: 8, background: '#334155', color: '#fff', fontWeight: 600 }}>
          Start 90-Day Free Trial — payment link not set
        </button>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          Owner step: paste the for-profit WholesalingOS Pro Payment Link ($150/mo, 90 days free) as NEXT_PUBLIC_STRIPE_PAYMENT_LINK. Do not use the nonprofit link verified Oct 27, 2026.
        </p>
      </div>
    );
  }

  const checkoutUrl = `${paymentLink}?client_reference_id=${encodeURIComponent(userId)}`;
  return (
    <a href={checkoutUrl} style={{ display: 'block', width: '100%', padding: '12px 24px', borderRadius: 8, background: '#059669', color: '#fff', fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
      Start 90-Day Free Trial
    </a>
  );
}
