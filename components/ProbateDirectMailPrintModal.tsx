// Slice 127 — ProbateDirectMailPrintModal: print-ready probate
// letter with QR code for one decision-maker. Written fresh from
// the spec (NOT pasted — the pasted ProbateDirectMailPrintModal.tsx
// pointed its QR at thefeetwashers.com, built a malformed QR URL
// with no endpoint or data parameter, hardcoded the operator's
// name/company/phone/email/slug and a Fort Pierce return address,
// printed a placeholder string as the recipient's real address,
// marked the lead Contacted on print, invented "24-hour cash
// offer" / "we cover closing costs" promises, and crashed on a
// no-comma name).
//
// Rules this modal follows:
//   * QR code: real goqr.me API format —
//     https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=<encoded URL>
//     (verified live 2026-11-16: HTTP 200, image/png, 200x200).
//     The text URL prints under the QR as the fallback, and a
//     failed image hides itself instead of printing broken.
//   * QR + text URL are
//     https://wholesalingos.thefeetwashers.com/sell/<own slug>?case=<case>
//     from the signed-in wholesaler's own public_slug.
//   * Letter body reuses the APPROVED probate-letter template from
//     the scripts desk (lib/scripts-data.ts) — no new promises.
//     Turnaround line is the wholesaler's own stored
//     turnaround_promise, or "We reply to every submission".
//   * Recipient address defaults to decisionMaker.mailing_address ||
//     lead.property_address || "" (EMPTY — the example text lives in
//     the input's placeholder attribute, never as a value). Print is
//     blocked while the recipient address is empty.
//   * Return address is an editable toolbar field, EMPTY by default;
//     the letter prints it only when the wholesaler enters one.
//   * Print does NOT change status. Only the explicit "I mailed
//     this — Mark as Contacted" button sets outreach_status=
//     'Contacted' (write verified).
//   * County comes from lead.county (", FL" stripped); when unset
//     the location phrase is omitted, never hardcoded.
//   * Name helpers live in lib/probate-import.ts and are guarded
//     against no-comma names.

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SCRIPT_TEMPLATES, mergeTemplate } from '../lib/scripts-data';
import {
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

export default function ProbateDirectMailPrintModal({ lead, decisionMaker, userId, profile, onClose, onMarkedContacted }: Props) {
  // Empty by default — the example text is the input's placeholder
  // attribute, never a value that could print on the letter.
  const [recipientAddress, setRecipientAddress] = useState(
    decisionMaker.mailing_address || lead.property_address || '',
  );
  const [returnAddress, setReturnAddress] = useState('');
  const [qrFailed, setQrFailed] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');
  const [marked, setMarked] = useState(false);

  const you = profile?.display_name?.trim() || '';
  const biz = profile?.company_name?.trim() || '';
  const phone = profile?.public_phone?.trim() || '';
  const email = profile?.public_email?.trim() || '';
  const slug = profile?.public_slug?.trim() || '';
  const turnaround = profile?.turnaround_promise?.trim() || HONEST_TURNAROUND;
  const storefrontUrl = slug ? `${STOREFRONT_BASE}/sell/${slug}?case=${encodeURIComponent(lead.case_number)}` : '';
  const qrUrl = storefrontUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(storefrontUrl)}`
    : '';
  const city = countyShort(lead.county);
  const address = lead.property_address?.trim() || '';
  const fullName = formatPersonName(decisionMaker.name);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const letterBody = useMemo(() => {
    const template = SCRIPT_TEMPLATES.find((t) => t.key === 'probate-letter')?.body || '';
    const vars = { name: fullName, you, biz, city, address };
    const merged = cleanPlaceholders(mergeTemplate(template, vars));
    // Turnaround line goes before the sign-off; the template itself
    // makes no timing promise.
    return merged.replace('\n\nWith sympathy,', `\n\n${turnaround}.\n\nWith sympathy,`);
  }, [fullName, you, biz, city, address, turnaround]);

  const recipientEmpty = !recipientAddress.trim();
  const canPrint = !recipientEmpty && !!storefrontUrl;

  function printLetter() {
    if (recipientEmpty) {
      setError('Add the recipient mailing address first — a letter with no address cannot be mailed.');
      return;
    }
    if (!storefrontUrl) {
      setError('Save Storefront Settings first — the letter needs your storefront link for the QR code.');
      return;
    }
    setError('');
    window.print();
  }

  // Printing is not mailing. Only this button marks Contacted,
  // after the wholesaler actually mailed the letter.
  async function markAsMailed() {
    setMarking(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase is not configured on this deployment.');
      await updateProbateOutreachStatus(userId, lead.id || '', 'Contacted');
      setMarked(true);
      onMarkedContacted();
      // Contact history: written ONLY here, when the wholesaler
      // actually mailed the letter. Printing alone never reaches
      // this line.
      try {
        await logProbateActivity(
          userId,
          lead.id || '',
          'mail',
          `Letter mailed to ${fullName || decisionMaker.name} (case ${lead.case_number})`,
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

  const bodyParagraphs = letterBody.split('\n\n').filter(Boolean);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-probate-letter, #printable-probate-letter * { visibility: visible !important; }
          #printable-probate-letter { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div style={{ background: '#fff', color: '#0f172a', borderRadius: 12, padding: 20, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Print Letter — {lead.case_number}</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
          To: {fullName || decisionMaker.name} ({decisionMaker.role})
          {lead.decedent_name ? ` • Estate of ${formatPersonName(lead.decedent_name)}` : ''}. The letter uses the
          approved probate-letter wording from the scripts desk. Printing does not change the lead&apos;s status.
        </p>
        {!profile && (
          <p style={{ fontSize: 13, color: '#b45309', margin: '0 0 12px' }}>
            Fill in Storefront Settings to add your name, company, and number — this letter leaves them
            blank rather than using anyone else&apos;s details.
          </p>
        )}

        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>
            Recipient mailing address (required to print)
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Fort Pierce, FL 34950"
              style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            Your return address (optional — printed only if you enter one)
            <input
              type="text"
              value={returnAddress}
              onChange={(e) => setReturnAddress(e.target.value)}
              placeholder="e.g. 456 Oak Ave, Fort Pierce, FL 34950"
              style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }}
            />
          </label>
        </div>

        {error && <p style={{ fontSize: 13, color: '#b91c1c', margin: '0 0 8px' }}>{error}</p>}
        {marked && <p style={{ fontSize: 13, color: '#166534', margin: '0 0 8px' }}>Marked as Contacted.</p>}
        {recipientEmpty && (
          <p style={{ fontSize: 13, color: '#b45309', margin: '0 0 8px' }}>
            The recipient address is empty — add it above to enable printing. It defaults to the
            decision-maker&apos;s mailing address, or the property address when that is all we have.
          </p>
        )}
        {!storefrontUrl && (
          <p style={{ fontSize: 13, color: '#b45309', margin: '0 0 8px' }}>
            No storefront slug saved — the QR code needs your storefront link. Save Storefront Settings first.
          </p>
        )}

        <div id="printable-probate-letter" style={{ width: '8.5in', maxWidth: '100%', margin: '0 auto', padding: 32, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', fontSize: 14, lineHeight: 1.6, color: '#0f172a' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{biz || 'Local Florida Property Acquisitions'}</div>
            {[you, phone, email].filter(Boolean).join(' • ') && (
              <div style={{ fontSize: 12, color: '#475569' }}>{[you, phone, email].filter(Boolean).join(' • ')}</div>
            )}
            {returnAddress.trim() && <div style={{ fontSize: 12, color: '#475569' }}>{returnAddress.trim()}</div>}
          </div>

          <div style={{ marginBottom: 16 }}>{today}</div>

          <div style={{ marginBottom: 16, whiteSpace: 'pre-line' }}>
            {fullName || decisionMaker.name}
            {'\n'}
            {recipientAddress.trim()}
          </div>

          <div style={{ marginBottom: 16 }}>
            Re: Estate of {formatPersonName(lead.decedent_name) || 'the decedent'} — Case #{lead.case_number}
          </div>

          {bodyParagraphs.map((p, i) => (
            <p key={i} style={{ margin: '0 0 12px' }}>{p}</p>
          ))}

          {storefrontUrl && (
            <div style={{ marginTop: 24, padding: 16, border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>See how we work — and send the property details online</div>
              {!qrFailed && (
                <img
                  src={qrUrl}
                  alt="QR code linking to this wholesaler's storefront page for this case"
                  width={200}
                  height={200}
                  onError={() => setQrFailed(true)}
                  style={{ display: 'block', margin: '0 auto 8px' }}
                />
              )}
              <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{storefrontUrl}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{turnaround}.</div>
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: '#64748b', margin: '12px 0 0' }}>
          Printing this letter does NOT mark the lead as contacted — only the button below does, after
          you actually mail it. The QR code points at your own storefront page for this case; the
          property submission goes to your leads (list_source &lsquo;Seller landing page&rsquo;).
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={printLetter}
            disabled={!canPrint}
            title={recipientEmpty ? 'Add the recipient mailing address first' : !storefrontUrl ? 'Save Storefront Settings first' : 'Print this letter'}
            style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: canPrint ? 'pointer' : 'not-allowed', opacity: canPrint ? 1 : 0.5 }}
          >
            Print Letter
          </button>
          <button type="button" onClick={markAsMailed} disabled={marking || marked} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: marking || marked ? 'not-allowed' : 'pointer', opacity: marking || marked ? 0.6 : 1 }}>
            {marking ? 'Marking…' : marked ? 'Marked as Contacted ✓' : 'I mailed this — Mark as Contacted'}
          </button>
          <button type="button" onClick={onClose} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
