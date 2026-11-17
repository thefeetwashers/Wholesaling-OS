// Slice 132 — Part 2: public Cash Buyers directory (/buyers).
//
// Shows PUBLISHED buy boxes ONLY (published = true). Each card
// shows ONLY what the buyer chose to publish: display name +
// company from storefront_profiles (public-safe fields only —
// loadPublicStorefront returns much more, but this page selects
// display_name and company_name and nothing else), markets,
// states, ZIP codes, property types, price range, rehab
// tolerance. NO email/phone on any card — contact stays private
// until the buyer chooses to share it (mutual opt-in on a deal
// response; see lib/buyer-profile.ts). The private
// per-wholesaler cash_buyers list stays private (sealed office) —
// this directory is ONLY published buy boxes.
//
// "Send this buyer a deal": the Cash Buyers view in the app
// (components/CashBuyersDealBlast.tsx) has no URL route and no
// buyer-focus prop — it is an in-app dashboard view switched by
// sidebar state — so there is no clean deep-link to open it with
// a buyer pre-focused. The button therefore links to the
// dashboard home and says plainly to open Cash Buyers there, add
// the buyer to the private list, and build the blast. No
// messaging system is invented: the app never sends email itself.
//
// No OpenCorporates company check is shown here: the live check
// on Nov 17, 2026 returned HTTP 401 (API token required — the
// free no-key tier no longer exists), the founder has no token,
// so no company-check route was built and no badge is claimed.
// No counts, no OBL data, no fake buyers anywhere on this page.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { FLORIDA_COUNTIES } from '../../lib/vendor-marketplace';

const PROPERTY_TYPES = ['Single Family', 'Multi-Family', 'Condo / Townhouse', 'Land', 'Mobile Home', 'Commercial'];

interface PublishedBox {
  user_id: string;
  markets: string[];
  states: string[];
  zip_codes: string[];
  property_types: string[];
  min_price: number | null;
  max_price: number | null;
  rehab_tolerance: string | null;
}

interface PublicName {
  wholesaler_id: string;
  display_name: string;
  company_name: string;
}

function money(n: number | null): string {
  return n == null ? 'not set' : `$${Number(n).toLocaleString()}`;
}

