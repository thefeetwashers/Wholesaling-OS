// Slice 127 — ProbateOutreachModal: draft outreach for one probate
// decision-maker. Written fresh from the spec (NOT pasted — the
// pasted ProbateOutreachModal.tsx crashed on split().trim() /
// charAt-on-an-array, pointed at thefeetwashers.com, hardcoded the
// operator's name/company/phone/slug, invented "24-hour cash offer"
// and "we cover all closing costs" promises, and marked leads
// Contacted when the text was merely copied or opened).
//
// Rules this modal follows:
//   * Scripts reuse the APPROVED probate wording from the scripts
//     desk (lib/scripts-data.ts: "probate" for SMS, "probate-letter"
//     for email) via mergeTemplate — no new promises invented.
//   * The turnaround line is the signed-in wholesaler's own stored
//     turnaround_promise, or the honest default "We reply to every
//     submission" — never a hardcoded "24-hour".
//   * Copy / Open in SMS / Open in Email do NOT change status.
//     Only the explicit "I sent this — Mark as Contacted" button
//     sets outreach_status='Contacted' (write verified).
//   * Name, company, phone, slug come from the signed-in
//     wholesaler's own storefront profile (loadMyStorefront). No
//     profile means blank fields + a note — never the operator's
//     details on another wholesaler's message.
//   * Storefront link is
//     https://wholesalingos.thefeetwashers.com/sell/<own slug>?case=<case>.
//   * County comes from lead.county (", FL" stripped); when unset
//     the location phrase is omitted, never hardcoded.
//   * Name helpers live in lib/probate-import.ts (firstNameOf /
//     formatPersonName) and are guarded against no-comma names.

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  SCRIPT_TEMPLATES,
  mergeTemplate,
} from '../lib/scripts-data';
import {
  firstNameOf,
  formatPersonName,
  type DecisionMaker,
  type ProbateLead,
} from '../lib/probate-import';
import { updateProbateOutreachStatus, logProbateActivity } from '../lib/probate-leads-api';
import type { StorefrontProfile } from '../lib/storefront';

const STOREFRONT_BASE = 'https://wholesalingos.thefeetwashers.com';
const HONEST_TURNAROUND = 'We reply to every submission';

function countyShort(county: string | null | undefined): string {
  if (!county) return '';
  return county.replace(/,\s*FL\s*$/i, '').trim();
}

