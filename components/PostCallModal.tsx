'use client';

import { useEffect, useState } from 'react';
import { openCopilot } from '../lib/ai-copilot';

// Slice 139 — Post-Call Seller Summary modal (Amazon Connect softphone,
// BYOK). It opens ONLY when the softphone (components/ConnectDialer.tsx)
// dispatches the 'ws:post-call' event with { phone, durationSec } after
// a call ends. The modal itself never dials, never records, and never
// sends anything on its own.
//
// Privacy: the phone number appears ONLY in the modal's meta line. The
// context string sent to the Copilot is built from the three note fields
// below and NEVER includes the phone number — free-tier AI prompts may
// be used for training, so the AI gets the notes, not the digits. There
// is no address field here, and no address is added to the context.

const AUTO_QUESTION =
  'Based on these call notes, calculate my Maximum Allowable Offer (MAO), suggest a negotiation angle, and write a short follow-up SMS I can send them right now.';

export default function PostCallModal() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [durationSec, setDurationSec] = useState(0);
  const [askingPriceDebt, setAskingPriceDebt] = useState('');
  const [arvRepairs, setArvRepairs] = useState('');
  const [motivationNotes, setMotivationNotes] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ phone?: unknown; durationSec?: unknown }>).detail;
      if (!detail || typeof detail.phone !== 'string' || !detail.phone.trim()) return;
      setPhone(detail.phone);
      setDurationSec(
        typeof detail.durationSec === 'number' && detail.durationSec >= 0 ? detail.durationSec : 0,
      );
      setAskingPriceDebt('');
      setArvRepairs('');
      setMotivationNotes('');
      setOpen(true);
    };
    window.addEventListener('ws:post-call', handler);
    return () => window.removeEventListener('ws:post-call', handler);
  }, []);

  function close() {
    setOpen(false);
  }

  function analyze() {
    // Context from the three note fields ONLY — never the phone number,
    // never an address. Empty fields are skipped; nothing is invented.
    const lines = ['Post-call seller notes:'];
    if (askingPriceDebt.trim()) lines.push(`Asking price / debt: ${askingPriceDebt.trim()}`);
    if (arvRepairs.trim()) lines.push(`ARV & repairs: ${arvRepairs.trim()}`);
    if (motivationNotes.trim()) lines.push(`Motivation / timeline / notes: ${motivationNotes.trim()}`);
    setOpen(false);
    openCopilot(lines.join('\n'), AUTO_QUESTION);
  }

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={close}
    >
      <div
        style={{ background: '#fff', color: '#0f172a', borderRadius: 12, padding: 20, maxWidth: 480, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Post-Call Seller Summary"
      >
        <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Post-Call Seller Summary</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 4px' }}>
          Call ended with {phone} ({durationSec}s).
        </p>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
          The phone number above is not sent to the AI — only the notes below are.
        </p>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          Asking price / debt
          <input
            type="text"
            value={askingPriceDebt}
            onChange={(e) => setAskingPriceDebt(e.target.value)}
            placeholder="[asking price / mortgage balance]"
            style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          ARV &amp; repairs
          <input
            type="text"
            value={arvRepairs}
            onChange={(e) => setArvRepairs(e.target.value)}
            placeholder="[ARV and repair estimate]"
            style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 16 }}>
          Motivation / timeline / notes
          <textarea
            value={motivationNotes}
            onChange={(e) => setMotivationNotes(e.target.value)}
            placeholder="[motivation, timeline, other notes]"
            rows={3}
            style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={close}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={analyze}
            style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}
          >
            Analyze Offer &amp; Draft Follow-Up
          </button>
        </div>
      </div>
    </div>
  );
}
