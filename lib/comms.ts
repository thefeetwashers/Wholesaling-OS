import type { Lead } from './leads';
import { sha256Hex } from './outreach';

// Slice 24 — comms center helpers. Every channel here is a link the
// wholesaler taps and sends from their OWN phone/accounts (tel:, sms:,
// wa.me, mailto:, Google Voice). The platform sends nothing and dials
// nothing — there is no auto-send or auto-dial anywhere in this file.

export function digitsOnly(phone?: string | null): string {
  return (phone || '').replace(/\D/g, '');
}

// wa.me needs international format; assume US (+1) for 10-digit numbers.
export function whatsAppDigits(phone?: string | null): string {
  const d = digitsOnly(phone);
  if (d.length === 10) return '1' + d;
  return d;
}

export function firstPhone(lead: Lead): string {
  return (lead.phones && lead.phones[0]) || '';
}

export function firstEmail(lead: Lead): string {
  return (lead.emails && lead.emails[0]) || '';
}

export function isDoNotContact(lead: Lead): boolean {
  return Boolean(lead.do_not_contact) || lead.consent_status === 'opted_out';
}

export function consentLabel(lead: Lead): string {
  switch (lead.consent_status) {
    case 'requested_contact':
      return 'Requested contact — this person asked to be contacted' +
        (lead.consent_source ? ` (${lead.consent_source})` : '');
    case 'express_consent':
      return 'Express consent recorded' +
        (lead.consent_source ? ` — ${lead.consent_source}` : '');
    case 'opted_out':
      return 'Opted out — do not contact';
    default:
      return 'No consent on file — one-to-one human outreach only';
  }
}

export interface ChannelLinks {
  tel?: string;
  sms?: string;
  whatsapp?: string;
  mailto?: string;
  voiceUrl: string;
}

// Build the tap-to-contact links for a lead + merged message. Links
// exist only for contact details actually on file — nothing invented.
export function channelLinks(lead: Lead, mergedText: string): ChannelLinks {
  const phone = firstPhone(lead);
  const email = firstEmail(lead);
  const digits = digitsOnly(phone);
  const links: ChannelLinks = { voiceUrl: 'https://voice.google.com/' };
  if (digits) {
    links.tel = digits.length === 10 ? `tel:+1${digits}` : `tel:${digits}`;
    links.sms = `sms:${digits}?&body=${encodeURIComponent(mergedText)}`;
    links.whatsapp = `https://wa.me/${whatsAppDigits(phone)}?text=${encodeURIComponent(mergedText)}`;
  }
  if (email) {
    links.mailto = `mailto:${email}?subject=${encodeURIComponent('Your property at ' + lead.property_address)}&body=${encodeURIComponent(mergedText)}`;
  }
  return links;
}

export type BlocklistAddResult = 'added' | 'already' | 'unconfigured' | 'error';

// Ask the server to add this contact's hashes to the platform-wide
// blocklist (privacy_blocklist, service-role only). Mirrors the check
// route's honesty contract: 'unconfigured' means the server key is not
// set yet, and the caller must say so instead of pretending it worked.
export async function addToBlocklist(address?: string, phone?: string): Promise<BlocklistAddResult> {
  const body: Record<string, string> = {};
  if (phone && phone.trim()) body.hashed_phone = await sha256Hex(phone.replace(/\D/g, ''));
  if (address && address.trim()) body.hashed_address = await sha256Hex(address.toLowerCase().trim().replace(/\s+/g, ' '));
  if (!body.hashed_phone && !body.hashed_address) return 'error';
  try {
    const res = await fetch('/api/blocklist-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 500) return 'unconfigured';
    if (!res.ok) return 'error';
    const data = (await res.json()) as { added?: boolean; already?: boolean };
    return data.added ? 'added' : 'already';
  } catch {
    return 'error';
  }
}