// Remove merge placeholders that had no value, without inventing
// replacement text: "in {city}" drops out, "the property at
// {address}" becomes "the property".
function cleanPlaceholders(text: string): string {
  return text
    .replace(/ in \{city\}/g, '')
    .replace(/the property at \{address\}/g, 'the property')
    .replace(/\{address\}/g, 'the estate property')
    .replace(/\{city\}/g, '')
    .replace(/\[your phone\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface Props {
  lead: ProbateLead;
  decisionMaker: DecisionMaker;
  userId: string;
  profile: StorefrontProfile | null;
  onClose: () => void;
  onMarkedContacted: () => void;
}

export default function ProbateOutreachModal({ lead, decisionMaker, userId, profile, onClose, onMarkedContacted }: Props) {
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [tone, setTone] = useState<'empathetic' | 'short'>('empathetic');
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');
  const [marked, setMarked] = useState(false);
  const [copied, setCopied] = useState(false);

  const you = profile?.display_name?.trim() || '';
  const biz = profile?.company_name?.trim() || '';
  const phone = profile?.public_phone?.trim() || '';
  const slug = profile?.public_slug?.trim() || '';
  const turnaround = profile?.turnaround_promise?.trim() || HONEST_TURNAROUND;
  const link = slug ? `${STOREFRONT_BASE}/sell/${slug}?case=${encodeURIComponent(lead.case_number)}` : '';
  const city = countyShort(lead.county);
  const address = lead.property_address?.trim() || '';
  const firstName = firstNameOf(decisionMaker.name);
  const fullName = formatPersonName(decisionMaker.name);

  const templates = useMemo(() => {
    const byKey = new Map(SCRIPT_TEMPLATES.map((t) => [t.key, t.body]));
    return {
      sms: byKey.get('probate') || '',
      email: byKey.get('probate-letter') || '',
    };
  }, []);

  // Base drafts from the approved desk wording. The user edits the
  // box before sending; the edited text is what gets copied/opened.
  const baseDraft = useMemo(() => {
    const vars = { name: channel === 'sms' ? firstName : fullName, you, biz, city, address };
    if (channel === 'sms') {
      if (tone === 'short') {
        const head = `Hi ${firstName || '{name}'}, my name is ${you || '{you}'}. I understand your family may have recently inherited the property${address ? ` at ${address}` : ''}, and I want to start by saying I'm sorry for your loss. No pressure at all; I'm here whenever it's useful.`;
        const tail = `${link ? ` You can see how we work here: ${link}` : ''} — ${you || '{you}'}${phone ? ` (${phone})` : ''}. ${turnaround}.`;
        return cleanPlaceholders(head + tail);
      }
      const merged = cleanPlaceholders(mergeTemplate(templates.sms, vars));
      return [merged, link ? `You can see how we work here: ${link}` : '', `${turnaround}.`].filter(Boolean).join('\n\n');
    }
    const merged = cleanPlaceholders(mergeTemplate(templates.email, vars));
    const withTurnaround = merged.replace('\n\nWith sympathy,', `\n\n${turnaround}.\n\nWith sympathy,`);
    return link ? `${withTurnaround}\n\nP.S. You can see how we work and send the property details here: ${link}` : withTurnaround;
  }, [channel, tone, templates, firstName, fullName, you, biz, city, address, link, phone, turnaround]);

  const [message, setMessage] = useState(baseDraft);
  // Rebuild the draft when channel/tone change (the user edits after).
  const [draftKey, setDraftKey] = useState(`${channel}-${tone}`);
  if (draftKey !== `${channel}-${tone}`) {
    setDraftKey(`${channel}-${tone}`);
    setMessage(baseDraft);
  }

  function copyMessage() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        },
        () => setError('Copy failed — select the text manually.'),
      );
    } else {
      setError('Copy is not available in this browser — select the text manually.');
    }
  }

  function openChannel() {
    if (channel === 'sms') {
      if (!decisionMaker.phone) {
        setError('No phone number on file for this decision-maker — copy the text instead, or add a number with Skip Trace / Find Contact.');
        return;
      }
      window.open(`sms:${decisionMaker.phone}?body=${encodeURIComponent(message)}`, '_blank');
    } else {
      if (!decisionMaker.email) {
        setError('No email on file for this decision-maker — copy the text instead, or add an email with Skip Trace / Find Contact.');
        return;
      }
      const subject = encodeURIComponent(`Regarding case ${lead.case_number}`);
      window.open(`mailto:${decisionMaker.email}?subject=${subject}&body=${encodeURIComponent(message)}`, '_blank');
    }
  }

  // Copying or opening the app is NOT contacting the person — they
  // may never send it. Only this button marks the lead Contacted,
  // after the wholesaler actually sent the message.
  async function markAsContacted() {
    setMarking(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase is not configured on this deployment.');
      await updateProbateOutreachStatus(userId, lead.id || '', 'Contacted');
      setMarked(true);
      onMarkedContacted();
      // Contact history: written ONLY here, when the wholesaler
      // actually sent the message. Copying or opening the app
      // never reaches this line.
      try {
        await logProbateActivity(
          userId,
          lead.id || '',
          channel === 'sms' ? 'sms' : 'email',
          `Outreach sent via ${channel === 'sms' ? 'SMS' : 'email'} to ${fullName || decisionMaker.name} (case ${lead.case_number})`,
        );
      } catch (logError) {
        setError(`Marked as Contacted, but the contact history could not be saved: ${logError instanceof Error ? logError.message : 'unknown error'}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark this lead as Contacted.');
    } finally {
      setMarking(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#fff', color: '#0f172a', borderRadius: 12, padding: 20, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Draft Outreach — {lead.case_number}</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 4px' }}>
          To: {fullName || decisionMaker.name} ({decisionMaker.role})
          {lead.decedent_name ? ` • Estate of ${formatPersonName(lead.decedent_name)}` : ''}
        </p>
        {!profile && (
          <p style={{ fontSize: 13, color: '#b45309', margin: '0 0 12px' }}>
            Fill in Storefront Settings to add your name and number — this draft leaves them blank rather than using anyone else&apos;s details.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 12, color: '#64748b', marginRight: 6 }}>Channel:</span>
            <button type="button" onClick={() => setChannel('sms')} style={{ padding: '6px 12px', borderRadius: 999, border: channel === 'sms' ? '2px solid #0f172a' : '1px solid #cbd5e1', background: channel === 'sms' ? '#0f172a' : '#fff', color: channel === 'sms' ? '#fff' : '#0f172a', cursor: 'pointer', fontSize: 13 }}>
              SMS
            </button>{' '}
            <button type="button" onClick={() => setChannel('email')} style={{ padding: '6px 12px', borderRadius: 999, border: channel === 'email' ? '2px solid #0f172a' : '1px solid #cbd5e1', background: channel === 'email' ? '#0f172a' : '#fff', color: channel === 'email' ? '#fff' : '#0f172a', cursor: 'pointer', fontSize: 13 }}>
              Email
            </button>
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#64748b', marginRight: 6 }}>Tone:</span>
            <button type="button" onClick={() => setTone('empathetic')} style={{ padding: '6px 12px', borderRadius: 999, border: tone === 'empathetic' ? '2px solid #0f172a' : '1px solid #cbd5e1', background: tone === 'empathetic' ? '#0f172a' : '#fff', color: tone === 'empathetic' ? '#fff' : '#0f172a', cursor: 'pointer', fontSize: 13 }}>
              Empathetic (recommended)
            </button>{' '}
            <button type="button" onClick={() => setTone('short')} style={{ padding: '6px 12px', borderRadius: 999, border: tone === 'short' ? '2px solid #0f172a' : '1px solid #cbd5e1', background: tone === 'short' ? '#0f172a' : '#fff', color: tone === 'short' ? '#fff' : '#0f172a', cursor: 'pointer', fontSize: 13 }}>
              Short &amp; Direct
            </button>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
          Message (edit before sending — the edited text is what gets copied or opened):
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={channel === 'email' ? 14 : 8}
          style={{ width: '100%', fontSize: 13, padding: 10, border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' }}
        />

        {error && <p style={{ fontSize: 13, color: '#b91c1c', margin: '8px 0 0' }}>{error}</p>}
        {marked && <p style={{ fontSize: 13, color: '#166534', margin: '8px 0 0' }}>Marked as Contacted.</p>}
        {copied && <p style={{ fontSize: 13, color: '#166534', margin: '8px 0 0' }}>Copied to clipboard.</p>}

        <p style={{ fontSize: 12, color: '#64748b', margin: '10px 0 0' }}>
          Copying this text or opening the SMS / email app does NOT mark the lead as contacted — only
          the button below does, after you actually send it.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={copyMessage} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
            Copy message
          </button>
          <button type="button" onClick={openChannel} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
            {channel === 'sms' ? 'Open in SMS App' : 'Open in Email App'}
          </button>
          <button type="button" onClick={markAsContacted} disabled={marking || marked} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: marking || marked ? 'not-allowed' : 'pointer', opacity: marking || marked ? 0.6 : 1 }}>
            {marking ? 'Marking…' : marked ? 'Marked as Contacted ✓' : 'I sent this — Mark as Contacted'}
          </button>
          <button type="button" onClick={onClose} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
