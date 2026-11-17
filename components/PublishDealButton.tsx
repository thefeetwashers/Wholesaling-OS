'use client';

// Slice 132 — "Publish as a deal" button for the wholesaler's OWN
// lead rows (wired into components/Leads.tsx).
//
// Explicit opt-in only: nothing is published until the wholesaler
// opens this form, checks the fields, and taps "Publish this
// deal". The form is prefilled ONLY from the lead's REAL fields —
// city, state, ZIP, county, property type, year built, condition
// (only when it is already one of the five pinned values),
// occupancy, asking price, repair estimate (the lead's own
// offer_repairs), close-by date (the seller's preferred closing
// date) — and every other field starts EMPTY, including all money
// fields the lead does not carry. The lead's internal notes are
// NEVER prefilled (they are not public copy). Comps start empty
// (max 4, wholesaler-entered only). Publishing inserts one row
// into public.published_deals; the public page shows ZIP-only
// location, never the street address, and never the seller's
// contact.
//
// Publishing stays behind Supabase Auth + RLS: the signed-in
// wholesaler publishes their OWN deal from their dashboard.
// There is no anon insert, no client-side passcode, and no
// separate admin drawer — a passcode in client-side code protects
// nothing, and an anon INSERT policy would make the table
// world-writable.

import { useState } from 'react';
import { publishDeal, DEAL_CONDITIONS, type PublishedDeal } from '../lib/published-deals';
import type { Lead } from '../lib/leads';

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

function prefillFromLead(lead: Lead) {
  const numOrEmpty = (v: number | null | undefined): string =>
    typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  const condition =
    typeof lead.condition === 'string' && (DEAL_CONDITIONS as readonly string[]).includes(lead.condition)
      ? lead.condition
      : '';
  return {
    city: lead.city || '',
    state: lead.state || '',
    zip: lead.zip || '',
    county: lead.county || '',
    property_type: lead.property_type || '',
    beds: '',
    baths: '',
    sqft: '',
    year_built: lead.year_built ? String(lead.year_built) : '',
    lot_size: '',
    condition,
    occupancy: lead.occupancy || '',
    strategy: '',
    asking_price: numOrEmpty(lead.asking_price),
    arv_low: '',
    arv_high: '',
    repair_estimate: numOrEmpty(lead.offer_repairs),
    close_by: lead.preferred_closing_date || '',
    highlights: '',
    notes: '',
  };
}

export default function PublishDealButton({
  lead,
  userId,
  onPublished,
}: {
  lead: Lead;
  userId: string;
  onPublished?: (deal: PublishedDeal) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => prefillFromLead(lead));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const numOrNull = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const publish = async () => {
    setBusy(true);
    setErr('');
    setDone('');
    try {
      const deal = await publishDeal(userId, {
        city: form.city,
        state: form.state,
        zip: form.zip,
        county: form.county,
        property_type: form.property_type,
        beds: numOrNull(form.beds),
        baths: numOrNull(form.baths),
        sqft: numOrNull(form.sqft),
        year_built: numOrNull(form.year_built),
        lot_size: form.lot_size,
        condition: form.condition || null,
        occupancy: form.occupancy,
        strategy: form.strategy,
        asking_price: numOrNull(form.asking_price),
        arv_low: numOrNull(form.arv_low),
        arv_high: numOrNull(form.arv_high),
        repair_estimate: numOrNull(form.repair_estimate),
        close_by: form.close_by || null,
        highlights: form.highlights,
        notes: form.notes,
        comps: [],
      });
      setDone('Published — this deal is now on the public Off-Market Deals page (/deals). The street address and seller contact are not shown.');
      setOpen(false);
      if (onPublished) onPublished(deal);
    } catch (e) {
      setErr((e as Error)?.message || 'The deal could not be published.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span>
      <button
        onClick={() => {
          setForm(prefillFromLead(lead));
          setErr('');
          setDone('');
          setOpen((v) => !v);
        }}
      >
        Publish as a deal
      </button>
      {done && <span style={{ fontSize: 13, color: '#4ade80', marginLeft: 6 }}>{done}</span>}
      {open && (
        <span
          style={{
            display: 'block',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 10,
            padding: 12,
            marginTop: 8,
            maxWidth: 560,
          }}
        >
          <strong style={{ fontSize: 14 }}>Publish this deal — public Off-Market Deals page</strong>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0' }}>
            Only what you enter here is shown. The street address and the seller&apos;s name and contact are never published — buyers
            see the city, state, ZIP, and county only. Money fields are empty unless you type a real value. Nothing is published
            until you tap &ldquo;Publish this deal&rdquo;.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 13 }}>
              City
              <input value={form.city} onChange={set('city')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              State
              <input value={form.state} onChange={set('state')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              ZIP
              <input value={form.zip} onChange={set('zip')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              County
              <input value={form.county} onChange={set('county')} placeholder="e.g. Broward" style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Property type
              <input value={form.property_type} onChange={set('property_type')} placeholder="e.g. Single Family" style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Strategy
              <input value={form.strategy} onChange={set('strategy')} placeholder="e.g. Fix & Flip" style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Beds
              <input type="number" min={0} value={form.beds} onChange={set('beds')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Baths
              <input type="number" min={0} step="0.5" value={form.baths} onChange={set('baths')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Sq ft
              <input type="number" min={0} value={form.sqft} onChange={set('sqft')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Year built
              <input type="number" value={form.year_built} onChange={set('year_built')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Lot size
              <input value={form.lot_size} onChange={set('lot_size')} placeholder="e.g. 0.17 acres" style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Condition
              <select value={form.condition} onChange={set('condition')} style={inputStyle}>
                <option value="">Not stated</option>
                {DEAL_CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>
              Occupancy
              <input value={form.occupancy} onChange={set('occupancy')} placeholder="e.g. Vacant" style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Asking price ($)
              <input type="number" min={0} value={form.asking_price} onChange={set('asking_price')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Est. ARV low ($)
              <input type="number" min={0} value={form.arv_low} onChange={set('arv_low')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Est. ARV high ($)
              <input type="number" min={0} value={form.arv_high} onChange={set('arv_high')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Est. repairs ($)
              <input type="number" min={0} value={form.repair_estimate} onChange={set('repair_estimate')} style={inputStyle} />
            </label>
            <label style={{ fontSize: 13 }}>
              Close by
              <input type="date" value={form.close_by} onChange={set('close_by')} style={inputStyle} />
            </label>
          </div>
          <label style={{ display: 'block', fontSize: 13, marginTop: 8 }}>
            Investment highlights (public — no address, no seller name or contact)
            <textarea value={form.highlights} onChange={set('highlights')} rows={2} style={inputStyle} />
          </label>
          <label style={{ display: 'block', fontSize: 13, marginTop: 8 }}>
            Notes (public)
            <textarea value={form.notes} onChange={set('notes')} rows={2} style={inputStyle} />
          </label>
          <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
            Sold comparables are added on the deal page after publishing — up to 4, entered by you only, every field optional.
          </p>
          {err && <p style={{ fontSize: 13, color: '#f87171' }}>{err}</p>}
          <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={publish} disabled={busy}>{busy ? 'Publishing…' : 'Publish this deal'}</button>
            <button onClick={() => setOpen(false)}>Cancel</button>
          </span>
        </span>
      )}
    </span>
  );
}
