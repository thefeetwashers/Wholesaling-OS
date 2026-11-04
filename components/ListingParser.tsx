'use client';

import { useState } from 'react';
import { saveLead } from '../lib/leads';
import { parseListingText, type ParsedListing } from '../lib/parse-listing';

// Slice 34 — paste-a-listing parser. The wholesaler copies a listing's
// text themselves and pastes it; lib/parse-listing extracts only what
// the text states (address, format-checked phones, emails, price and
// specs for the notes, FSBO marker, agent/owner ONLY when explicitly
// labeled). The preview is fully editable — extraction is a draft,
// the wholesaler is the verifier — and saving creates the lead with
// list_source 'Pasted listing' and the provenance stamped in notes.
// The app never fetches the listing page. Consent stays 'unknown'.

export default function ListingParser({ userId, onAdded }: { userId: string | null; onAdded?: () => void }) {
  const [raw, setRaw] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [parsed, setParsed] = useState<ParsedListing | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!userId) return null;

  function extract() {
    setMsg('');
    if (!raw.trim()) { setMsg('Paste the listing text first — copy it from the page yourself (select all, copy), then paste it here.'); return; }
    const p = parseListingText(raw);
    setParsed(p);
    if (!p.property_address) {
      setMsg('No street address was found in that text. You can type it in the preview below — nothing else was invented to fill the gap.');
    }
  }

  function set<K extends keyof ParsedListing>(key: K, value: ParsedListing[K]) {
    setParsed((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function createLead() {
    if (!parsed) return;
    if (!parsed.property_address.trim()) { setMsg('The lead needs a property address — type it in the preview first.'); return; }
    setBusy(true);
    setMsg('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const noteLines = [
        `From pasted listing text ${today} — extracted only what the text states; blanks were left blank.`,
        ...(sourceUrl.trim() ? [`Source link: ${sourceUrl.trim()}`] : []),
        ...parsed.notes_bits,
        ...(parsed.invalid_phone_candidates
          ? [`${parsed.invalid_phone_candidates} phone-like string(s) in the text failed the format check and were not stored.`]
          : []),
      ];
      const saved = await saveLead(userId as string, {
        property_address: parsed.property_address.trim(),
        city: parsed.city.trim() || undefined,
        state: parsed.state.trim() || undefined,
        zip: parsed.zip.trim() || undefined,
        owner_name: parsed.owner_name.trim() || undefined,
        phones: parsed.phones,
        emails: parsed.emails,
        status: 'new',
        list_source: 'Pasted listing',
        notes: noteLines.join(' · '),
        consent_status: 'unknown',
      });
      if (!saved) { setMsg('Sign-in sync is not configured on this deployment, so the lead could not be saved.'); return; }
      setMsg(`Added: ${parsed.property_address.trim()} is now in your Leads below, stamped "Pasted listing".`);
      setRaw(''); setSourceUrl(''); setParsed(null);
      if (onAdded) onAdded();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save that lead.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Paste a listing — get a lead</h2>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        Copy a listing's text yourself (Zillow, Redfin, an FSBO page — wherever you found it), paste it here,
        and this pulls out what the text actually states: the address, phone numbers that pass the format
        check, emails, and price/specs for the notes. An owner or agent is taken only when the text explicitly
        labels one — anything not found stays blank, and you review and edit everything before it saves.
        The app does not fetch the page.
      </p>
      <textarea
        style={{ width: '100%', minHeight: 120, boxSizing: 'border-box' }}
        placeholder="Paste the listing text here…"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <input style={{ flex: '2 1 320px' }} placeholder="Source link (optional — saved in the lead's notes)" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        <button onClick={extract}>Extract the details</button>
      </div>
      {msg && <p style={{ fontSize: 13.5 }}>{msg}</p>}
      {parsed && (
        <div style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 13.5 }}>Preview — check and edit before saving</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <input style={{ flex: '2 1 240px' }} placeholder="Property address *" value={parsed.property_address} onChange={(e) => set('property_address', e.target.value)} />
            <input style={{ flex: '1 1 120px' }} placeholder="City" value={parsed.city} onChange={(e) => set('city', e.target.value)} />
            <input style={{ flex: '0 1 70px' }} placeholder="ST" value={parsed.state} onChange={(e) => set('state', e.target.value)} />
            <input style={{ flex: '0 1 100px' }} placeholder="ZIP" value={parsed.zip} onChange={(e) => set('zip', e.target.value)} />
            <input style={{ flex: '1 1 180px' }} placeholder="Owner name (only if the text states it)" value={parsed.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
          </div>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            Listing type: <strong>{parsed.listing_type}</strong>
            {parsed.agent_name ? ` · Agent named in text: ${parsed.agent_name}` : ''}
            <br />
            Phones found (format-checked): {parsed.phones.length ? parsed.phones.join(', ') : 'none'}
            {parsed.invalid_phone_candidates ? ` · ${parsed.invalid_phone_candidates} phone-like string(s) failed the format check and will not be stored` : ''}
            <br />
            Emails found: {parsed.emails.length ? parsed.emails.join(', ') : 'none'}
            {parsed.notes_bits.length ? <><br />For the notes: {parsed.notes_bits.join(' · ')}</> : null}
          </p>
          <button disabled={busy} onClick={createLead}>{busy ? 'Saving…' : 'Create this lead'}</button>
        </div>
      )}
    </section>
  );
}
