// Slice 131 — Buyer Networks section, rendered inside the Cash
// Buyers view (components/CashBuyersDealBlast.tsx).
//
// OpenBuyersList (https://openbuyerslist.com/) is a free network
// where cash buyers publish their buy box and wholesalers send
// off-market deals to matching buyers. This section LINKS OUT to
// it — it does NOT copy, seed, or display any buyer names, emails,
// phones, companies, or counts from OpenBuyersList: those buyers
// never consented to be in this platform, their contact details
// are private by design there, and there is no public API or feed
// to pull from. The browse URL was verified Nov 17, 2026 by
// following the homepage's own "Browse All Off Market Deals" link:
// https://openbuyerslist.com/off-market-deals (page loaded as
// "Off Market Properties & Deals for Sale | Open Buyers List").
// No OBL buyer/user/deal counts are shown here — they go stale,
// and the homepage numbers are not our data.
//
// The "My buy box" card holds the signed-in wholesaler's OWN
// buying criteria (lib/buy-box.ts, table wholesaler_buy_boxes) so
// it can be copied into OpenBuyersList. All fields are EMPTY by
// default — no amounts pre-filled, no counties pre-selected.
//
// Hedge funds: no fund is named, listed, or claimed as a partner
// or contact anywhere here — institutional buyers buy through
// their own acquisition teams, not from a shared list.

import { useEffect, useState } from 'react';
import { loadMyBuyBox, saveMyBuyBox, type BuyBox } from '../lib/buy-box';
import { FLORIDA_COUNTIES } from '../lib/vendor-marketplace';

const OBL_HOME_URL = 'https://openbuyerslist.com/';
const OBL_BROWSE_URL = 'https://openbuyerslist.com/off-market-deals';

// Same property-type options as the cash-buyer form in
// CashBuyersDealBlast.tsx — one list, not two.
const PROPERTY_TYPES = ['Single Family', 'Multi-Family', 'Condo / Townhouse', 'Land', 'Mobile Home', 'Commercial'];

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function money(n: number | null): string {
  return n == null ? 'not set' : `$${Number(n).toLocaleString()}`;
}

export default function BuyerNetworks({ userId }: { userId: string }) {
  const [markets, setMarkets] = useState<string[]>([]);
  const [propTypes, setPropTypes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadMyBuyBox(userId)
      .then((box: BuyBox | null) => {
        if (box) {
          setMarkets(box.markets || []);
          setPropTypes(box.property_types || []);
          setMinPrice(box.min_price != null ? String(box.min_price) : '');
          setMaxPrice(box.max_price != null ? String(box.max_price) : '');
          setNotes(box.notes || '');
          setHasSaved(true);
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load your buy box.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function save() {
    setSaving(true);
    setBanner('');
    try {
      await saveMyBuyBox(userId, {
        markets,
        property_types: propTypes,
        min_price: numOrNull(minPrice),
        max_price: numOrNull(maxPrice),
        notes,
      });
      setHasSaved(true);
      setBanner('Buy box saved.');
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not save your buy box.');
    } finally {
      setSaving(false);
    }
  }

  function buyBoxText(): string {
    const lines: string[] = [];
    lines.push('My buy box — what we buy:');
    lines.push(`Markets: ${markets.length > 0 ? markets.join(', ') : 'not set'}`);
    lines.push(`Property types: ${propTypes.length > 0 ? propTypes.join(', ') : 'not set'}`);
    lines.push(`Min price: ${money(numOrNull(minPrice))}`);
    lines.push(`Max price: ${money(numOrNull(maxPrice))}`);
    if (notes.trim()) lines.push(`Notes: ${notes.trim()}`);
    return lines.join('\n');
  }

  function copyBuyBox() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(buyBoxText()).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        },
        () => setBanner('Copy failed — select the text manually.'),
      );
    } else {
      setBanner('Copy is not available in this browser — select the text manually.');
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontSize: 13 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 10 };
  const linkButtonStyle: React.CSSProperties = { display: 'inline-block', padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', textDecoration: 'none', fontSize: 13 };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: 16 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Buyer Networks — find more buyers</h3>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 8px' }}>
        OpenBuyersList is a free network where cash buyers publish what they buy — their markets,
        property types, and price range — and wholesalers send off-market deals to the buyers who
        match. Browse buyers there and connect there. WholesalingOS does not copy their buyer list:
        you browse and connect on OpenBuyersList, where contact details stay private until the
        buyer chooses to share them.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <a href={OBL_BROWSE_URL} target="_blank" rel="noreferrer" style={linkButtonStyle}>
          Browse buyers on OpenBuyersList
        </a>
        <a href={OBL_HOME_URL} target="_blank" rel="noreferrer" style={{ ...linkButtonStyle, background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }}>
          Join or post on OpenBuyersList
        </a>
      </div>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>
        Institutional buyers (hedge funds) don&apos;t take deal blasts — they buy through their own
        acquisition teams, not from a shared list.
      </p>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>My buy box — what we buy</h4>
        {loading ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>Loading your buy box…</p>
        ) : (
          <>
            {!hasSaved && !loadError && (
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px' }}>
                No buy box saved yet. Fill in what you buy — it stays empty until you save it.
              </p>
            )}
            {loadError && (
              <p style={{ fontSize: 13, color: '#b91c1c', margin: '0 0 10px' }}>{loadError}</p>
            )}
            <label style={labelStyle}>Markets (Florida counties)
              <select multiple value={markets} onChange={(e) => setMarkets(Array.from(e.target.selectedOptions, (o) => o.value))} style={{ ...inputStyle, height: 110 }}>
                {FLORIDA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ fontSize: 12, color: '#64748b' }}>Hold Ctrl/Cmd to pick several. Empty means no markets set.</span>
            </label>
            <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 6, margin: '0 0 10px', padding: '8px 10px' }}>
              <legend style={{ fontSize: 13 }}>Property types</legend>
              {PROPERTY_TYPES.map((t) => (
                <label key={t} style={{ display: 'inline-block', fontSize: 13, marginRight: 12 }}>
                  <input type="checkbox" checked={propTypes.includes(t)} onChange={(e) => setPropTypes(e.target.checked ? [...propTypes, t] : propTypes.filter((x) => x !== t))} /> {t}
                </label>
              ))}
            </fieldset>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={labelStyle}>Min price<input style={inputStyle} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min price (optional)" inputMode="decimal" /></label>
              <label style={labelStyle}>Max price<input style={inputStyle} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max price (optional)" inputMode="decimal" /></label>
            </div>
            <label style={labelStyle}>Notes<textarea style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else about what you buy…" rows={2} /></label>
            {banner && <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>{banner}</div>}
            {copied && <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>Buy box copied to clipboard.</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save my buy box'}
              </button>
              <button type="button" onClick={copyBuyBox} disabled={!hasSaved} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                Copy my buy box
              </button>
            </div>
            {!hasSaved && (
              <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
                Copy is available once you save a buy box — paste it into OpenBuyersList when you post there.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
