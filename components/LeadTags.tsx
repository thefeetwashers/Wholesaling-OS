'use client';

import { useState } from 'react';
import type { Lead } from '../lib/leads';
import { checkPhone } from '../lib/phone';
import {
  DISTRESS_TAGS, distressLabel, addTag, removeTag,
  loadContactEntries, addContactEntry, updateLeadContacts,
  type DistressTagRow, type ContactEntryRow,
} from '../lib/distress';
import { courtesyHold, courtesyHoldLine } from '../lib/courtesy';

// Slice 42 — per-lead distress tags + manual contact entry.
// Tags: chosen by the wholesaler from the fixed list, each stamped
// with the date they observed the signal; the lead's list_source
// already carries where the lead came from. The platform assigns
// nothing and scores nothing.
// Contact entry: a phone/email the wholesaler found THEMSELVES and
// types in, stamped with its source + today's date. The platform
// never fetches contact details. A phone that fails the format check
// is flagged with the reason and saved only if the wholesaler
// confirms "save anyway" — kept exactly as entered, like Slice 32.

export default function LeadTags({
  userId, lead, tags, onTagsChanged, onContactsChanged,
}: {
  userId: string;
  lead: Lead;
  tags: DistressTagRow[];
  onTagsChanged: () => void;
  onContactsChanged: (lead: Lead, phones: string[], emails: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [observed, setObserved] = useState(() => new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState<'phone' | 'email'>('phone');
  const [value, setValue] = useState('');
  const [source, setSource] = useState('');
  const [warn, setWarn] = useState('');
  const [armed, setArmed] = useState(false);
  const [entries, setEntries] = useState<ContactEntryRow[] | null>(null);
  const [msg, setMsg] = useState('');

  const leadId = lead.id || '';
  const remaining = DISTRESS_TAGS.filter((t) => !tags.some((x) => x.tag === t.key));

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && entries === null) {
      try { setEntries(await loadContactEntries(userId, leadId)); } catch { setEntries([]); }
    }
  };

  const doAddTag = async () => {
    if (!newTag) return;
    setMsg('');
    try {
      await addTag(userId, leadId, newTag, observed);
      setNewTag('');
      onTagsChanged();
      setMsg(`Tag added: ${distressLabel(newTag)} (observed ${observed}).`);
    } catch (e) {
      setMsg(`Could not add the tag: ${(e as { message?: string })?.message || 'unknown error'}`);
    }
  };

  const doRemoveTag = async (row: DistressTagRow) => {
    setMsg('');
    try {
      await removeTag(userId, row.id);
      onTagsChanged();
    } catch (e) {
      setMsg(`Could not remove the tag: ${(e as { message?: string })?.message || 'unknown error'}`);
    }
  };

  const doAddContact = async () => {
    const v = value.trim();
    const s = source.trim();
    setMsg('');
    if (!v || !s) { setMsg('Add the contact and where you found it — the source is required.'); return; }
    let stored = v;
    if (kind === 'phone') {
      const check = checkPhone(v);
      if (check.valid && check.e164) stored = check.e164;
      else if (!armed) {
        setWarn(`That number fails the format check: ${check.reason}. It will be saved exactly as entered if you confirm.`);
        setArmed(true);
        return;
      }
    }
    if (kind === 'email' && !v.includes('@')) {
      if (!armed) { setWarn('That does not look like an email address. It will be saved exactly as entered if you confirm.'); setArmed(true); return; }
    }
    try {
      const phones = kind === 'phone' ? Array.from(new Set([...(lead.phones || []), stored])) : (lead.phones || []);
      const emails = kind === 'email' ? Array.from(new Set([...(lead.emails || []), stored.toLowerCase()])) : (lead.emails || []);
      const finalValue = kind === 'email' ? stored.toLowerCase() : stored;
      await updateLeadContacts(userId, leadId, phones, emails);
      await addContactEntry(userId, leadId, kind, finalValue, s);
      onContactsChanged(lead, phones, emails);
      setEntries(await loadContactEntries(userId, leadId));
      setValue(''); setSource(''); setWarn(''); setArmed(false);
      setMsg(`Contact saved with its source: ${finalValue} — ${s}.`);
    } catch (e) {
      setMsg(`Could not save the contact: ${(e as { message?: string })?.message || 'unknown error'}`);
    }
  };

  return (
    <span>
      {' '}
      <button onClick={toggle}>{open ? 'Hide tags & contacts' : `Tags & contacts${tags.length ? ` (${tags.length})` : ''}`}</button>
      {tags.length > 0 && (
        <span style={{ fontSize: 12.5 }}> {tags.map((t) => (
          <span key={t.id} style={{ background: '#334155', borderRadius: 8, padding: '1px 7px', marginRight: 4 }}>
            {distressLabel(t.tag)} · {t.observed_on}
          </span>
        ))}</span>
      )}
      {open && (
        <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginTop: 8, maxWidth: 640 }}>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 0 }}>
            Distress tags are YOUR record of what your source said about this property — the platform
            never looks a property up or scores it. Calls stay human: work the queue in the Comms Center,
            where consent and the blocklist are checked before any channel opens.
          </p>
          {tags.map((t) => (
            <div key={t.id} style={{ fontSize: 13, marginBottom: 4 }}>
              {distressLabel(t.tag)} — observed {t.observed_on}{' '}
              <button onClick={() => doRemoveTag(t)}>Remove</button>
            </div>
          ))}
          {(() => {
            const h = courtesyHold(tags, new Date().toISOString().slice(0, 10));
            return h ? (
              <p style={{ fontSize: 13, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', padding: '8px 10px', borderRadius: 8 }}>
                🤝 {courtesyHoldLine(h)} While it runs, this lead stays out of the call queue and every
                outreach surface shows the hold.
              </p>
            ) : null;
          })()}
          {remaining.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <select value={newTag} onChange={(e) => setNewTag(e.target.value)}>
                <option value="">— add a tag —</option>
                {remaining.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>{' '}
              <input type="date" value={observed} onChange={(e) => setObserved(e.target.value)} />{' '}
              <button onClick={doAddTag} disabled={!newTag}>Add tag</button>
            </div>
          )}

          <h4 style={{ marginBottom: 4 }}>Add a contact you found yourself</h4>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 0 }}>
            Type in a phone or email YOU found — official records, a source you use under its terms, a
            referral, a reply. It is stamped with the source and today's date. The platform never fetches
            contact details for anyone.
          </p>
          <div>
            <select value={kind} onChange={(e) => { setKind(e.target.value as 'phone' | 'email'); setWarn(''); setArmed(false); }}>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
            </select>{' '}
            <input placeholder={kind === 'phone' ? 'Phone number' : 'Email address'} value={value}
              onChange={(e) => { setValue(e.target.value); setWarn(''); setArmed(false); }} />{' '}
            <input placeholder="Where you found it (required)" value={source}
              onChange={(e) => setSource(e.target.value)} style={{ minWidth: 220 }} />{' '}
            <button onClick={doAddContact}>{armed ? 'Save anyway' : 'Add contact'}</button>
          </div>
          {warn && <p style={{ fontSize: 12.5, color: '#fbbf24' }}>{warn}</p>}
          {entries && entries.length > 0 && (
            <ul style={{ fontSize: 12.5, marginTop: 8 }}>
              {entries.map((en) => (
                <li key={en.id}>{en.kind}: {en.value} — source: {en.source} · entered {en.entered_on}</li>
              ))}
            </ul>
          )}
          {msg && <p style={{ fontSize: 12.5 }}>{msg}</p>}
        </div>
      )}
    </span>
  );
}
