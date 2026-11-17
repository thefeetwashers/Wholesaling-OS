'use client';

// Slice 132 — Public off-market deals page (/deals).
//
// Card grid modeled on the STRUCTURE of a public off-market
// deals listing (city/state, property type, beds/baths, sq ft,
// condition, strategy, asking price, est. ARV range, est.
// repairs). No text, listings, prices, photos, or brand is copied
// from any other marketplace — every card is one of OUR
// wholesalers' own published deals, from public.published_deals.
// NO photos: no photo flow exists — a type icon + facts only,
// never a stock or copied photo. Filters: market (city/state/ZIP/
// county), property type, price range, strategy, condition (the
// five pinned values), search. Honest empty state: "No deals
// published yet." Sign-in links to the homepage sign-in section
// (/#signin), the same way the landing page reaches it — auth is
// not rebuilt here.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchPublishedDeals, DEAL_CONDITIONS, type PublishedDeal } from '../../lib/published-deals';

const money = (n: number | null | undefined): string =>
  n == null ? 'not provided' : `$${Math.round(n).toLocaleString()}`;

const num = (n: number | null | undefined): string =>
  n == null ? 'not provided' : String(n);

function typeIcon(propertyType: string | null | undefined): string {
  const t = (propertyType || '').toLowerCase();
  if (t.includes('land') || t.includes('lot')) return '🌳';
  if (t.includes('multi') || t.includes('duplex') || t.includes('apartment') || t.includes('triplex') || t.includes('fourplex')) return '🏢';
  return '🏠';
}

function arvRange(d: PublishedDeal): string {
  if (d.arv_low == null && d.arv_high == null) return 'not provided';
  if (d.arv_low != null && d.arv_high != null) return `${money(d.arv_low)}–${money(d.arv_high)}`;
  return money(d.arv_low ?? d.arv_high);
}

export default function DealsPage() {
  const [deals, setDeals] = useState<PublishedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [market, setMarket] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [strategy, setStrategy] = useState('');
  const [condition, setCondition] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchPublishedDeals({
        market: market.trim() || undefined,
        property_type: propertyType.trim() || undefined,
        min_price: minPrice.trim() === '' ? null : Number(minPrice),
        max_price: maxPrice.trim() === '' ? null : Number(maxPrice),
        strategy: strategy.trim() || undefined,
        condition: condition || undefined,
        search: search.trim() || undefined,
      });
      setDeals(rows);
    } catch (e) {
      setError((e as Error)?.message || 'Deals could not be loaded just now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    setMarket('');
    setPropertyType('');
    setMinPrice('');
    setMaxPrice('');
    setStrategy('');
    setCondition('');
    setSearch('');
  };

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/">← WholesalingOS home</Link> · <Link href="/#signin">Sign in</Link> ·{' '}
        <Link href="/managed-dispo">Managed disposition</Link>
      </p>
      <h1 style={{ fontSize: 28, margin: '8px 0 4px' }}>Off-Market Deals</h1>
      <p style={{ fontSize: 14, color: '#475569', marginTop: 0 }}>
        Deals published by wholesalers on WholesalingOS. Details are submitter-provided — asking prices, ARV, and repair estimates
        come from the wholesaler who published the deal. Confirm the property&apos;s condition and supporting estimates with the
        submitter before making a decision. Street addresses are hidden; locations show the ZIP area only.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          placeholder="Market — city, state, ZIP, or county"
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, minWidth: 220 }}
        />
        <input
          placeholder="Property type"
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
        />
        <input
          type="number"
          min={0}
          placeholder="Min price $"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, width: 130 }}
        />
        <input
          type="number"
          min={0}
          placeholder="Max price $"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, width: 130 }}
        />
        <input
          placeholder="Strategy"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
        />
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
        >
          <option value="">Any condition</option>
          {DEAL_CONDITIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          placeholder="Search deals"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
        />
        <button onClick={load} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Filter
        </button>
        <button onClick={clearFilters} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
          Clear
        </button>
      </div>

      {loading && <p style={{ fontSize: 14, color: '#64748b' }}>Loading deals…</p>}
      {error && <p style={{ fontSize: 14, color: '#b91c1c' }}>{error}</p>}
      {!loading && !error && deals.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>No deals published yet.</div>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            No wholesaler has published a deal yet. Wholesalers publish from their own lead rows in the dashboard —{' '}
            <Link href="/#signin">sign in</Link> to publish the first one.
          </p>
        </div>
      )}
      {!loading && !error && deals.length > 0 && (
        <p style={{ fontSize: 13, color: '#64748b' }}>
          {deals.length} {deals.length === 1 ? 'deal' : 'deals'} published.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {deals.map((d) => (
          <Link
            key={d.id}
            href={`/deals/${d.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, height: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{money(d.asking_price)}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>Asking price</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                {typeIcon(d.property_type)} {d.city || 'City not given'}
                {d.state ? `, ${d.state}` : ''} {d.zip || ''}
              </div>
              <p style={{ fontSize: 13.5, color: '#475569', margin: '6px 0' }}>
                {d.property_type || 'Property type not given'}
                {d.beds != null ? ` · ${d.beds} beds` : ''}
                {d.baths != null ? ` · ${d.baths} baths` : ''}
                {d.sqft != null ? ` · ${d.sqft.toLocaleString()} sq ft` : ''}
              </p>
              <p style={{ fontSize: 13.5, color: '#475569', margin: '6px 0' }}>
                {d.condition ? `${d.condition}` : 'Condition not given'}
                {d.strategy ? ` · ${d.strategy}` : ''}
                {d.occupancy ? ` · ${d.occupancy}` : ''}
              </p>
              <p style={{ fontSize: 13.5, color: '#475569', margin: '6px 0' }}>
                Est. ARV {arvRange(d)} · Est. repairs {money(d.repair_estimate)}
              </p>
              {d.county && <p style={{ fontSize: 12.5, color: '#64748b', margin: '6px 0 0' }}>{d.county} County</p>}
              <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>
                Published {d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}
              </p>
            </article>
          </Link>
        ))}
      </div>

      <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 24 }}>
        WholesalingOS is a connection platform, not a broker, lender, title company, or legal advisor. Have a property to submit?{' '}
        <Link href="/#signin">Sign in</Link> and publish it from your leads.
      </p>
    </main>
  );
}
