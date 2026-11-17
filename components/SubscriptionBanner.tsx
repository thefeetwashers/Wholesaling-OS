// Slice 129 — Subscription Banner (top of the dashboard).
//
// Reads the signed-in wholesaler's own saas_subscriptions row:
// trial → days left + "Activate Plan"; active → "Pro Active
// ($150/mo)" + "Manage Billing". The buttons call the
// stripe-billing Edge Function (create_checkout / customer_portal).
//
// Stripe is NOT configured yet (no account, founder researching
// providers): until the function answers with a URL, the button
// shows the honest message "Billing setup pending — the operator is
// setting up Stripe" and does NOT open a dead checkout. No alert()
// — the message lives in the banner itself. When the table does
// not exist yet (migration 20261115170000 not applied), the banner
// hides itself rather than erroring on the dashboard.

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SubRow {
  id: string;
  plan_status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  monthly_rate: number | null;
  is_founder_exempt: boolean;
}

export default function SubscriptionBanner({ userId }: { userId: string }) {
  const [row, setRow] = useState<SubRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('saas_subscriptions')
          .select('id, plan_status, trial_ends_at, stripe_customer_id, monthly_rate, is_founder_exempt')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        if (live) setRow((data as SubRow | null) || null);
      } catch {
        // Table missing (migration not applied yet) or no row —
        // the banner hides; the dashboard must not break.
        if (live) setRow(null);
      } finally {
        if (live) setLoaded(true);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [userId]);

  if (!loaded || !row) return null;

  const daysLeft =
    row.trial_ends_at != null
      ? Math.ceil((new Date(row.trial_ends_at).getTime() - Date.now()) / 86_400_000)
      : null;

  async function callBilling(action: 'create_checkout' | 'customer_portal') {
    setBusy(true);
    setMessage('');
    try {
      if (!supabase) throw new Error('Supabase is not configured on this deployment.');
      const { data, error } = await supabase.functions.invoke('stripe-billing', {
        body: { action },
      });
      if (error) throw new Error(error.message || 'Billing could not be reached.');
      if (!data?.success) {
        // not_configured (Stripe not set up yet) or any other
        // honest refusal — show it in the banner, do not redirect.
        throw new Error(
          (data as { error?: string } | null)?.error ||
            'Billing is not available right now — the operator is setting up Stripe.',
        );
      }
      if (typeof data.url === 'string' && data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('Billing did not return a checkout link.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Billing could not be reached.';
      // A missing deployment is the expected state until the owner
      // deploys the function — the banner says so plainly.
      setMessage(
        /not found|Failed to send|fetch|404/i.test(msg)
          ? 'Billing setup pending — the operator is setting up Stripe.'
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  const isTrial = row.plan_status === 'trialing';
  const isActive = row.plan_status === 'active';
  // Slice 140 — founder billing exemption: an exempt row never
  // sees a trial countdown, an "Activate Plan" button, or a
  // "Manage Billing" button, whatever its plan_status says.
  const isFounderExempt = row.is_founder_exempt === true;

  return (
    <div
      style={{
        background: isFounderExempt ? '#ecfdf5' : isActive ? '#ecfdf5' : isTrial ? '#eff6ff' : '#fffbeb',
        border: `1px solid ${isFounderExempt ? '#a7f3d0' : isActive ? '#a7f3d0' : isTrial ? '#bfdbfe' : '#fde68a'}`,
        borderRadius: 8,
        color: '#0f172a',
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontSize: 13 }}>
        {isFounderExempt && (
          <span>Founder account — no subscription fee. You never pay the $150/mo.</span>
        )}
        {!isFounderExempt && isTrial && (
          <span>
            <strong>Free trial</strong> —{' '}
            {daysLeft == null ? 'trial end date not set' : daysLeft > 0 ? `${daysLeft} days left of your 90 days free` : 'trial expired'} — then $150/mo.
          </span>
        )}
        {!isFounderExempt && isActive && (
          <span>
            <strong>Pro Active ($150/mo)</strong> — your subscription is current.
          </span>
        )}
        {!isFounderExempt && !isTrial && !isActive && (
          <span>
            <strong>Plan: {row.plan_status}</strong> — your subscription is not active.
          </span>
        )}
        {message && <div style={{ marginTop: 6, color: '#92400e' }}>{message}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!isFounderExempt && isTrial && (
          <button
            type="button"
            onClick={() => callBilling('create_checkout')}
            disabled={busy}
            style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Opening…' : 'Activate Plan'}
          </button>
        )}
        {!isFounderExempt && isActive && (
          <button
            type="button"
            onClick={() => callBilling('customer_portal')}
            disabled={busy}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #059669', background: '#fff', color: '#059669', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Opening…' : 'Manage Billing'}
          </button>
        )}
      </div>
    </div>
  );
}
