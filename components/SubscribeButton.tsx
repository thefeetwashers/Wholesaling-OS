'use client';

// Corrected SubscribeButton. This replaces the pasted version that
// imported a non-existent lib/supabaseClient, used generic stripe.com
// URLs, and faked a Customer Portal link with ?prefilled_email=.
// - Checkout goes to the owner-pasted Payment Link from env, with the
//   user ID as client_reference_id so Stripe can be matched back.
// - The Payment Link is NOT hardcoded here, and it must be the
//   for-profit (THE FEET WASHERS, INC.) link, NOT the nonprofit link
//   that was verified on Oct 27, 2026.
// - Manage Subscription does NOT fake a portal session: Stripe's
//   Customer Portal requires a server-generated session, which does
//   not exist yet. The button says so honestly instead of redirecting
//   to a URL that would fail.
export default function SubscribeButton({ userId, hasAccess }: { userId: string; hasAccess: boolean }) {
  const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || '';

  if (hasAccess) {
    return (
      <div>
        <button disabled style={{ width: '100%', padding: '12px 24px', borderRadius: 8, background: '#1e293b', color: '#fff', fontWeight: 600 }}>
          Manage Subscription — portal session not wired yet
        </button>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          Customer Portal needs a server-generated session (Stripe dashboard or a server route). Do not use a prefilled_email URL — it will not open a real portal session.
        </p>
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
