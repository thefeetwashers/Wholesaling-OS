'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadVendors, saveVendor, deleteVendor, categoryLabel, VENDOR_CATEGORIES, type VendorRow } from '../lib/vendors';

// Slice 39 — My Lenders & Vendors. The wholesaler's own address book
// of funding contacts and trades, stored privately under RLS
// (schema v4.3). The platform ships with NO entries and verifies
// NONE: no rates, no approvals, no endorsements are implied. Contact
// is click-to-call / click-to-email through the wholesaler's own
// apps — the platform never submits anything to a lender.

const EMPTY: VendorRow = { category: 'hard_money_lender', name: '', phone: '', email: '', website: '', service_area: '', notes: '' };

export default function VendorDirectory({ userId }: { userId: string | null }) {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [form, setForm] = useState<VendorRow>(EMPTY);
  const [mode, setMode] = useState<'local' | 'synced'>('local');
  const [msg, setMsg] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadVendors(userId).then((rows) => { if (rows) { setVendors(rows); setMode('synced'); } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const add = async () => {
    if (!form.name.trim()) { setMsg('A name is required.'); return; }
    let saved: VendorRow = { ...form, id: `local-${Date.now()}` };
    if (userId && supabaseConfigured) {
      const row = await saveVendor(userId, form).catch(() => null);
      if (!row) { setMsg('Save failed — the contact was not added. Try again.'); return; }
      saved = row;
    }
    setVendors([...vendors, saved].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
    setForm(EMPTY);
    setMsg(`Added: ${saved.name}`);
  };

  const remove = async (v: VendorRow) => {
    if (v.id && userId && supabaseConfigured && !v.id.startsWith('local-')) {
      try { await deleteVendor(userId, v.id); } catch { setMsg('Delete failed — the contact is still in your directory.'); return; }
    }
    setVendors(vendors.filter((x) => x.id !== v.id));
    setConfirming(null);
    setMsg(`Deleted: ${v.name}`);
  };

  const fld = (key: keyof VendorRow, placeholder: string, width = 220) => (
    <input placeholder={placeholder} style={{ width }} value={(form[key] as string) || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
  );

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Lenders &amp; Vendors — Your Directory</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>
        Your own funding contacts and trades — private to your account, never shared, never shown to the
        platform owner as raw rows. The platform ships with no entries and verifies none of them: no rates,
        approvals, or endorsements are implied by a listing here. This is an address book, not a loan
        application — nothing is packaged or submitted to anyone.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {VENDOR_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {fld('name', 'Name / company *')}
        {fld('phone', 'Phone', 150)}
        {fld('email', 'Email')}
        {fld('website', 'Website')}
        {fld('service_area', 'Service area — e.g. Broward, Palm Beach', 260)}
        {fld('notes', 'Notes — terms they quoted YOU, specialties', 300)}
        <button onClick={add}>Add contact</button>
      </div>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      <p style={{ fontSize: 12.5, color: '#94a3b8' }}>Mode: {mode === 'synced' ? 'Synced to Supabase (your rows only, RLS)' : 'Local only — sign in with Supabase configured to sync.'}</p>
      {vendors.length === 0 ? (
        <p style={{ fontSize: 13.5 }}>No lenders or vendors yet. Add the hard-money lender, contractor, or inspector you already work with — your first closing team starts here.</p>
      ) : (
        <ul style={{ fontSize: 13.5 }}>
          {vendors.map((v) => (
            <li key={v.id || v.name} style={{ marginBottom: 8 }}>
              <strong>{v.name}</strong> — {categoryLabel(v.category)}
              {v.service_area ? ` · ${v.service_area}` : ''}
              {v.phone ? <> · <a href={`tel:${v.phone}`}>{v.phone}</a></> : ''}
              {v.email ? <> · <a href={`mailto:${v.email}`}>{v.email}</a></> : ''}
              {v.website ? <> · <a href={v.website} target="_blank" rel="noreferrer">{v.website}</a></> : ''}
              {v.notes ? <><br /><span style={{ color: '#94a3b8' }}>{v.notes}</span></> : ''}
              {' '}
              {confirming === v.id ? (
                <>Delete this contact? <button onClick={() => void remove(v)}>Confirm delete</button> <button onClick={() => setConfirming(null)}>Cancel</button></>
              ) : (
                <button onClick={() => setConfirming(v.id || v.name)}>Delete</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
