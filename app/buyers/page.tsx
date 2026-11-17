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
//
// Slice 133 — the Market filter follows the selected State
// (shared StateCountyFilter, real Census county data), and
// signed-in buyers can save the current filters as a saved
// search (lib/saved-searches.ts, table buyer_saved_searches) and
// apply or delete it later. Matching deals are shown in the app
// only — no email alerts (no email provider is connected).

'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import StateCountyFilter from '../../components/StateCountyFilter';
import { loadMySavedSearches, saveSavedSearch, deleteSavedSearch, savedSearchLabel, type BuyerSavedSearch } from '../../lib/saved-searches';
import { loadVerifiedPofByUserIds } from '../../lib/proof-of-funds';
import BuyerPofStatus from '../../components/BuyerPofStatus';

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
  // Slice 133 criteria — shown when set, "not provided" when blank.
  max_arv_pct: number | null;
  min_profit: number | null;
  condition_preferences: string[];
  strategy_preferences: string[];
  closing_timeline: string | null;
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
  const [verifiedPof, setVerifiedPof] = useState<Record<string, string | null>>({});
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  // Slice 133 — price RANGE (min/max) instead of a single deal
  // price, so the filters match what a saved search stores.
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  // Slice 133 — the signed-in buyer's saved searches.
  const [savedSearches, setSavedSearches] = useState<BuyerSavedSearch[]>([]);
  const [savedSearchName, setSavedSearchName] = useState('');
  const [saveBanner, setSaveBanner] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        if (!supabaseConfigured || !supabase) {
          setLoadError('The directory is not available yet — Supabase is not configured on this deployment.');
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        if (on) {
          setSignedIn(!!sessionData.session);
          setUserId(sessionData.session?.user?.id || null);
        }
        // Slice 133 — the signed-in buyer's saved searches load
        // with the directory; signed out means none.
        if (sessionData.session?.user?.id) {
          loadMySavedSearches(sessionData.session.user.id)
            .then((rows) => { if (on) setSavedSearches(rows); })
            .catch(() => { /* Saved searches stay empty rather than faked. */ });
        }
        const { data, error } = await supabase
          .from('wholesaler_buy_boxes')
          .select('user_id, markets, states, zip_codes, property_types, min_price, max_price, rehab_tolerance, max_arv_pct, min_profit, condition_preferences, strategy_preferences, closing_timeline')
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
          // Slice 133 — POF verified dates for the listed buyers,
          // from the public view (verified rows only). A refused
          // load leaves the badges off; it never blocks the list.
          try {
            const verified = await loadVerifiedPofByUserIds(ids);
            if (on) setVerifiedPof(verified);
          } catch {
            if (on) setVerifiedPof({});
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
    const min = minPriceFilter.trim() === '' ? null : Number(minPriceFilter.replace(/[^0-9.]/g, ''));
    const max = maxPriceFilter.trim() === '' ? null : Number(maxPriceFilter.replace(/[^0-9.]/g, ''));
    return boxes.filter((b) => {
      if (marketFilter && !(b.markets || []).includes(marketFilter)) return false;
      if (stateFilter && !(b.states || []).includes(stateFilter)) return false;
      if (typeFilter && !(b.property_types || []).includes(typeFilter)) return false;
      // Slice 133 — price RANGE overlap: a buyer shows when their
      // range overlaps the searched range. A missing bound on
      // either side means no constraint there.
      if (min != null && !Number.isNaN(min) && b.max_price != null && b.max_price < min) return false;
      if (max != null && !Number.isNaN(max) && b.min_price != null && b.min_price > max) return false;
      return true;
    });
  }, [boxes, marketFilter, stateFilter, typeFilter, minPriceFilter, maxPriceFilter]);

  function numOrNull(v: string): number | null {
    if (v.trim() === '') return null;
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return Number.isNaN(n) ? null : n;
  }

  // Slice 133 — save the current filters as a saved search.
  async function saveCurrentSearch() {
    if (!userId) return;
    setSavingSearch(true);
    setSaveBanner('');
    try {
      const row = await saveSavedSearch(userId, {
        name: savedSearchName.trim(),
        states: stateFilter ? [stateFilter] : [],
        markets: marketFilter ? [marketFilter] : [],
        property_types: typeFilter ? [typeFilter] : [],
        min_price: numOrNull(minPriceFilter),
        max_price: numOrNull(maxPriceFilter),
      });
      setSavedSearches((prev) => [row, ...prev]);
      setSavedSearchName('');
      setSaveBanner('Search saved.');
    } catch (e) {
      setSaveBanner(e instanceof Error ? e.message : 'Could not save this search.');
    } finally {
      setSavingSearch(false);
    }
  }

  function applySearch(s: BuyerSavedSearch) {
    setStateFilter((s.states || [])[0] || '');
    setMarketFilter((s.markets || [])[0] || '');
    setTypeFilter((s.property_types || [])[0] || '');
    setMinPriceFilter(s.min_price != null ? String(s.min_price) : '');
    setMaxPriceFilter(s.max_price != null ? String(s.max_price) : '');
    setSaveBanner(`Applied saved search: ${s.name || savedSearchLabel(s)}.`);
  }

  async function removeSearch(s: BuyerSavedSearch) {
    if (!userId || !s.id) return;
    try {
      await deleteSavedSearch(userId, s.id);
      setSavedSearches((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) {
      setSaveBanner(e instanceof Error ? e.message : 'Could not delete that search.');
    }
  }

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
        {/* Slice 133 — public CTA: a buyer registers their own buy
            box; the link pre-selects Buyer on /join. */}
        <p style={{ margin: '12px 0 0' }}>
          <a href="/join?role=buyer" style={{ display: 'inline-block', background: '#059669', color: '#fff', fontWeight: 700, padding: '10px 18px', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
            Get deals like this — register your buy box
          </a>
        </p>
        <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '8px 0 0' }}>
          You register yourself — one tap on the link, pick Buyer, and set your buy box.
        </p>
      </section>

      <section style={{ background: '#0f172a', padding: 16, borderRadius: 12, marginTop: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {/* Slice 133 — state-linked Market filter: pick a state
              and the Market list shows that state's counties. */}
          <StateCountyFilter
            single
            states={stateFilter ? [stateFilter] : []}
            onStatesChange={(s) => setStateFilter(s[0] || '')}
            markets={marketFilter ? [marketFilter] : []}
            onMarketsChange={(m) => setMarketFilter(m[0] || '')}
            labelStyle={{ fontSize: 13 }}
            hintStyle={{ fontSize: 12, color: '#94a3b8' }}
          />
          <label style={{ fontSize: 13 }}>
            Property type{' '}
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Min price — show buyers whose range reaches it{' '}
            <input value={minPriceFilter} onChange={(e) => setMinPriceFilter(e.target.value)} placeholder="e.g. 100000" inputMode="decimal" style={{ width: 130 }} />
          </label>
          <label style={{ fontSize: 13 }}>
            Max price — show buyers whose range reaches it{' '}
            <input value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(e.target.value)} placeholder="e.g. 250000" inputMode="decimal" style={{ width: 130 }} />
          </label>
        </div>
      </section>

      {/* Slice 133 — saved searches (signed-in buyers only). */}
      <section style={{ background: '#0f172a', padding: 16, borderRadius: 12, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Saved searches</h2>
        {signedIn && userId ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <input
                value={savedSearchName}
                onChange={(e) => setSavedSearchName(e.target.value)}
                placeholder="Name this search (optional)"
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: 13, width: 220 }}
              />
              <button
                type="button"
                onClick={saveCurrentSearch}
                disabled={savingSearch}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
              >
                {savingSearch ? 'Saving…' : 'Save this search'}
              </button>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Saves the filters above — state, market, type, and price range.
              </span>
            </div>
            {saveBanner && <p style={{ fontSize: 13, color: '#fcd34d', margin: '8px 0 0' }}>{saveBanner}</p>}
            {savedSearches.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '10px 0 0' }}>No saved searches yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
                {savedSearches.map((s) => (
                  <li key={s.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13, padding: '8px 0', borderTop: '1px solid #1e293b' }}>
                    <span style={{ flex: 1, minWidth: 200 }}>{s.name || savedSearchLabel(s)}</span>
                    <button type="button" onClick={() => applySearch(s)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#7dd3fc', cursor: 'pointer', fontSize: 13, borderColor: '#334155' }}>
                      Apply
                    </button>
                    <button type="button" onClick={() => removeSearch(s)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: 13 }}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '10px 0 0' }}>
              Matching deals are shown in the app only — your VIP portal lists deals matching your
              buy box, and nothing is emailed or texted.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            <a href="/#signin" style={{ color: '#7dd3fc' }}>Sign in</a> to save searches — a saved
            search belongs to your account, so an account is needed.
          </p>
        )}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 12, marginTop: 16 }}>
          {/* Slice 133 — min(280px, 100%): the card column shrinks
              to the viewport at phone width instead of forcing a
              280px track that overflows below ~320px. */}
          {filtered.map((b) => {
            const n = names[b.user_id];
            const displayName = n?.display_name?.trim() || 'A cash buyer';
            const company = n?.company_name?.trim() || '';
            return (
              <article key={b.user_id} style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 12, padding: '16px 18px' }}>
                <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>{displayName}</h2>
                {company && <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 8px' }}>{company}</p>}
                {/* Slice 133 — "POF verified — <date>" only when the
                    operator actually verified this buyer; nothing
                    otherwise. */}
                <BuyerPofStatus userId={b.user_id} verifiedAt={verifiedPof[b.user_id] ?? null} />
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
                  Max ARV %: {b.max_arv_pct != null ? `${Number(b.max_arv_pct)}%` : 'not provided'}
                  <br />
                  Min profit: {b.min_profit != null ? `$${Number(b.min_profit).toLocaleString()}` : 'not provided'}
                  <br />
                  Condition preferences: {(b.condition_preferences || []).length > 0 ? b.condition_preferences.join(', ') : 'not provided'}
                  <br />
                  Strategy preferences: {(b.strategy_preferences || []).length > 0 ? b.strategy_preferences.join(', ') : 'not provided'}
                  <br />
                  Closing timeline: {b.closing_timeline || 'not provided'}
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
