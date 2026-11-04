'use client';

import { useEffect, useRef, useState } from 'react';
import { loadLeads, type Lead } from '../lib/leads';
import { loadBuyers, type BuyerRow } from '../lib/buyers';
import { loadMyListings, type MyListing } from '../lib/portals';

// Slice 46 — one search box for the whole office. A wholesaler on a
// call should not hunt view by view: type an address, a name, or a
// phone number and jump. Searches ONLY the signed-in wholesaler's
// own rows (the same loaders every view uses, RLS-scoped), matched
// in the browser — no new data path, nothing leaves the office.

interface Hit { group: string; label: string; sub: string; view: string }

export default function GlobalSearch({ userId, onNavigate }: { userId: string; onNavigate: (view: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const cache = useRef<{ leads: Lead[]; buyers: BuyerRow[]; listings: MyListing[] } | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) { setHits([]); return; }
    let live = true;
    const run = async () => {
      if (!cache.current) {
        const [leads, buyers, listings] = await Promise.all([
          loadLeads(userId).catch(() => null),
          loadBuyers(userId).catch(() => null),
          loadMyListings(userId).catch(() => [] as MyListing[]),
        ]);
        cache.current = { leads: leads || [], buyers: buyers || [], listings: listings || [] };
      }
      if (!live || !cache.current) return;
      const digits = needle.replace(/\D/g, '');
      const out: Hit[] = [];
      for (const l of cache.current.leads) {
        const hay = `${l.property_address} ${l.owner_name || ''} ${l.city || ''} ${l.zip || ''}`.toLowerCase();
        const phoneHit = digits.length >= 4 && (l.phones || []).some((p) => p.replace(/\D/g, '').includes(digits));
        if (hay.includes(needle) || phoneHit) {
          out.push({ group: 'Leads', label: l.property_address, sub: `${l.owner_name || 'Owner'} · ${l.status}`, view: 'leads' });
        }
        if (out.length >= 18) break;
      }
      for (const b of cache.current.buyers) {
        if (`${b.name} ${b.buy_box || ''}`.toLowerCase().includes(needle)) {
          out.push({ group: 'Buyers', label: b.name, sub: b.buy_box || 'Buyer', view: 'buyers' });
        }
      }
      for (const li of cache.current.listings) {
        const addr = li.deals?.documents?.property_address || '';
        if (addr.toLowerCase().includes(needle)) {
          out.push({ group: 'Listings', label: addr, sub: `Listing · ${li.listing_status}`, view: 'listings' });
        }
      }
      setHits(out.slice(0, 18));
    };
    const t = setTimeout(run, 180);
    return () => { live = false; clearTimeout(t); };
  }, [q, userId]);

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="🔎 Search your office — address, name, or phone…"
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14.5 }}
        aria-label="Search your office"
      />
      {open && q.trim().length >= 2 && (
        <div style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
          {hits.length === 0 && <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0, padding: '10px 12px' }}>No matches in your office for “{q.trim()}”.</p>}
          {hits.map((h, i) => (
            <button
              key={i}
              onClick={() => { onNavigate(h.view); setOpen(false); setQ(''); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid #1e293b', padding: '8px 12px', cursor: 'pointer', color: '#e2e8f0' }}
            >
              <span style={{ fontSize: 11, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h.group}</span>
              <br />
              <span style={{ fontSize: 14 }}>{h.label}</span>
              <span style={{ fontSize: 12.5, color: '#94a3b8' }}> — {h.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
