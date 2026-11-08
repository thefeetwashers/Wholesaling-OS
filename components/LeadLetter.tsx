'use client';

import { useState } from 'react';
import { SCRIPT_TEMPLATES, mergeTemplate } from '../lib/scripts-data';
import { loadLetterIdentity, saveLetterIdentity, escHtml, openPrintWindow, type LetterIdentity } from '../lib/letter-identity';
import type { Lead } from '../lib/leads';

// Slice 62 — one-click direct-mail letter for a lead. Mail is the
// lawful front door to a seller: the owner's mailing address is a
// public record, a letter needs no consent regime, and the letter
// points the seller at the wholesaler's seller page — where the
// seller hands over their number themselves, consent stamped.
// This button merges the platform's direct-mail template with
// THIS lead and the wholesaler's own letter identity, and opens
// a print view with a window-envelope address block. Nothing is
// sent by the platform; the wholesaler prints and mails it.

export default function LeadLetter({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [idn, setIdn] = useState<LetterIdentity>(() => loadLetterIdentity());

  const tpl = SCRIPT_TEMPLATES.find((s) => s.key === 'directmail');

  // One merge, two readers: the inline preview below and the print
  // window both render THIS text, so what the wholesaler reads is
  // exactly what prints. (Inline preview added after the Slice 62
  // live verification found the panel showed fields only.)
  const mergedBody = (): string => {
    if (!tpl) return '';
    let body = mergeTemplate(tpl.body, {
      name: lead.owner_name || 'Homeowner',
      you: idn.you || '{you}',
      biz: idn.biz || '{biz}',
      city: lead.city || '{city}',
      address: lead.property_address || '{address}',
    });
    body = body.split('[your phone]').join(idn.phone || '[your phone]');
    body = body.split('[your email]').join(idn.email || '[your email]');
    return body;
  };

  const printLetter = () => {
    if (!tpl) return;
    saveLetterIdentity(idn);
    const body = mergedBody();
    const addrLines = [
      lead.owner_name || '',
      lead.mailing_address || lead.property_address || '',
      `${lead.mailing_city || lead.city || ''}${(lead.mailing_city || lead.city) ? ', ' : ''}${lead.mailing_state || lead.state || ''} ${lead.mailing_zip || lead.zip || ''}`.trim(),
    ].filter(Boolean);
    const html = `
<style>body{font-family:Georgia,serif;margin:56px;color:#111;line-height:1.55;font-size:14.5px}
.addr{font-family:Arial,sans-serif;font-size:13.5px;margin-bottom:44px}
.letter{white-space:pre-wrap}</style>
<div class="addr">${addrLines.map((l) => escHtml(l)).join('<br/>')}</div>
<div class="letter">${escHtml(body)}</div>`;
    openPrintWindow(`Letter — ${lead.property_address}`, html);
  };

  const inp = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 6, color: '#fff', padding: '5px 8px', fontSize: 13, marginRight: 6, marginTop: 4 } as const;

  return (
    <span>
      {' '}
      <button onClick={() => setOpen(!open)} style={{ fontSize: 12.5, padding: '2px 8px' }}>✉️ Letter</button>
      {open && (
        <span style={{ display: 'block', marginTop: 6, background: '#0f172a', padding: 10, borderRadius: 8, fontSize: 13 }}>
          <span style={{ display: 'block', color: '#94a3b8', marginBottom: 4 }}>
            Your direct-mail letter for this lead, merged and ready to print (addressed to the owner&rsquo;s
            mailing address on the lead). You print and mail it — the platform sends nothing. Your details
            below are kept on this device only.
          </span>
          <input placeholder="Your name" value={idn.you} onChange={(e) => setIdn({ ...idn, you: e.target.value })} style={inp} />
          <input placeholder="Your business" value={idn.biz} onChange={(e) => setIdn({ ...idn, biz: e.target.value })} style={inp} />
          <input placeholder="Your phone" value={idn.phone} onChange={(e) => setIdn({ ...idn, phone: e.target.value })} style={inp} />
          <input placeholder="Your email" value={idn.email} onChange={(e) => setIdn({ ...idn, email: e.target.value })} style={inp} />
          <span style={{ display: 'block', marginTop: 8, background: '#111c30', border: '1px solid #263650', borderRadius: 6, padding: 10, whiteSpace: 'pre-wrap', color: '#e2e8f0', fontSize: 13, lineHeight: 1.5 }}>
            {mergedBody()}
          </span>
          <button onClick={printLetter} style={{ marginTop: 6 }}>Open print view</button>
        </span>
      )}
    </span>
  );
}
