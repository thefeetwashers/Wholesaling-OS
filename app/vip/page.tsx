// Slice 132 — Cash Buyer VIP Portal (/vip). The buyer join flow's
// full form — NOT a second buyer form: the /join Buyer card routes
// to signup first (an account is needed; a public form with no
// account would create orphan rows), and after signup the buyer
// completes THIS form as their onboarding step.
//
// Why this route, not the buyer dashboard: the signup flow has no
// redirect hook (AuthPanel sign-up only shows "Check your email to
// confirm", and sign-in lands on the dashboard), and the buyer
// dashboard view lives in components/PortalHome.tsx, which this
// slice does not own. So the form lives here at /vip, and the
// /join Buyer card says so plainly. The coordinator can wire this
// same form into the buyer dashboard with one line (render the
// form from here inside BuyerPortal) if that is wanted later.
//
// The form has two parts, both saved to the buyer's OWN account:
//   1. Contact info (lib/buyer-profile.ts, public.profiles — the
//      EXISTING profiles table; contact_email is profiles.email,
//      contact_name / contact_phone / contact_private arrive by
//      ALTER TABLE in migration 20261117133000, never a new table)
//      — name, email, phone, PRIVATE BY DEFAULT. Never shown on
//      the /buyers directory, never publicly readable; revealed
//      only when the buyer AND a wholesaler both share on the same
//      deal response (mutual opt-in — see lib/buyer-profile.ts).
//   2. Buy box (lib/buy-box.ts, public.wholesaler_buy_boxes) —
//      the SAME table and publish toggle as the wholesaler buy
//      box, not a duplicate. A buyer is an account with a buy box,
//      same as a wholesaler. The publish checkbox here is the same
//      field BuyerNetworks saves.
// All fields empty by default; money fields never pre-filled.
// Matching published deals below are computed ON READ with
// lib/match-buy-box.ts — in the app only, never emailed or texted.

'use client';

import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { loadMyBuyerProfile, saveMyBuyerProfile } from '../../lib/buyer-profile';
import { loadMyBuyBox, saveMyBuyBox, CONDITION_OPTIONS, STRATEGY_OPTIONS, CLOSING_TIMELINE_OPTIONS } from '../../lib/buy-box';
import { findMatchingDeals, type DealSummary, type BuyBoxForMatching } from '../../lib/match-buy-box';
import StateCountyFilter from '../../components/StateCountyFilter';
import ProofOfFundsUpload from '../../components/ProofOfFundsUpload';

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

