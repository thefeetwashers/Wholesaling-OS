'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadMyListings, setListingStatus, type MyListing } from '../lib/portals';

// Slice 43 — My Listings as its own sidebar door (the manager used to
// live inside the portal dashboard scroll). Same data and functions
// as the dashboard copy: the wholesaler's marketplace listings with
// Activate/Pause. An active listing appears in the buyer feed and on
// the public deals page; a paused one is visible only here.

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export default function ListingsManager({ userId }: { userId: string }) {
  const [listings, setListings] = useState<MyListing[]>([]);
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    loadMyListings(userId)
      .then((rows) => { setListings(rows); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (l: MyListing) => {
    const next = l.listing_status === 'active' ? 'draft' : 'active';
    try {
      await setListingStatus(l.id, next);
      setMsg(next === 'active'
        ? 'Listing activated — it now appears in the buyer feed and on the public deals page.'
        : 'Listing paused — buyers no longer see it.');
      refresh();
    } catch (e) {
      setMsg(`Could not update the listing: ${(e as { message?: string })?.message || 'unknown error'}`);
    }
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12 }}>
      <h2>My Listings — Public Deal Pages</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>
        Every active listing gets a public page buyers can open from a link — the address, the total
        price, and the equitable-interest disclosure. Your assignment fee never appears on the seller's
        view of anything.
      </p>
      {msg && <p style={{ fontSize: 13.5 }}>{msg}</p>}
      {loaded && listings.length === 0 && (
        <p style={{ fontSize: 14 }}>No listings yet. Listings are created from a signed deal in Contracts &amp; Closing.</p>
      )}
      <ul style={{ fontSize: 14 }}>
        {listings.map((l) => (
          <li key={l.id} style={{ marginBottom: 8 }}>
            <strong>{l.deals?.documents?.property_address || 'Property'}</strong>
            {' '}— total {money(Number(l.total_marketplace_cost))}
            {' '}· {l.visibility} · status: {l.listing_status}{' '}
            <button onClick={() => toggle(l)}>{l.listing_status === 'active' ? 'Pause' : 'Activate listing'}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
