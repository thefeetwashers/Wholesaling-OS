'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadLeads, saveLead, deleteLead, leadsToCsv, type Lead, type LeadStatus, LEAD_STATUSES } from '../lib/leads';
import { DISTRESS_TAGS, loadAllTags, sortCallQueue, type DistressTagRow } from '../lib/distress';
import ResearchLinks from './ResearchLinks';
import LeadTags from './LeadTags';

const EMPTY: Lead = { property_address: '', status: 'new' };

export default function Leads({ userId, onLeads }: { userId: string | null; onLeads: (leads: Lead[]) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState<Lead>(EMPTY);
  const [filter, setFilter] = useState<string>('all');
  const [mode, setMode] = useState<'local' | 'synced'>('local');
  const [confirmId, setConfirmId] = useState<string>('');
  const [delMsg, setDelMsg] = useState<string>('');
  // Slice 42 — distress tags + the human call queue.
  const [tagsByLead, setTagsByLead] = useState<Record<string, DistressTagRow[]>>({});
  const [queueMode, setQueueMode] = useState(false);
  const [queueTag, setQueueTag] = useState<string>('any');

  const refreshTags = () => {
    if (userId && supabaseConfigured) {
      loadAllTags(userId).then(setTagsByLead).catch(() => {});
    }
  };

  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadLeads(userId).then((rows) => {
        if (rows) { setLeads(rows); setMode('synced'); onLeads(rows); }
      }).catch(() => {});
      refreshTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const onContactsChanged = (lead: Lead, phones: string[], emails: string[]) => {
    const next = leads.map((x) => (x === lead ? { ...x, phones, emails } : x));
    setLeads(next); onLeads(next);
  };

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

  // Slice 33 — two-step delete: the button arms a confirm on that row
  // only; confirming removes the row from Supabase (synced mode) and
  // from the list either way. No silent one-click destruction.
  const removeLead = async (lead: Lead) => {
    setDelMsg('');
    try {
      if (userId && supabaseConfigured && lead.id && !lead.id.startsWith('local-')) {
        await deleteLead(userId, lead.id);
      }
      const next = leads.filter((x) => x !== lead);
      setLeads(next); onLeads(next);
      setConfirmId('');
      setDelMsg(`Deleted: ${lead.property_address}`);
    } catch (e) {
      setDelMsg(`Could not delete ${lead.property_address}: ${(e as { message?: string })?.message || 'unknown error'}`);
    }
  };

  let shown = filter === 'all' ? leads : leads.filter((l) => l.status === filter);
  if (queueMode) {
    const todayISO = new Date().toISOString().slice(0, 10);
    shown = shown.filter((l) => {
      const ts = tagsByLead[l.id || ''] || [];
      return ts.length > 0 && (queueTag === 'any' || ts.some((t) => t.tag === queueTag));
    });
    shown = sortCallQueue(shown, tagsByLead, todayISO);
  }

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

      <div style={{ marginTop: 8 }}>
        <label>
          <input type="checkbox" checked={queueMode} onChange={(e) => setQueueMode(e.target.checked)} />{' '}
          Call queue — tagged leads only, in follow-up order
        </label>
        {queueMode && (
          <>{' '}
            <select value={queueTag} onChange={(e) => setQueueTag(e.target.value)}>
              <option value="any">Any tag</option>
              {DISTRESS_TAGS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <span style={{ fontSize: 12.5, color: '#94a3b8' }}> Overdue follow-ups first. You make the calls — the Comms Center checks consent and the blocklist before any channel opens.</span>
          </>
        )}
      </div>

      {delMsg && <p style={{ fontSize: 13 }}>{delMsg}</p>}
      {shown.length === 0 && <p>No leads yet. Add your first lead above.</p>}
      <ul>
        {shown.map((l) => (
          <li key={l.id || l.property_address}>
            <strong>{l.property_address}</strong> {l.city ? `— ${l.city}, ${l.state || ''} ${l.zip || ''}` : ''}
            {' '}· {l.status}
            {l.follow_up_date ? ` · follow-up ${l.follow_up_date}` : ''}
            {l.owner_name ? ` · owner: ${l.owner_name}` : ''}
            {l.list_source ? ` · source: ${l.list_source}` : ''}
            <ResearchLinks lead={l} />
            {userId && mode === 'synced' && l.id && !l.id.startsWith('local-') && (
              <LeadTags userId={userId} lead={l} tags={tagsByLead[l.id] || []}
                onTagsChanged={refreshTags} onContactsChanged={onContactsChanged} />
            )}
            {' '}
            {confirmId === (l.id || l.property_address) ? (
              <>
                <button onClick={() => removeLead(l)}>Confirm delete</button>{' '}
                <button onClick={() => setConfirmId('')}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmId(l.id || l.property_address)}>Delete</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