export default function VipPortal() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPrivate, setContactPrivate] = useState(true);
  const [markets, setMarkets] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [zipCodes, setZipCodes] = useState('');
  const [propTypes, setPropTypes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [rehab, setRehab] = useState('');
  // Slice 133 criteria — all empty by default; empty = no
  // constraint. Same fields as the buy-box form, same table.
  const [maxArvPct, setMaxArvPct] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [condPrefs, setCondPrefs] = useState<string[]>([]);
  const [stratPrefs, setStratPrefs] = useState<string[]>([]);
  const [closingTimeline, setClosingTimeline] = useState('');
  const [notes, setNotes] = useState('');
  const [published, setPublished] = useState(false);
  const [savedPublished, setSavedPublished] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<DealSummary[] | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) { setAuthChecked(true); setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id || null;
      setUserId(id);
      setAuthChecked(true);
      if (!id) { setLoading(false); return; }
      Promise.all([loadMyBuyerProfile(id), loadMyBuyBox(id)])
        .then(([profile, box]) => {
          if (profile) {
            setContactName(profile.contact_name || '');
            setContactEmail(profile.contact_email || '');
            setContactPhone(profile.contact_phone || '');
            setContactPrivate(profile.contact_private !== false);
          }
          if (box) {
            setMarkets(box.markets || []);
            setStates(box.states || []);
            setZipCodes((box.zip_codes || []).join(', '));
            setPropTypes(box.property_types || []);
            setMinPrice(box.min_price != null ? String(box.min_price) : '');
            setMaxPrice(box.max_price != null ? String(box.max_price) : '');
            setRehab(box.rehab_tolerance || '');
            setNotes(box.notes || '');
            setPublished(box.published === true);
            setSavedPublished(box.published === true);
            setEmailAlerts(box.email_alerts_opt_in === true);
            setMaxArvPct(box.max_arv_pct != null ? String(box.max_arv_pct) : '');
            setMinProfit(box.min_profit != null ? String(box.min_profit) : '');
            setCondPrefs(box.condition_preferences || []);
            setStratPrefs(box.strategy_preferences || []);
            setClosingTimeline(box.closing_timeline || '');
            setHasSaved(true);
            const forMatching: BuyBoxForMatching = {
              user_id: id,
              markets: box.markets || [],
              zip_codes: box.zip_codes || [],
              property_types: box.property_types || [],
              min_price: box.min_price ?? null,
              max_price: box.max_price ?? null,
              rehab_tolerance: box.rehab_tolerance || null,
              states: box.states || [],
              max_arv_pct: box.max_arv_pct ?? null,
              min_profit: box.min_profit ?? null,
              condition_preferences: box.condition_preferences || [],
              strategy_preferences: box.strategy_preferences || [],
              closing_timeline: box.closing_timeline || null,
            };
            findMatchingDeals(forMatching).then(setMatches).catch(() => setMatches([]));
          } else {
            setMatches([]);
          }
        })
        .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load your profile.'))
        .finally(() => setLoading(false));
    }).catch(() => { setAuthChecked(true); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!userId) return;
    setSaving(true);
    setBanner('');
    try {
      await saveMyBuyerProfile(userId, {
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        contact_private: contactPrivate,
      });
      const box = await saveMyBuyBox(userId, {
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
      setSavedPublished(box.published === true);
      setBanner('VIP profile saved.');
      const forMatching: BuyBoxForMatching = {
        user_id: userId,
        markets: box.markets || [],
        zip_codes: box.zip_codes || [],
        property_types: box.property_types || [],
        min_price: box.min_price ?? null,
        max_price: box.max_price ?? null,
        rehab_tolerance: box.rehab_tolerance || null,
        states: box.states || [],
        max_arv_pct: box.max_arv_pct ?? null,
        min_profit: box.min_profit ?? null,
        condition_preferences: box.condition_preferences || [],
        strategy_preferences: box.strategy_preferences || [],
        closing_timeline: box.closing_timeline || null,
      };
      findMatchingDeals(forMatching).then(setMatches).catch(() => setMatches([]));
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontSize: 13 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 10 };

  if (authChecked && !userId) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <section style={{ background: '#1e293b', padding: 22, borderRadius: 12, marginTop: 16 }}>
          <h1 style={{ marginTop: 0 }}>Cash Buyer VIP Portal</h1>
          <p style={{ fontSize: 14.5 }}>
            This portal is for signed-in buyers. <a href="/#signin" style={{ color: '#7dd3fc' }}>Sign in</a> or{' '}
            <a href="/join" style={{ color: '#7dd3fc' }}>join as a buyer</a> first — an account is
            needed so your contact and buy box belong to you and no one else.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <p className="ws-buildtag">WholesalingOS — Cash Buyer VIP Portal</p>
      <section style={{ background: '#1e293b', padding: 22, borderRadius: 12, marginTop: 16 }}>
        <h1 style={{ marginTop: 0 }}>Cash Buyer VIP Portal</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65 }}>
          Your contact info and your buy box, in one place. Your contact is private by default —
          it never appears in the public Cash Buyers directory, and it is shared with a wholesaler
          only when you AND that wholesaler both agree to share on the same deal. Your buy box is
          the same one wholesalers use: publish it and it appears in the directory with your
          criteria only — never your contact details.
        </p>
      </section>

      {loading ? (
        <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 16 }}>Loading your profile…</p>
      ) : (
        <section style={{ background: '#0f172a', padding: 16, borderRadius: 12, marginTop: 16 }}>
          {loadError && <p style={{ fontSize: 13, color: '#f87171' }}>{loadError}</p>}
          {!hasSaved && !loadError && (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>No VIP profile saved yet. Fill in what you buy — everything stays empty until you save it.</p>
          )}
          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>Your contact — private by default</h2>
          <label style={labelStyle}>Full name<input style={inputStyle} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your full name" /></label>
          <label style={labelStyle}>Email<input style={inputStyle} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@email.com" /></label>
          <label style={labelStyle}>Phone<input style={inputStyle} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone (optional)" /></label>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 14, alignItems: 'center' }}>
            <input type="checkbox" checked={contactPrivate} onChange={(e) => setContactPrivate(e.target.checked)} />
            Keep my contact private (share only when we both agree on a deal)
          </label>

          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>Your buy box — what you buy</h2>
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
            hintStyle={{ fontSize: 12, color: '#94a3b8' }}
          />
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>
            Florida is the only state with live parcel data today.
          </p>
          <label style={labelStyle}>Target ZIP codes<input style={inputStyle} value={zipCodes} onChange={(e) => setZipCodes(e.target.value)} placeholder="e.g. 34950, 33313 (comma-separated, optional)" inputMode="numeric" />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Empty means no ZIP constraint.</span>
          </label>
          <fieldset style={{ border: '1px solid #334155', borderRadius: 6, margin: '0 0 10px', padding: '8px 10px' }}>
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
          {/* Slice 133 criteria — same fields as the buy-box form. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>Max ARV %<input style={inputStyle} value={maxArvPct} onChange={(e) => setMaxArvPct(e.target.value)} placeholder="e.g. 70 (optional)" inputMode="decimal" />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>The most you will pay, as a % of ARV. Empty means no cap.</span>
            </label>
            <label style={labelStyle}>Min profit $<input style={inputStyle} value={minProfit} onChange={(e) => setMinProfit(e.target.value)} placeholder="e.g. 20000 (optional)" inputMode="decimal" />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>The least profit you need (ARV − price − repairs). Empty means no minimum.</span>
            </label>
          </div>
          <fieldset style={{ border: '1px solid #334155', borderRadius: 6, margin: '0 0 10px', padding: '8px 10px' }}>
            <legend style={{ fontSize: 13 }}>Condition preferences</legend>
            {CONDITION_OPTIONS.map((t) => (
              <label key={t} style={{ display: 'inline-block', fontSize: 13, marginRight: 12 }}>
                <input type="checkbox" checked={condPrefs.includes(t)} onChange={(e) => setCondPrefs(e.target.checked ? [...condPrefs, t] : condPrefs.filter((x) => x !== t))} /> {t}
              </label>
            ))}
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Empty means any condition.</div>
          </fieldset>
          <fieldset style={{ border: '1px solid #334155', borderRadius: 6, margin: '0 0 10px', padding: '8px 10px' }}>
            <legend style={{ fontSize: 13 }}>Strategy preferences</legend>
            {STRATEGY_OPTIONS.map((t) => (
              <label key={t} style={{ display: 'inline-block', fontSize: 13, marginRight: 12 }}>
                <input type="checkbox" checked={stratPrefs.includes(t)} onChange={(e) => setStratPrefs(e.target.checked ? [...stratPrefs, t] : stratPrefs.filter((x) => x !== t))} /> {t}
              </label>
            ))}
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Empty means any strategy.</div>
          </fieldset>
          <label style={labelStyle}>Closing timeline
            <select style={inputStyle} value={closingTimeline} onChange={(e) => setClosingTimeline(e.target.value)}>
              <option value="">No preference</option>
              {CLOSING_TIMELINE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>How fast you can close. Empty means no preference.</span>
          </label>
          <label style={labelStyle}>Rehab tolerance
            <select style={inputStyle} value={rehab} onChange={(e) => setRehab(e.target.value)}>
              {REHAB_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Empty means no preference — any condition matches.</span>
          </label>
          <label style={labelStyle}>Notes<textarea style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else about what you buy…" rows={2} /></label>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Publish my buy box
          </label>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              Email me when a published deal matches my buy box
              <br />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
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
          {banner && <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10, color: '#0f172a' }}>{banner}</div>}
          <button type="button" onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Save my VIP profile'}
          </button>

          {/* Slice 133 — proof of funds. The document is private;
              the operator verifies it; the public buy box then
              shows "POF verified" with the date. No bank account
              numbers are ever displayed. */}
          <h2 style={{ fontSize: 16, margin: '20px 0 8px' }}>Proof of funds — verify you can close</h2>
          {userId && <ProofOfFundsUpload userId={userId} />}

          <h2 style={{ fontSize: 16, margin: '20px 0 8px' }}>Published deals matching your buy box</h2>
          {matches === null ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading matches…</p>
          ) : matches.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>No published deals match your buy box yet. Matches are shown here in the app only — nothing is emailed or texted.</p>
          ) : (
            <ul style={{ fontSize: 13 }}>
              {matches.map((d) => (
                <li key={d.id} style={{ marginBottom: 6 }}>
                  {[d.city, d.state].filter(Boolean).join(', ') || 'Property'}
                  {d.zip ? ` ${d.zip}` : ''}
                  {d.property_type ? ` · ${d.property_type}` : ''}
                  {d.asking_price != null ? ` · $${Number(d.asking_price).toLocaleString()}` : ''}
                  {d.condition ? ` · ${d.condition}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
