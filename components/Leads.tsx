'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadLeads, saveLead, leadsToCsv, type Lead, type LeadStatus, LEAD_STATUSES } from '../lib/leads';

const EMPTY: Lead = { property_address: '', status: 'new' };

export default function Leads({ userId, onLeads }: { userId: string | null; onLeads: (leads: Lead[]) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState<Lead>(EMPTY);
  const [filter, setFilter] = useState<string>('all');
  const [mode, setMode] = useState<'local' | 'synced'>('local');

  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadLeads(userId).then((rows) => {
        if (rows) { setLeads(rows); setMode('synced'); onLeads(rows); }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addLead = async () => {
    if (!form.property_address.trim()) return;
    let saved: Lead = { ...form, id: `local-${Date.now()}` };
    if (userId && supabaseConfigured) {
      const row = await saveLead(userId, form).catch(() => null);
      if (row) saved = row;
    }
    const next = [saved, ...leads];
    setLeads(next); onLeads(next); setForm(EMPTY);
  };

  const shown = filter === 'all' ? leads : leads.filter((l) => l.status === filter);

  const downloadCsv = () => {
    const blob = new Blob([leadsToCsv(leads)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'wholesalingos-leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Leads — Lead CRM</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Mode: {mode === 'synced' ? 'Synced to Supabase (your rows only, RLS)' : 'Local only — Supabase not configured or not signed in, so these leads live in this browser session only and will NOT sync yet.'}
        {' '}No leads are seeded. CSV export includes only leads you entered.
      </p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <input placeholder="Property address *" value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
        <input placeholder="City" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input placeholder="State" value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        <input placeholder="ZIP" value={form.zip || ''} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
        <input placeholder="Owner name" value={form.owner_name || ''} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
        <input placeholder="List source (e.g. driving for dollars)" value={form.list_source || ''} onChange={(e) => setForm({ ...form, list_source: e.target.value })} />
        <input type="date" value={form.follow_up_date || ''} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <textarea placeholder="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button onClick={addLead}>Add lead</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Filter: <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select></label>{' '}
        <button onClick={downloadCsv} disabled={leads.length === 0}>Export CSV ({leads.length})</button>
      </div>

      {shown.length === 0 && <p>No leads yet. Add your first lead above.</p>}
      <ul>
        {shown.map((l) => (
          <li key={l.id || l.property_address}>
            <strong>{l.property_address}</strong> {l.city ? `— ${l.city}, ${l.state || ''} ${l.zip || ''}` : ''}
            {' '}· {l.status}
            {l.follow_up_date ? ` · follow-up ${l.follow_up_date}` : ''}
            {l.owner_name ? ` · owner: ${l.owner_name}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
