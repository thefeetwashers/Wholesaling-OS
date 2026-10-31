'use client';

import { useState } from 'react';
import { saveLead } from '../lib/leads';

// Slice 29 — add a lead from a listing link. The wholesaler pastes any
// property listing URL (a portal, a marketplace post, a county page),
// confirms the property address themselves, and the lead lands in their
// pipeline with list_source 'Listing link' and the URL saved in the
// lead's notes as its source. The app does NOT fetch or scrape the
// page — no data is pulled in or invented; the link is stored so the
// wholesaler can reopen it anytime. Consent stays 'unknown': a public
// listing is not permission to market to anyone.

export default function AddFromLink({
  userId,
  onAdded,
}: {
  userId: string | null;
  onAdded?: () => void;
}) {
  const [url, setUrl] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!userId) return null;

  async function add() {
    const link = url.trim();
    let parsed: URL | null = null;
    try { parsed = new URL(link); } catch { parsed = null; }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      setMsg('Paste a full listing link first — it should start with https://');
      return;
    }
    if (!address.trim()) {
      setMsg('Type the property address from the listing — you confirm it, the app does not read the page.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const saved = await saveLead(userId as string, {
        property_address: address.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        owner_name: ownerName.trim() || undefined,
        status: 'new',
        list_source: 'Listing link',
        notes: `Source link: ${link}`,
        consent_status: 'unknown',
      });
      if (!saved) { setMsg('Sign-in sync is not configured on this deployment, so the lead could not be saved.'); return; }
      setMsg(`Added: ${address.trim()} is now in your Leads below, with the listing link saved as its source.`);
      setUrl(''); setAddress(''); setCity(''); setState(''); setOwnerName('');
      if (onAdded) onAdded();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save that lead.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Add a lead from a link</h2>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        Found a property online? Paste the listing link, confirm the address, and it drops straight into your
        pipeline with the link saved as its source — reopen it anytime from the lead's notes. The app does not
        fetch or scrape the page; nothing about the property is pulled in or invented.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ flex: '2 1 320px' }} placeholder="Listing link — https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input style={{ flex: '2 1 240px' }} placeholder="Property address (you confirm it)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input style={{ flex: '1 1 120px' }} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input style={{ flex: '0 1 70px' }} placeholder="ST" value={state} onChange={(e) => setState(e.target.value)} />
        <input style={{ flex: '1 1 160px' }} placeholder="Owner / seller name (optional)" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        <button disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Add to my pipeline'}</button>
      </div>
      {msg && <p style={{ fontSize: 13.5 }}>{msg}</p>}
    </section>
  );
}
