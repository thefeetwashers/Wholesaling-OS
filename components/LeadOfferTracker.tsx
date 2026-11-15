'use client';

import { useState } from 'react';
import { updateLeadFields, SELLER_STATUSES, type Lead, type SellerStatus } from '../lib/leads';
import { buildOfferReceipt } from '../lib/tracker';

// Slice 125 — the wholesaler's Offer & Tracker panel on a
// seller-page lead. The wholesaler moves the seller-facing
// status (Received → Reviewed → Offer made → Closing → Closed)
// and enters the offer numbers the seller's Offer Receipt shows:
// the offer amount, the comparable-sales range, the repair
// estimate, and the resale costs. Every number is the
// wholesaler's own — the platform computes nothing, and a blank
// field reads "not provided" on the seller's receipt. The panel
// also shows the seller's private tracking link (copy it and
// send it to the seller) and the closing day the seller picked,
// plus the inherited-home facts when the seller used the fast
// lane. It renders only for seller-page leads.

const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

function numInput(v: string): number | null {
  const t = v.trim().replace(/[$,]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function LeadOfferTracker({
  userId,
  lead,
  onLeadChanged,
}: {
  userId: string;
  lead: Lead;
  onLeadChanged: (lead: Lead) => void;
}) {
  const [status, setStatus] = useState<SellerStatus>(lead.seller_status || 'received');
  const [amount, setAmount] = useState(lead.offer_amount != null ? String(lead.offer_amount) : '');
  const [compLow, setCompLow] = useState(lead.offer_comp_low != null ? String(lead.offer_comp_low) : '');
  const [compHigh, setCompHigh] = useState(lead.offer_comp_high != null ? String(lead.offer_comp_high) : '');
  const [repairs, setRepairs] = useState(lead.offer_repairs != null ? String(lead.offer_repairs) : '');
  const [resale, setResale] = useState(lead.offer_resale_costs != null ? String(lead.offer_resale_costs) : '');
  const [note, setNote] = useState(lead.offer_note || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const receipt = buildOfferReceipt(lead);
  const trackUrl =
    typeof window !== 'undefined' && lead.tracker_token
      ? `${window.location.origin}/track/${lead.tracker_token}`
      : '';

  const save = async () => {
    const low = numInput(compLow);
    const high = numInput(compHigh);
    if (low != null && high != null && high < low) {
      setMsg('The top of the comparable range is below the bottom — check the two numbers.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const patch: Partial<Lead> = {
        seller_status: status,
        offer_amount: numInput(amount),
        offer_comp_low: low,
        offer_comp_high: high,
        offer_repairs: numInput(repairs),
        offer_resale_costs: numInput(resale),
        offer_note: note.trim() || null,
      };
      await updateLeadFields(userId, lead.id || '', patch);
      onLeadChanged({ ...lead, ...patch });
      setMsg('Saved — the seller sees this on their tracking link.');
    } catch {
      setMsg('Save failed — check the connection and try again.');
    }
    setBusy(false);
  };

  const copyLink = async () => {
    if (!trackUrl) return;
    try {
      await navigator.clipboard.writeText(trackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setMsg('Copy did not work — select the link and copy it by hand.');
    }
  };

  return (
    <div style={{ background: '#0f172a', padding: 12, borderRadius: 8, marginTop: 8, border: '1px solid #334155' }}>
      <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>📍 Seller tracker &amp; offer</p>
      <label style={{ fontSize: 13 }}>
        Seller status:{' '}
        <select value={status} onChange={(e) => setStatus(e.target.value as SellerStatus)}>
          {SELLER_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </label>
      {lead.preferred_closing_date && (
        <p style={{ fontSize: 13, margin: '6px 0 0' }}>
          📅 Seller’s ideal closing day: <strong>{lead.preferred_closing_date}</strong>
        </p>
      )}
      {lead.inherited_home && (
        <p style={{ fontSize: 13, margin: '6px 0 0' }}>
          🏠 Inherited home — role: {lead.estate_role || 'not stated'} · Letters: {lead.letters_issued || 'not stated'} · Court approval: {lead.court_approval || 'not stated'}
          {lead.estate_notes ? ` · ${lead.estate_notes}` : ''}
        </p>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <input placeholder="Offer amount $" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 140 }} />
        <input placeholder="Comps low $" value={compLow} onChange={(e) => setCompLow(e.target.value)} style={{ width: 130 }} />
        <input placeholder="Comps high $" value={compHigh} onChange={(e) => setCompHigh(e.target.value)} style={{ width: 130 }} />
        <input placeholder="Repairs $" value={repairs} onChange={(e) => setRepairs(e.target.value)} style={{ width: 130 }} />
        <input placeholder="Resale costs $" value={resale} onChange={(e) => setResale(e.target.value)} style={{ width: 130 }} />
      </div>
      <input placeholder="Note for the seller (shown on their receipt, optional)" value={note}
        onChange={(e) => setNote(e.target.value)} style={{ width: '100%', maxWidth: 520, marginTop: 6 }} />
      <div style={{ marginTop: 8 }}>
        <button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save status & offer'}</button>
      </div>
      {receipt && (
        <p style={{ fontSize: 13, margin: '8px 0 0' }}>
          Seller sees: offer {money(receipt.amount)}
          {receipt.lines[0].value ? ` · comps ${receipt.lines[0].value}` : ' · comps not provided'}
          {receipt.lines[1].value ? ` · repairs ${receipt.lines[1].value}` : ' · repairs not provided'}
          {receipt.lines[2].value ? ` · resale ${receipt.lines[2].value}` : ' · resale not provided'}
        </p>
      )}
      {trackUrl ? (
        <p style={{ fontSize: 13, margin: '8px 0 0' }}>
          Seller’s private tracking link:{' '}
          <a href={trackUrl} target="_blank" rel="noreferrer">{trackUrl}</a>{' '}
          <button onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy link'}</button>
        </p>
      ) : (
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '8px 0 0' }}>
          No tracking link yet — it appears once the Slice 125 migration has been applied.
        </p>
      )}
      {msg && <p style={{ fontSize: 13, margin: '6px 0 0' }}>{msg}</p>}
    </div>
  );
}
