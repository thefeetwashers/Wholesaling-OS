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
import { loadMyBuyBox, saveMyBuyBox, CONDITION_OPTIONS, STRATEGY_OPTIONS, CLOSING_TIMELINE_OPTIONS, type BuyBox } from '../lib/buy-box';
import StateCountyFilter from './StateCountyFilter';
import BuyerInviteLink from './BuyerInviteLink';
import BuyerPofStatus from './BuyerPofStatus';

const OBL_HOME_URL = 'https://openbuyerslist.com/';
const OBL_BROWSE_URL = 'https://openbuyerslist.com/off-market-deals';

// Same property-type options as the cash-buyer form in
// CashBuyersDealBlast.tsx — one list, not two.
const PROPERTY_TYPES = ['Single Family', 'Multi-Family', 'Condo / Townhouse', 'Land', 'Mobile Home', 'Commercial'];

const REHAB_OPTIONS = [
  { value: '', label: 'No preference' },
  { value: 'any', label: 'Any — no preference' },
  { value: 'light', label: 'Light rehab or better (Turnkey, Light rehab)' },
  { value: 'moderate', label: 'Moderate rehab or better (+ Moderate rehab)' },
  { value: 'heavy', label: 'Heavy rehab — any condition' },
];

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
  // Slice 132 — publish toggle (saved with the buy box), plus the
  // matching fields from follow-ups (1) and (D). All empty by
  // default; savedPublished is what the last SAVE stored, so the
  // note under the form never claims a publish that has not
  // actually been saved yet.
  const [published, setPublished] = useState(false);
  const [savedPublished, setSavedPublished] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [zipCodes, setZipCodes] = useState('');
  const [rehab, setRehab] = useState('');
  const [states, setStates] = useState<string[]>([]);
  // Slice 133 criteria — all empty by default; empty = no
  // constraint. (Field names only — no buyer data from anywhere.)
  const [maxArvPct, setMaxArvPct] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [condPrefs, setCondPrefs] = useState<string[]>([]);
  const [stratPrefs, setStratPrefs] = useState<string[]>([]);
  const [closingTimeline, setClosingTimeline] = useState('');
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
          setPublished(box.published === true);
          setSavedPublished(box.published === true);
          setEmailAlerts(box.email_alerts_opt_in === true);
          setZipCodes((box.zip_codes || []).join(', '));
          setRehab(box.rehab_tolerance || '');
          setStates(box.states || []);
          setMaxArvPct(box.max_arv_pct != null ? String(box.max_arv_pct) : '');
          setMinProfit(box.min_profit != null ? String(box.min_profit) : '');
          setCondPrefs(box.condition_preferences || []);
          setStratPrefs(box.strategy_preferences || []);
          setClosingTimeline(box.closing_timeline || '');
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
        published,
        email_alerts_opt_in: emailAlerts,
        zip_codes: zipCodes.split(',').map((z) => z.trim()).filter(Boolean),
        rehab_tolerance: rehab || null,
        states,
        max_arv_pct: numOrNull(maxArvPct),
        min_profit: numOrNull(minProfit),
        condition_preferences: condPrefs,
        strategy_preferences: stratPrefs,
        closing_timeline: closingTimeline || null,
      });
      setHasSaved(true);
      setSavedPublished(published);
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
    lines.push(`States: ${states.length > 0 ? states.join(', ') : 'not set'}`);
    lines.push(`ZIP codes: ${zipCodes.trim() || 'not set'}`);
    lines.push(`Property types: ${propTypes.length > 0 ? propTypes.join(', ') : 'not set'}`);
    lines.push(`Min price: ${money(numOrNull(minPrice))}`);
    lines.push(`Max price: ${money(numOrNull(maxPrice))}`);
    lines.push(`Max ARV %: ${maxArvPct.trim() ? `${maxArvPct.trim()}%` : 'not set'}`);
    lines.push(`Min profit: ${money(numOrNull(minProfit))}`);
    lines.push(`Condition preferences: ${condPrefs.length > 0 ? condPrefs.join(', ') : 'not set'}`);
    lines.push(`Strategy preferences: ${stratPrefs.length > 0 ? stratPrefs.join(', ') : 'not set'}`);
    lines.push(`Closing timeline: ${closingTimeline || 'not set'}`);
    lines.push(`Rehab tolerance: ${rehab || 'no preference'}`);
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
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 8px' }}>
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
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 12px' }}>
        Institutional buyers (hedge funds) don&apos;t take deal blasts — they buy through their own
        acquisition teams, not from a shared list.
      </p>
      {/* Slice 133 — one-click buyer invite link (buyers register
          themselves; the link is the one click). */}
      <BuyerInviteLink userId={userId} />

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>My buy box — what we buy</h4>
        {loading ? (
          <p style={{ fontSize: 13, color: '#cbd5e1' }}>Loading your buy box…</p>
        ) : (
          <>
            {!hasSaved && !loadError && (
              <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 10px' }}>
                No buy box saved yet. Fill in what you buy — it stays empty until you save it.
              </p>
            )}
            {loadError && (
              <p style={{ fontSize: 13, color: '#fca5a5', margin: '0 0 10px' }}>{loadError}</p>
            )}
            {/* Slice 133 — state-linked markets: the Market list
                follows the picked State(s) (Census county data,
                lib/us-counties.ts). No longer Florida-only. */}
            <StateCountyFilter
              states={states}
              onStatesChange={setStates}
              markets={markets}
              onMarketsChange={setMarkets}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />
            <p style={{ fontSize: 12, color: '#cbd5e1', margin: '0 0 10px' }}>
              Florida is the only state with live parcel data today — other states join only after
              their real service is verified.
            </p>
            <label style={labelStyle}>Target ZIP codes<input style={inputStyle} value={zipCodes} onChange={(e) => setZipCodes(e.target.value)} placeholder="e.g. 34950, 33313 (comma-separated, optional)" inputMode="numeric" />
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>Empty means no ZIP constraint.</span>
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
            {/* Slice 133 criteria — field names only, all empty by
                default. Empty = no constraint in matching. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={labelStyle}>Max ARV %<input style={inputStyle} value={maxArvPct} onChange={(e) => setMaxArvPct(e.target.value)} placeholder="e.g. 70 (optional)" inputMode="decimal" />
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>The most you will pay, as a % of ARV. Empty means no cap.</span>
              </label>
              <label style={labelStyle}>Min profit $<input style={inputStyle} value={minProfit} onChange={(e) => setMinProfit(e.target.value)} placeholder="e.g. 20000 (optional)" inputMode="decimal" />
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>The least profit you need (ARV − price − repairs). Empty means no minimum.</span>
              </label>
            </div>
            <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 6, margin: '0 0 10px', padding: '8px 10px' }}>
              <legend style={{ fontSize: 13 }}>Condition preferences</legend>
              {CONDITION_OPTIONS.map((t) => (
                <label key={t} style={{ display: 'inline-block', fontSize: 13, marginRight: 12 }}>
                  <input type="checkbox" checked={condPrefs.includes(t)} onChange={(e) => setCondPrefs(e.target.checked ? [...condPrefs, t] : condPrefs.filter((x) => x !== t))} /> {t}
                </label>
              ))}
              <div style={{ fontSize: 12, color: '#cbd5e1' }}>Empty means any condition.</div>
            </fieldset>
            <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 6, margin: '0 0 10px', padding: '8px 10px' }}>
              <legend style={{ fontSize: 13 }}>Strategy preferences</legend>
              {STRATEGY_OPTIONS.map((t) => (
                <label key={t} style={{ display: 'inline-block', fontSize: 13, marginRight: 12 }}>
                  <input type="checkbox" checked={stratPrefs.includes(t)} onChange={(e) => setStratPrefs(e.target.checked ? [...stratPrefs, t] : stratPrefs.filter((x) => x !== t))} /> {t}
                </label>
              ))}
              <div style={{ fontSize: 12, color: '#cbd5e1' }}>Empty means any strategy.</div>
            </fieldset>
            <label style={labelStyle}>Closing timeline
              <select style={inputStyle} value={closingTimeline} onChange={(e) => setClosingTimeline(e.target.value)}>
                <option value="">No preference</option>
                {CLOSING_TIMELINE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>How fast you can close. Empty means no preference.</span>
            </label>
            <label style={labelStyle}>Notes<textarea style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else about what you buy…" rows={2} /></label>
            <label style={labelStyle}>Rehab tolerance
              <select style={inputStyle} value={rehab} onChange={(e) => setRehab(e.target.value)}>
                {REHAB_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>Empty means no preference — any condition matches.</span>
            </label>
            <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Publish my buy box
            </label>
            <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                Email me when a published deal matches my buy box
                <br />
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                  Email alerts only happen if the founder ever connects an email provider — nothing
                  is sent today, and matching deals are shown in the app.
                </span>
              </span>
            </label>
            {hasSaved && (
              <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 10px' }}>
                {savedPublished
                  ? 'Your buy box is published — it now appears in the public Cash Buyers directory with no contact details.'
                  : 'Your buy box is private — it does not appear in the public Cash Buyers directory.'}
              </p>
            )}
            {/* Slice 133 — the owner's own proof-of-funds status.
                Renders "POF verified — <date>" only when the
                operator has actually verified a document; renders
                nothing otherwise. */}
            <BuyerPofStatus userId={userId} />
            {banner && <div style={{ background: '#fef3c7', color: '#0f172a', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>{banner}</div>}
            {copied && <div style={{ background: '#ecfdf5', color: '#0f172a', border: '1px solid #10b981', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>Buy box copied to clipboard.</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save my buy box'}
              </button>
              <button type="button" onClick={copyBuyBox} disabled={!hasSaved} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                Copy my buy box
              </button>
            </div>
            {!hasSaved && (
              <p style={{ fontSize: 12, color: '#cbd5e1', margin: '8px 0 0' }}>
                Copy is available once you save a buy box — paste it into OpenBuyersList when you post there.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
