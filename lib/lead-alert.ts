import type { SupabaseClient } from '@supabase/supabase-js';

// Slice 45 — new-lead alert to the lead's OWNER (the wholesaler the
// lead belongs to — never to the lead). Server-side only: called by
// the intake and webhook routes right after a lead is created while
// the wholesaler is away from the desk. Speed-to-lead is the whole
// point: a seller who asked for contact should not wait until the
// wholesaler happens to open the app.
//
// The email rides the owner's Resend account via RESEND_API_KEY —
// the SAME key Slice 44 uses for in-app email. Until that key is in
// the hosting environment this function quietly does nothing (the
// lead is still created; the alert is dark, never faked). A failed
// send never fails the lead: alerts are best-effort by contract.

export async function alertLeadOwner(
  sb: SupabaseClient,
  ownerId: string,
  lead: { address: string; source: string; detail?: string },
): Promise<void> {
  const key = process.env.RESEND_API_KEY || '';
  if (!key || !ownerId) return;
  try {
    const { data } = await sb.from('profiles').select('email').eq('id', ownerId).maybeSingle();
    const to = (data as { email?: string } | null)?.email;
    if (!to) return;
    const from = process.env.SEND_FROM_EMAIL || 'WholesalingOS <noreply@wholesalingos.thefeetwashers.com>';
    const lines = [
      `A new lead just landed in your WholesalingOS office.`,
      ``,
      `Property: ${lead.address}`,
      `Source: ${lead.source}`,
    ];
    if (lead.detail) lines.push(lead.detail);
    lines.push(``, `Open your office: https://wholesalingos.thefeetwashers.com`);
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `New lead: ${lead.address}`, text: lines.join('\n') }),
    });
  } catch {
    // Best-effort: an alert failure must never break lead creation.
  }
}
