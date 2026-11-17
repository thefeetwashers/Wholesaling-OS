import React, { useEffect, useState } from 'react';
import {
  loadVerifiedVendors,
  sendBidRequest,
  TRADE_CATEGORIES,
  type VendorDirectoryRow,
  type TradeCategory,
} from '../lib/vendor-marketplace';
import { US_STATES } from '../lib/funding';

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '24px 12px',
  zIndex: 60,
  overflowY: 'auto',
};
const modalBox: React.CSSProperties = {
  background: '#fff',
  color: '#0f172a',
  borderRadius: 14,
  padding: 20,
  width: '100%',
  maxWidth: 560,
  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
};
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

// Slice 122 — Request an Inspector / Contractor Bid. An opt-in
// request: the property and the scope go to ONE chosen vendor from
// the directory — and only verified, licensed vendors are listed.
// The vendor sees the request in their own office; nobody else
// sees it. No estimate is promised by this request, and no money
// moves: the vendor answers with their own quote, and the
// wholesaler chooses whether to use them.
export default function VendorBidModal({
  userId,
  dealId,
  initialPropertyAddress,
  initialPropertyState,
  initialRepairs,
  onClose,
}: {
  userId: string;
  dealId?: string | null;
  initialPropertyAddress?: string;
  initialPropertyState?: string;
  initialRepairs?: number | null;
  onClose: () => void;
}) {
  const [vendors, setVendors] = useState<VendorDirectoryRow[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [trade, setTrade] = useState<TradeCategory>('home_inspector');
  const [vendorId, setVendorId] = useState('');
  const [address, setAddress] = useState(initialPropertyAddress || '');
  const [state, setState] = useState(initialPropertyState || 'FL');
  const [scope, setScope] = useState(
    initialRepairs != null
      ? `Estimated repairs from the 70% rule calculator: $${Number(initialRepairs).toLocaleString()}. Please provide a real estimate for the scope below.`
      : ''
  );
  const [walkthrough, setWalkthrough] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    loadVerifiedVendors()
      .then((rows) => {
        setVendors(rows);
        const match = rows.filter((v) => v.trade_category === 'home_inspector');
        if (match.length) setVendorId(match[0].id || '');
      })
      .catch((e: any) => setLoadErr(e?.message || 'Could not load the vendor directory.'));
  }, []);

  const filtered = vendors.filter((v) => v.trade_category === trade);
  useEffect(() => {
    if (filtered.length && !filtered.some((v) => v.id === vendorId)) setVendorId(filtered[0].id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade]);

  const chosen = vendors.find((v) => v.id === vendorId);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !chosen) {
      setErr('Choose a verified vendor first.');
      return;
    }
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      await sendBidRequest(userId, {
        deal_id: dealId || null,
        vendor_id: vendorId,
        property_address: address,
        property_state: state,
        trade_needed: trade,
        scope_notes: scope,
        target_walkthrough_date: walkthrough || null,
      });
      setMsg(
        `Request sent to ${chosen.business_name || 'the vendor'}. They will see it in their office and can accept it there. No estimate is promised — the vendor answers with their own quote.`
      );
    } catch (ex: any) {
      setErr(ex?.message || 'The request could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Request an Inspector / Contractor Bid</h3>
          <button
            onClick={onClose}
            style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#475569', margin: '6px 0 12px' }}>
          Your repair number is a guess until a licensed professional walks the property. Send the property and the scope to ONE verified
          vendor — they answer with their own estimate. The request goes only to the vendor you choose.
        </p>
        {loadErr ? (
          <p style={{ color: '#b91c1c', fontSize: 13 }}>{loadErr}</p>
        ) : vendors.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>
            No verified vendors are listed yet. The directory is launching — check back, or ask the operator for an introduction.
          </p>
        ) : (
          <form onSubmit={send}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Trade needed *
              <select value={trade} onChange={(e) => setTrade(e.target.value as TradeCategory)} style={inputStyle}>
                {TRADE_CATEGORIES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Verified vendor *
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} style={inputStyle}>
                {filtered.length === 0 && <option value="">No verified {TRADE_CATEGORIES.find((t) => t.value === trade)?.label || 'vendors'} listed</option>}
                {filtered.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.business_name || 'Unnamed vendor'}
                    {v.license_number ? ` — Lic. ${v.license_number}` : ''}
                    {(v.counties_covered || []).length ? ` (${v.counties_covered.join(', ')})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {chosen && (
              <p style={{ fontSize: 12, color: '#0f766e', margin: '0 0 8px' }}>
                ✓ Verified by the operator. License {chosen.license_number}
                {(chosen.states_covered || []).length ? ` · States: ${chosen.states_covered.join(', ')}` : ''}
                {(chosen.counties_covered || []).length ? ` · Counties: ${chosen.counties_covered.join(', ')}` : ''}
              </p>
            )}
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Property address *
              <input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Fort Pierce, FL" style={inputStyle} />
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              State
              <select value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Scope of work *
              <textarea required value={scope} onChange={(e) => setScope(e.target.value)} rows={4} style={inputStyle} placeholder="What should the vendor estimate? Roof age, AC, flooring, kitchen, exterior…" />
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Target walkthrough date
              <input type="date" value={walkthrough} onChange={(e) => setWalkthrough(e.target.value)} style={inputStyle} />
            </label>
            {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
            {msg && <p style={{ color: '#0f766e', fontSize: 13 }}>{msg}</p>}
            <button
              type="submit"
              disabled={busy || !vendorId}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
            >
              {busy ? 'Sending…' : 'Send bid request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
