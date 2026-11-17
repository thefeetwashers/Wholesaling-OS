'use client';

// Slice 132 — Managed disposition page (/managed-dispo, public).
//
// What it is, in our own words: you submit a deal you have under
// contract, and the operator markets it to the buyer network for
// you — instead of you finding the buyer yourself. Honest rules,
// stated plainly:
//   * Submitting is a REQUEST, not a booking. The operator reviews
//     it and decides whether to take it on.
//   * The fee is AGREED IN WRITING before work starts — no
//     percentage and no flat fee is promised or shown here, and
//     none is stored with the request.
//   * The work is governed by a separate signed agreement.
//   * No guaranteed sale. No deals-closed stats, no fake team.
// The submit form writes public.managed_dispo_requests (signed-in
// wholesalers only). No email is sent (no email service exists) —
// the operator sees the request in their operator view, in-app
// only. Same pattern as the seller-advance request.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import {
  submitManagedDispoRequest,
  fetchMyManagedDispoRequests,
  MANAGED_DISPO_STATUS_LABELS,
  type ManagedDispoRequest,
} from '../../lib/managed-dispo';

const money = (n: number | null | undefined): string =>
  n == null ? 'not provided' : `$${Math.round(n).toLocaleString()}`;

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

export default function ManagedDispoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [askingPrice, setAskingPrice] = useState('');
  const [arv, setArv] = useState('');
  const [repairEstimate, setRepairEstimate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [mine, setMine] = useState<ManagedDispoRequest[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id || null;
      setUserId(uid);
      if (uid) {
        fetchMyManagedDispoRequests(uid).then(setMine).catch(() => {});
      }
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setErr('');
    setDone('');
    try {
      const numOrNull = (v: string): number | null => {
        if (v.trim() === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const row = await submitManagedDispoRequest(userId, {
        property_address: address,
        city,
        state,
        asking_price: numOrNull(askingPrice),
        arv: numOrNull(arv),
        repair_estimate: numOrNull(repairEstimate),
        notes,
      });
      setMine((prev) => [row, ...prev]);
      setAddress('');
      setCity('');
      setAskingPrice('');
      setArv('');
      setRepairEstimate('');
      setNotes('');
      setDone('Request submitted. The operator reviews it in-app — this is a request, not a booking, and no fee is agreed until it is agreed in writing.');
    } catch (ex) {
      setErr((ex as Error)?.message || 'Your request could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/">← WholesalingOS home</Link> · <Link href="/deals">Off-market deals</Link> ·{' '}
        <Link href="/#signin">Sign in</Link>
      </p>
      <h1 style={{ fontSize: 28, margin: '8px 0 4px' }}>Managed Disposition — We Market Your Deal For You</h1>
      <p style={{ fontSize: 15, color: '#cbd5e1' }}>
        You found the deal and got it under contract. We take it from there: the operator markets your deal to the buyer network —
        the cash buyers and investors already on the platform — and works the responses, so you do not have to blast it out yourself
        or chase buyers one by one. You stay the wholesaler of record; we do the disposition work.
      </p>
      <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, fontSize: 14 }}>
        <strong>How it works — honestly:</strong>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>You submit the deal below — address, city, asking price, ARV, and repair estimate if you have them.</li>
          <li style={{ marginBottom: 6 }}>The operator reviews the request and decides whether to take it on.</li>
          <li style={{ marginBottom: 6 }}>If it is taken on, the operator markets it to the buyer network for you.</li>
          <li style={{ marginBottom: 6 }}>Any fee is agreed in writing before work starts — there is no set percentage or flat fee, and no fee is charged by submitting.</li>
          <li>The work is governed by a separate signed agreement. There is no guaranteed sale, and we show no deals-closed statistics — there are none to show yet.</li>
        </ol>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Submit a deal for managed disposition</h2>
      {!userId ? (
        <p style={{ fontSize: 14 }}>
          <Link href="/#signin">Sign in</Link> to submit a deal for managed disposition.
        </p>
      ) : (
        <form onSubmit={submit} style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ fontSize: 13, gridColumn: '1 / -1' }}>
              Property address
              <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              State
              <input value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Asking price ($)
              <input type="number" min={0} value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              ARV ($)
              <input type="number" min={0} value={arv} onChange={(e) => setArv(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Est. repairs ($)
              <input type="number" min={0} value={repairEstimate} onChange={(e) => setRepairEstimate(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <label style={{ display: 'block', fontSize: 13, marginTop: 10 }}>
            Notes for the operator (deal details, timeline, anything the buyer network should know)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={inputStyle} />
          </label>
          {err && <p style={{ fontSize: 13, color: '#b91c1c' }}>{err}</p>}
          {done && <p style={{ fontSize: 13, color: '#0f766e' }}>{done}</p>}
          <button
            type="submit"
            disabled={busy}
            style={{ marginTop: 10, padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Submitting…' : 'Submit this deal'}
          </button>
          <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 0 }}>
            Submitting is a request, not a booking. No email is sent — the operator sees it in-app.
          </p>
        </form>
      )}

      {userId && mine.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 24 }}>My requests</h2>
          <ul style={{ fontSize: 14 }}>
            {mine.map((r) => (
              <li key={r.id} style={{ marginBottom: 10, background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                <strong>{r.property_address || 'Address not given'}</strong>
                {r.city ? ` — ${r.city}, ${r.state || ''}` : ''} · {MANAGED_DISPO_STATUS_LABELS[r.status || 'requested']}
                {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}
                <br />
                <span style={{ color: '#475569' }}>
                  Asking: {money(r.asking_price)} · ARV: {money(r.arv)} · Est. repairs: {money(r.repair_estimate)}
                </span>
                {r.notes ? <><br />{r.notes}</> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
