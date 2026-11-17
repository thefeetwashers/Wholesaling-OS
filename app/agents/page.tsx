'use client';

// Slice 135 — Public agent pocket-listing form (/agents).
//
// A licensed agent submits an off-market pocket listing. The form
// calls the SECURITY DEFINER RPC submit_realtor_pocket_listing()
// (migration 20261117150000) — the agent never writes the table
// directly, and nothing submitted here is public: there is no
// public read on realtor_pocket_listings at all. If the operator
// approves a submission, it is published to the buyer network
// with city/ZIP only — the street address is never published.
// Commission % and relist terms stay in the operator-only row
// and are never published either.
//
// REAL ONLY: no money field is pre-filled (net asking price,
// estimated ARV, and commission % all start empty), no placeholder
// phone number or example person is shown, and the success state
// promises only a review — not approval, not a sale, not a price.

import { useState } from 'react';
import Link from 'next/link';
import { supabase, supabaseConfigured } from '../../lib/supabase';

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

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 10 };

export default function AgentsPage() {
  const [agentName, setAgentName] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [zip, setZip] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [arv, setArv] = useState('');
  const [commission, setCommission] = useState('');
  const [notes, setNotes] = useState('');
  const [wantsRelist, setWantsRelist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!agentName.trim() || !email.trim() || !phone.trim() || !address.trim() || !city.trim() || !zip.trim()) {
      setError('Fill in every required field before submitting.');
      return;
    }
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(stateCode.trim())) {
      setError('State must be exactly 2 letters.');
      return;
    }
    const price = Number(askingPrice);
    if (askingPrice.trim() === '' || !Number.isFinite(price) || price <= 0) {
      setError('Net asking price must be greater than 0.');
      return;
    }
    if (commission.trim() !== '') {
      const c = Number(commission);
      if (!Number.isFinite(c) || c < 0 || c > 10) {
        setError('Commission must be between 0 and 10 percent.');
        return;
      }
    }
    if (arv.trim() !== '') {
      const a = Number(arv);
      if (!Number.isFinite(a) || a <= 0) {
        setError('Estimated ARV must be greater than 0 when given.');
        return;
      }
    }
    if (!supabaseConfigured || !supabase) {
      setError('Submissions are not configured on this deployment yet — try again later.');
      return;
    }
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('submit_realtor_pocket_listing', {
        p_agent_name: agentName.trim(),
        p_agent_email: email.trim(),
        p_agent_phone: phone.trim(),
        p_property_address: address.trim(),
        p_city: city.trim(),
        p_state_code: stateCode.trim().toUpperCase(),
        p_zip: zip.trim(),
        p_asking_price: price,
        p_brokerage: brokerage.trim() || null,
        p_estimated_arv: arv.trim() === '' ? null : Number(arv),
        p_commission_percent: commission.trim() === '' ? null : Number(commission),
        p_wants_relist: wantsRelist,
        p_property_notes: notes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message || 'The listing could not be submitted.');
      setSubmitted(true);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'The listing could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0', minHeight: '100vh' }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/" style={{ color: '#93c5fd' }}>← WholesalingOS home</Link> ·{' '}
        <Link href="/deals" style={{ color: '#93c5fd' }}>Off-market deals</Link>
      </p>
      <h1 style={{ fontSize: 26, margin: '8px 0 4px' }}>Agents: Submit a Pocket Listing</h1>
      <p style={{ fontSize: 14, color: '#cbd5e1', marginTop: 0 }}>
        A licensed agent&apos;s off-market listing, reviewed by our team. If it is approved, it is published to the
        buyer network with the city and ZIP only — the street address is never published, and your commission and
        relist terms are never published either. Submitting a listing does not promise approval, a buyer, or a sale.
      </p>

      {submitted ? (
        <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Listing received — thank you.</div>
          <p style={{ fontSize: 14, color: '#475569' }}>
            Your pocket listing was submitted for review. If it is approved, it will be published to the buyer network
            with the city and ZIP only — no street address. We will contact you at the email you provided.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setAgentName(''); setBrokerage(''); setEmail(''); setPhone(''); setAddress('');
              setCity(''); setStateCode(''); setZip(''); setAskingPrice(''); setArv('');
              setCommission(''); setNotes(''); setWantsRelist(false);
            }}
            style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
          >
            Submit another listing
          </button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
          {error && <p style={{ color: '#b91c1c', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
          <label style={labelStyle}>
            Agent full name *
            <input required value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Agent full name" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Brokerage (optional)
            <input value={brokerage} onChange={(e) => setBrokerage(e.target.value)} placeholder="Brokerage name" style={inputStyle} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              Agent email *
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Agent email address" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Agent phone *
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Agent phone number" style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Property street address *
            <input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Property street address" style={inputStyle} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              City *
              <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              State (2 letters) *
              <input
                required
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase().replace(/[^A-Za-z]/g, '').slice(0, 2))}
                placeholder="FL"
                maxLength={2}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              ZIP *
              <input required value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP code" style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              Net asking price ($) *
              <input required type="number" min={0} step="any" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} placeholder="Net asking price" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Estimated ARV ($) (optional)
              <input type="number" min={0} step="any" value={arv} onChange={(e) => setArv(e.target.value)} placeholder="Estimated ARV" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Commission % (optional)
              <input type="number" min={0} max={10} step="any" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Commission percent" style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Property notes (optional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Condition, beds/baths, or anything a buyer should know" style={inputStyle} />
          </label>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 12, alignItems: 'center' }}>
            <input type="checkbox" checked={wantsRelist} onChange={(e) => setWantsRelist(e.target.checked)} />
            I want the option to relist this property if it does not sell
          </label>
          <button
            type="submit"
            disabled={busy}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Submitting…' : 'Submit pocket listing'}
          </button>
          <p style={{ fontSize: 12, color: '#475569', margin: '10px 0 0' }}>
            By submitting, you confirm you are a licensed agent (or working with one) and that the figures above are
            yours. The street address, your commission, and your relist preference are never shown to buyers.
          </p>
        </form>
      )}
    </main>
  );
}
