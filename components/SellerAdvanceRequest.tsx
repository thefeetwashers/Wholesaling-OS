import React, { useEffect, useState } from 'react';
import {
  requestSellerAdvance,
  loadMyAdvanceRequests,
  ADVANCE_MIN,
  ADVANCE_MAX,
  type SellerAdvanceRequest,
} from '../lib/seller-advance';

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 3,
  padding: 8,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 14,
  boxSizing: 'border-box',
};

// Slice 122 — Fast-Cash Seller Moving Advance: a REQUEST for
// operator review only. No advance is promised or guaranteed by
// this form, no money moves through the platform, and no terms are
// agreed here. The operator (The Feet Washers, Inc.) reviews the
// request in the Escrow desk; if they approve, the terms are agreed
// outside this table and the advance is repaid out of closing
// proceeds. No email is sent — no email service is wired.
export default function SellerAdvanceRequest({
  userId,
  dealId,
  sellerName,
}: {
  userId: string;
  dealId?: string | null;
  sellerName?: string;
}) {
  const [amount, setAmount] = useState('2000');
  const [name, setName] = useState(sellerName || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [mine, setMine] = useState<SellerAdvanceRequest[]>([]);

  const load = () => {
    loadMyAdvanceRequests(userId)
      .then(setMine)
      .catch(() => {});
  };
  useEffect(load, [userId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      await requestSellerAdvance(userId, {
        deal_id: dealId || null,
        amount_requested: Number(amount),
        seller_name: name,
        reason,
      });
      setMsg(
        'Request sent to the operator for review. This is a request only — no advance is promised or guaranteed, and terms are subject to agreement. The operator will review it in the Escrow desk.'
      );
      setReason('');
      load();
    } catch (ex: any) {
      setErr(ex?.message || 'The request could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff', color: '#0f172a', marginTop: 12 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Request Seller Moving Advance (${ADVANCE_MIN.toLocaleString()}–${ADVANCE_MAX.toLocaleString()}, Escrow-Backed)</h3>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
        Some sellers need moving money before closing day. This is a <strong>request for operator review only</strong> — no advance is
        promised or guaranteed, and terms are subject to agreement. If approved, the advance is repaid out of closing proceeds. No money
        moves through this form.
      </p>
      <form onSubmit={submit}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          Amount requested ($) — between ${ADVANCE_MIN.toLocaleString()} and ${ADVANCE_MAX.toLocaleString()} *
          <input
            type="number"
            min={ADVANCE_MIN}
            max={ADVANCE_MAX}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          Seller name
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          Reason *
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} style={inputStyle} placeholder="e.g. Seller needs moving truck and first month’s rent before closing; closing is 14 days out." />
        </label>
        {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
        {msg && <p style={{ color: '#0f766e', fontSize: 13 }}>{msg}</p>}
        <button
          type="submit"
          disabled={busy}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Sending…' : 'Send advance request to operator'}
        </button>
      </form>
      {mine.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>My advance requests</h4>
          {mine.map((r) => (
            <p key={r.id} style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>
              ${Number(r.amount_requested).toLocaleString()} — {r.seller_name || 'seller not named'} — status: <strong>{r.status}</strong> ·{' '}
              {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
