import React, { useState } from 'react';
import { registerVendor, TRADE_CATEGORIES, FLORIDA_COUNTIES, type TradeCategory } from '../lib/vendor-marketplace';
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

// Slice 122 — Join the Vendor Directory. Listing is FREE while the
// directory launches — no subscription price is charged, and no
// subscription is collected by the platform. Verification is done
// by the operator (The Feet Washers, Inc.) after the license is
// checked; until then the listing is not shown to wholesalers.
// Only the state license number is required as proof — no
// documents are uploaded in this slice.
export default function VendorRegistrationModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [businessName, setBusinessName] = useState('');
  const [trade, setTrade] = useState<TradeCategory>('general_contractor');
  const [license, setLicense] = useState('');
  const [states, setStates] = useState<string[]>(['FL']);
  const [counties, setCounties] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const toggleState = (s: string) =>
    setStates((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const toggleCounty = (c: string) =>
    setCounties((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!license.trim()) {
      setErr('A state license number is required.');
      return;
    }
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      await registerVendor(userId, {
        business_name: businessName,
        trade_category: trade,
        license_number: license,
        states_covered: states,
        counties_covered: counties,
      });
      setMsg(
        'Thank you — your listing was submitted and is pending operator verification. It is not shown to wholesalers until the operator verifies your license. Listing is free while the directory launches; no subscription is charged.'
      );
      setBusinessName('');
      setLicense('');
      setCounties([]);
    } catch (ex: any) {
      setErr(ex?.message || 'Registration failed. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Join the Vendor Directory</h3>
          <button
            onClick={onClose}
            style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#475569', margin: '6px 0 12px' }}>
          Licensed contractors, inspectors, and appraisers: wholesalers on WholesalingOS need real repair estimates, walkthroughs, and
          appraisals. Listing is <strong>free while the directory launches</strong> — no subscription price is charged. Verification is by
          the operator, who checks your license before your listing is shown.
        </p>
        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
            Business name *
            <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
            Trade *
            <select value={trade} onChange={(e) => setTrade(e.target.value as TradeCategory)} style={inputStyle}>
              {TRADE_CATEGORIES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
            State license number *
            <input required value={license} onChange={(e) => setLicense(e.target.value)} placeholder="e.g. CBC1250000" style={inputStyle} />
            <span style={{ fontSize: 12, color: '#64748b' }}>Required. The operator verifies it before your listing goes live.</span>
          </label>
          <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 8, margin: '0 0 8px', padding: '8px 10px' }}>
            <legend style={{ fontSize: 13, fontWeight: 700 }}>States covered</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', maxHeight: 140, overflowY: 'auto' }}>
              {US_STATES.map((s) => (
                <label key={s.code} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={states.includes(s.code)} onChange={() => toggleState(s.code)} />
                  {s.code} — {s.name}
                </label>
              ))}
            </div>
          </fieldset>
          {states.includes('FL') && (
            <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 8, margin: '0 0 8px', padding: '8px 10px' }}>
              <legend style={{ fontSize: 13, fontWeight: 700 }}>Florida counties covered</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', maxHeight: 140, overflowY: 'auto' }}>
                {FLORIDA_COUNTIES.map((c) => (
                  <label key={c} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={counties.includes(c)} onChange={() => toggleCounty(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
          {msg && <p style={{ color: '#0f766e', fontSize: 13 }}>{msg}</p>}
          <button
            type="submit"
            disabled={busy}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Submitting…' : 'Submit my listing'}
          </button>
          <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
            This is a marketplace listing, not employment and not a guarantee of work. Wholesalers choose vendors themselves; the operator
            verifies licenses and nothing more.
          </p>
        </form>
      </div>
    </div>
  );
}
