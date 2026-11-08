import type { SupabaseClient } from '@supabase/supabase-js';
import { mailProvider, sendMail } from './server-mail';

// Slice 45 — new-lead alert to the lead's OWNER (the wholesaler the
// lead belongs to — never to the lead). Server-side only: called by
// the intake and webhook routes right after a lead is created while
// the wholesaler is away from the desk. Speed-to-lead is the whole
// point: a seller who asked for contact should not wait until the
// wholesaler happens to open the app.
//
// The email rides the platform mail provider (lib/server-mail):
// direct Amazon SES by the owner's Nov 8, 2026 decision, Resend as
// fallback. Until a provider is configured in the hosting
// environment this function quietly does nothing (the lead is still
// created; the alert is dark, never faked). A failed send never
// fails the lead: alerts are best-effort by contract.

export async function alertLeadOwner(
  sb: SupabaseClient,
  ownerId: string,
  lead: { address: string; source: string; detail?: string },
): Promise<void> {
  if (!mailProvider() || !ownerId) return;
  try {
    const { data } = await sb.from('profiles').select('email').eq('id', ownerId).maybeSingle();
    const to = (data as { email?: string } | null)?.email;
    if (!to) return;
    const lines = [
      `A new lead just landed in your WholesalingOS office.`,
      ``,
      `Property: ${lead.address}`,
      `Source: ${lead.source}`,
    ];
    if (lead.detail) lines.push(lead.detail);
    lines.push(``, `Open your office: https://wholesalingos.thefeetwashers.com`);
    await sendMail(to, `New lead: ${lead.address}`, lines.join('\n'));
  } catch {
    // Best-effort: an alert failure must never break lead creation.
  }
}