export default function BuyersDirectory() {
  const [boxes, setBoxes] = useState<PublishedBox[]>([]);
  const [names, setNames] = useState<Record<string, PublicName>>({});
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState('');

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        if (!supabaseConfigured || !supabase) {
          setLoadError('The directory is not available yet — Supabase is not configured on this deployment.');
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        if (on) setSignedIn(!!sessionData.session);
        const { data, error } = await supabase
          .from('wholesaler_buy_boxes')
          .select('user_id, markets, states, zip_codes, property_types, min_price, max_price, rehab_tolerance')
          .eq('published', true)
          .order('updated_at', { ascending: false });
        if (error) throw new Error(error.message || 'Could not load published buy boxes.');
        const rows = (data || []) as PublishedBox[];
        if (on) setBoxes(rows);
        const ids = [...new Set(rows.map((r) => r.user_id))];
        if (ids.length > 0) {
          // Public-safe fields only: display name + company. Never
          // public_phone / public_email — no contact on this page.
          const { data: profiles } = await supabase
            .from('storefront_profiles')
            .select('wholesaler_id, display_name, company_name')
            .in('wholesaler_id', ids);
          if (on && profiles) {
            const map: Record<string, PublicName> = {};
            (profiles as PublicName[]).forEach((p) => { map[p.wholesaler_id] = p; });
            setNames(map);
          }
        }
      } catch (e) {
        if (on) setLoadError(e instanceof Error ? e.message : 'Could not load published buy boxes.');
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const price = priceFilter.trim() === '' ? null : Number(priceFilter.replace(/[^0-9.]/g, ''));
    return boxes.filter((b) => {
      if (marketFilter && !(b.markets || []).includes(marketFilter)) return false;
      if (stateFilter && !(b.states || []).includes(stateFilter)) return false;
      if (typeFilter && !(b.property_types || []).includes(typeFilter)) return false;
      if (price != null && !Number.isNaN(price)) {
        if (b.min_price != null && price < b.min_price) return false;
        if (b.max_price != null && price > b.max_price) return false;
      }
      return true;
    });
  }, [boxes, marketFilter, stateFilter, typeFilter, priceFilter]);

  const wrap: React.CSSProperties = { maxWidth: 900, margin: '0 auto' };

  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS — Cash Buyers</p>
      <section style={{ background: '#1e293b', padding: 22, borderRadius: 12, marginTop: 16 }}>
        <h1 style={{ marginTop: 0 }}>Cash Buyers — published buy boxes</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65 }}>
          Cash buyers who chose to publish what they buy: their markets, property types, and price
          range. Contact details are never shown here — they stay private until the buyer chooses
          to share them. These are real buy boxes saved in WholesalingOS, nothing copied from
          anywhere else, and no buyer is listed until they publish.
        </p>
        <p style={{ fontSize: 13.5 }}>
          <a href="/#signin" style={{ color: '#7dd3fc' }}>Sign in</a>
          {' · '}
          <a href="/join" style={{ color: '#7dd3fc' }}>Join as a cash buyer</a>
          {' · '}
          <a href="/vip" style={{ color: '#7dd3fc' }}>Cash Buyer VIP Portal — complete your profile</a>
        </p>
      </section>

      <section style={{ background: '#0f172a', padding: 16, borderRadius: 12, marginTop: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <label style={{ fontSize: 13 }}>
            Market (Florida county){' '}
            <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}>
              <option value="">All markets</option>
              {FLORIDA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            State{' '}
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="">All states</option>
              {['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Property type{' '}
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Deal price — show buyers whose range covers it{' '}
            <input value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} placeholder="e.g. 150000" inputMode="decimal" style={{ width: 130 }} />
          </label>
        </div>
      </section>

      {loading ? (
        <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 16 }}>Loading published buy boxes…</p>
      ) : loadError ? (
        <p style={{ fontSize: 14, color: '#f87171', marginTop: 16 }}>
          {loadError} The directory shows nothing rather than guessing — this usually means the
          buy-box publish update has not been applied in Supabase yet.
        </p>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 16 }}>No published buy boxes yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
          {filtered.map((b) => {
            const n = names[b.user_id];
            const displayName = n?.display_name?.trim() || 'A cash buyer';
            const company = n?.company_name?.trim() || '';
            return (
              <article key={b.user_id} style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 12, padding: '16px 18px' }}>
                <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>{displayName}</h2>
                {company && <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 8px' }}>{company}</p>}
                <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 8px' }}>
                  Markets: {(b.markets || []).length > 0 ? b.markets.join(', ') : 'not set'}
                  <br />
                  States: {(b.states || []).length > 0 ? b.states.join(', ') : 'not set'}
                  <br />
                  ZIP codes: {(b.zip_codes || []).length > 0 ? b.zip_codes.join(', ') : 'not set'}
                  <br />
                  Property types: {(b.property_types || []).length > 0 ? b.property_types.join(', ') : 'not set'}
                  <br />
                  Price range: {money(b.min_price)} – {money(b.max_price)}
                  <br />
                  Rehab tolerance: {b.rehab_tolerance || 'no preference'}
                </p>
                {signedIn ? (
                  <>
                    <a href="/" style={{ display: 'inline-block', background: '#059669', color: '#fff', fontWeight: 700, padding: '9px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13.5 }}>
                      Send this buyer a deal
                    </a>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>
                      Opens your dashboard — choose Cash Buyers there, add the buyer to your
                      private list, and build the blast. The app never sends email itself.
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 13.5, margin: 0 }}>
                    <a href="/#signin" style={{ color: '#7dd3fc' }}>Sign in to send this buyer a deal.</a>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
        Your private cash buyers list is never shown here — it stays in your sealed office. Only
        buy boxes their owners published appear in this directory, and only with the criteria
        they chose to publish.
      </p>
    </div>
  );
}
