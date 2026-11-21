// Slice 128 — CashBuyersDealBlast: cash buyers CRM + deal blast.
//
// The repo had NO cash buyers table or CRM before this slice —
// this is new. Buyers live in public.cash_buyers (migration
// 20261115160000, owner RLS + operator read, UNIQUE(user_id,
// email)). The blast is built from numbers the wholesaler enters
// (or carries in from a real locked-up lead/contract via
// dealPrefill) — never invented.
//
// Rules:
//   * Wholesaler name/company/phone/email come from the SIGNED-IN
//     wholesaler's own storefront profile (loadMyStorefront) —
//     never hardcoded defaults. No profile means blank signature
//     fields + a note.
//   * NO plausible fake placeholders: "Marcus Vance" / "Treasure
//     Coast Holdings LLC" would read as real people. Placeholders
//     are generic ("Buyer full name", "buyer@email.com").
//   * MONEY / SPECS FIELDS ARE EMPTY BY DEFAULT — no invented
//     wholesale price, ARV, repairs, specs, max budget, or target
//     counties. The blast only includes numbers the wholesaler
//     typed (or that arrived in dealPrefill from a real deal).
//   * The EMD line is an editable field, empty by default — never
//     a baked-in "$5,000 non-refundable EMD".
//   * pof_verified is the WHOLESALER's own attestation — the
//     checkbox reads "I verified proof of funds", never platform
//     verification.
//   * County filters are STATE-LINKED (Slice 133): pick a state
//     and the county list follows it (real Census county data,
//     lib/us-counties.ts) — no longer Florida-only. The deal
//     county and each buyer's target counties both follow their
//     state picker; "All markets" stays the default when nothing
//     is picked. The add-buyer states picker only narrows the
//     county list — the counties picked are what is saved.
//   * The BCC mailto is a CONVENIENCE ONLY. The app never
//     auto-sends email (no email service is wired). Copy to
//     clipboard is the primary action; the mailto opens the user's
//     own mail client, and the UI says large lists may exceed
//     mailto limits.
//   * "Potential Gross Spread" is computed from the entered
//     numbers only (ARV − price − repairs) and reads as an
//     estimate from the wholesaler's own figures — never a
//     guaranteed return.

import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { loadMyStorefront, type StorefrontProfile } from '../lib/storefront';
import { invokeSendBuyerBlast } from '../lib/sms';
import StateCountyFilter from './StateCountyFilter';
import BuyerInviteLink from './BuyerInviteLink';
import BuyerNetworks from './BuyerNetworks';

export interface DealBlastPrefill {
  propertyAddress?: string;
  county?: string;
  wholesalePrice?: number | null;
  arv?: number | null;
  repairs?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  emdAmount?: number | null;
}

interface CashBuyer {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  target_counties: string[];
  max_budget: number | null;
  min_beds: number | null;
  property_types: string[];
  pof_verified: boolean;
  notes: string;
  // Slice 134 — STOP sets this (migration in parallel). A buyer
  // with sms_opt_out = true never receives an SMS broadcast; the
  // dispatcher re-checks it at send time too.
  sms_opt_out?: boolean;
}

const PROPERTY_TYPES = ['Single Family', 'Multi-Family', 'Condo / Townhouse', 'Land', 'Mobile Home', 'Commercial'];

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

export default function CashBuyersDealBlast({ userId, dealPrefill }: { userId: string; dealPrefill?: DealBlastPrefill | null }) {
  const [buyers, setBuyers] = useState<CashBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [banner, setBanner] = useState('');
  const [profile, setProfile] = useState<StorefrontProfile | null>(null);

  // Add-buyer form — generic placeholders only, never plausible
  // fake people or companies.
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [counties, setCounties] = useState<string[]>([]);
  // Slice 133 — states picker that narrows the target-counties
  // list only; it is NOT saved (the counties picked are saved).
  const [targetStates, setTargetStates] = useState<string[]>([]);
  const [maxBudget, setMaxBudget] = useState('');
  const [minBeds, setMinBeds] = useState('');
  const [propTypes, setPropTypes] = useState<string[]>([]);
  const [pof, setPof] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Deal blast fields — empty by default, always.
  const [dealAddress, setDealAddress] = useState('');
  const [dealCounty, setDealCounty] = useState('');
  // Slice 133 — the deal state drives the deal-county list.
  const [dealState, setDealState] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [arv, setArv] = useState('');
  const [repairs, setRepairs] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sqft, setSqft] = useState('');
  const [emd, setEmd] = useState('');
  const [copied, setCopied] = useState(false);

  // Slice 134 — "Broadcast to My BYOK Buyers" (SMS). Explicit click
  // only; the dispatcher re-checks opt-out at send time and logs
  // the send server-side. Nothing is reported sent unless the
  // dispatcher says so — a not-deployed function or unconnected
  // provider is reported honestly, never as a success.
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState('');

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      if (!supabaseConfigured || !supabase) {
        setLoadError('Supabase is not configured on this deployment — cash buyers cannot load.');
        setBuyers([]);
        return;
      }
      const { data, error } = await supabase
        .from('cash_buyers')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message || 'Could not load cash buyers.');
      setBuyers((data || []) as CashBuyer[]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load cash buyers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadMyStorefront(userId).then(setProfile).catch(() => setProfile(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // A prefill from a real locked-up lead/contract fills the blast
  // with that deal's real numbers — otherwise everything stays
  // empty until the wholesaler types real numbers.
  useEffect(() => {
    if (!dealPrefill) return;
    if (dealPrefill.propertyAddress) setDealAddress(dealPrefill.propertyAddress);
    if (dealPrefill.county) setDealCounty(dealPrefill.county);
    if (dealPrefill.wholesalePrice != null) setWholesalePrice(String(dealPrefill.wholesalePrice));
    if (dealPrefill.arv != null) setArv(String(dealPrefill.arv));
    if (dealPrefill.repairs != null) setRepairs(String(dealPrefill.repairs));
    if (dealPrefill.beds != null) setBeds(String(dealPrefill.beds));
    if (dealPrefill.baths != null) setBaths(String(dealPrefill.baths));
    if (dealPrefill.sqft != null) setSqft(String(dealPrefill.sqft));
    if (dealPrefill.emdAmount != null) setEmd(String(dealPrefill.emdAmount));
  }, [dealPrefill]);

  const you = profile?.display_name?.trim() || '';
  const biz = profile?.company_name?.trim() || '';
  const profilePhone = profile?.public_phone?.trim() || '';
  const profileEmail = profile?.public_email?.trim() || '';

  async function addBuyer() {
    if (!name.trim() || !email.trim()) {
      setBanner('Enter the buyer name and email — both are required.');
      return;
    }
    if (!supabaseConfigured || !supabase) {
      setBanner('Supabase is not configured on this deployment.');
      return;
    }
    setSaving(true);
    setBanner('');
    try {
      const { data, error } = await supabase
        .from('cash_buyers')
        .insert({
          user_id: userId,
          name: name.trim(),
          company: company.trim() || null,
          email: email.trim(),
          phone: phone.trim() || null,
          target_counties: counties,
          max_budget: numOrNull(maxBudget),
          min_beds: numOrNull(minBeds),
          property_types: propTypes,
          pof_verified: pof,
          notes: notes.trim(),
        })
        .select('id');
      if (error) throw new Error(error.message || 'Could not save this buyer.');
      if (!data || data.length === 0) throw new Error('The buyer was not saved — nothing was written.');
      setName(''); setCompany(''); setEmail(''); setPhone(''); setCounties([]); setTargetStates([]);
      setMaxBudget(''); setMinBeds(''); setPropTypes([]); setPof(false); setNotes('');
      setBanner('Buyer added.');
      await load();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not save this buyer.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBuyer(id: string, label: string) {
    if (!supabaseConfigured || !supabase) return;
    const { error } = await supabase.from('cash_buyers').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      setBanner(`Could not delete ${label}: ${error.message}`);
      return;
    }
    setBuyers((prev) => prev.filter((b) => b.id !== id));
  }

  // Buyers matched to this deal: the deal county is in their target
  // counties (or they named none), and the price fits their stated
  // max budget when both are known.
  const matched = useMemo(() => {
    const price = numOrNull(wholesalePrice);
    return buyers.filter((b) => {
      if (dealCounty && b.target_counties.length > 0 && !b.target_counties.includes(dealCounty)) return false;
      if (price != null && b.max_budget != null && price > b.max_budget) return false;
      return true;
    });
  }, [buyers, dealCounty, wholesalePrice]);

  const spread = useMemo(() => {
    const a = numOrNull(arv);
    const p = numOrNull(wholesalePrice);
    const r = numOrNull(repairs);
    if (a == null || p == null || r == null) return null;
    return a - p - r;
  }, [arv, wholesalePrice, repairs]);

  const specs = [beds ? `${beds} Bed` : '', baths ? `${baths} Bath` : '', sqft ? `${sqft} SqFt` : ''].filter(Boolean).join(' • ');
  const sigName = you || '[your name]';
  const sigBiz = biz || '[your company]';

  const blastText = useMemo(() => {
    const lines: string[] = [];
    lines.push('New wholesale deal under contract — first come, first served.');
    lines.push('');
    if (dealAddress) lines.push(`Property: ${dealAddress}`);
    if (dealCounty) lines.push(`County: ${dealCounty}`);
    if (dealState) lines.push(`State: ${dealState}`);
    if (specs) lines.push(`Details: ${specs}`);
    lines.push('');
    lines.push('Pricing:');
    if (numOrNull(wholesalePrice) != null) lines.push(`- Wholesale price: $${Number(numOrNull(wholesalePrice)).toLocaleString()}`);
    if (numOrNull(arv) != null) lines.push(`- ARV: $${Number(numOrNull(arv)).toLocaleString()}`);
    if (numOrNull(repairs) != null) lines.push(`- Estimated repairs: $${Number(numOrNull(repairs)).toLocaleString()}`);
    if (spread != null) lines.push(`- Estimated gross spread (ARV − price − repairs, from my own figures — an estimate, never a guaranteed return): $${spread.toLocaleString()}`);
    if (numOrNull(emd) != null) lines.push(`- Earnest money deposit: $${Number(numOrNull(emd)).toLocaleString()} (terms as agreed with the title company)`);
    lines.push('');
    lines.push('To lock it up: reply here or call me. Assignment requires earnest money held with the title company — the amount and timing are agreed per deal, never assumed.');
    lines.push('');
    lines.push(`- ${sigName}, ${sigBiz}${profilePhone ? ` — ${profilePhone}` : ''}${profileEmail ? ` — ${profileEmail}` : ''}`);
    return lines.join('\n');
  }, [dealAddress, dealCounty, specs, wholesalePrice, arv, repairs, spread, emd, sigName, sigBiz, profilePhone, profileEmail]);

  function copyBlast() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(blastText).then(
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

  const bccList = matched.map((b) => b.email).join(',');
  const mailtoHref = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(
    dealAddress ? `New wholesale deal — ${dealAddress}` : 'New wholesale deal',
  )}&body=${encodeURIComponent(blastText)}`;

  // Slice 134 — broadcast audience: the deal's matched buyers with
  // a phone on file, minus anyone opted out. The dispatcher gets
  // the eligible list AND the audience marker, and re-checks
  // opt-out at send time before any message goes out.
  const broadcastWithPhone = matched.filter((b) => (b.phone || '').trim() !== '');
  const broadcastOptedOut = broadcastWithPhone.filter((b) => b.sms_opt_out === true);
  const broadcastEligible = broadcastWithPhone.filter((b) => b.sms_opt_out !== true);

  async function sendBroadcast() {
    if (broadcastSending) return;
    if (broadcastEligible.length === 0) {
      setBroadcastResult('No buyers to text — no matched buyer has a phone on file and has not opted out. Nothing was sent.');
      return;
    }
    setBroadcastSending(true);
    setBroadcastResult('');
    try {
      const res = await invokeSendBuyerBlast({
        channel: 'sms',
        body: blastText,
        audience: 'my-buyers',
        to_numbers: broadcastEligible.map((b) => (b.phone || '').trim()),
      });
      if (res.ok) {
        if (res.sent !== undefined || res.skipped !== undefined || res.failed !== undefined) {
          setBroadcastResult(
            `Broadcast sent — sent ${res.sent ?? 0}, skipped ${res.skipped ?? 0}, failed ${res.failed ?? 0}.`,
          );
        } else {
          setBroadcastResult(
            'The dispatcher accepted the broadcast. No per-recipient counts were returned, so none are shown.',
          );
        }
      } else {
        setBroadcastResult(res.error || 'Not sent.');
      }
    } catch {
      setBroadcastResult('Not sent: the request did not complete.');
    } finally {
      setBroadcastSending(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontSize: 13 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 10 };

  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>💵 Cash Buyers — CRM &amp; Deal Blast</h2>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 16px' }}>
        Your cash buyers, and a deal blast built only from numbers you entered (or carried in from a
        real locked-up deal). The app never sends email itself — copy the blast, or open your own mail
        client with BCC. Large lists may exceed mailto limits — send big blasts from your email directly.
      </p>
      {!profile && (
        <p style={{ fontSize: 13, color: '#fcd34d', margin: '0 0 12px' }}>
          Fill in Storefront Settings to add your name, company, and number to the blast signature —
          this leaves them blank rather than using anyone else&apos;s details.
        </p>
      )}
      {banner && <div style={{ background: '#fef3c7', color: '#0f172a', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>{banner}</div>}
      {copied && <div style={{ background: '#ecfdf5', color: '#0f172a', border: '1px solid #10b981', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>Blast copied to clipboard.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Add a cash buyer</h3>
          <label style={labelStyle}>Buyer full name *<input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Buyer full name" /></label>
          <label style={labelStyle}>Buying entity / LLC<input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Buying entity / LLC" /></label>
          <label style={labelStyle}>Email *<input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@email.com" /></label>
          <label style={labelStyle}>Phone<input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" /></label>
          {/* Slice 133 — state-linked target counties: the county
              list follows the picked state(s). The states picker
              only narrows this list; the counties are what is saved. */}
          <StateCountyFilter
            states={targetStates}
            onStatesChange={setTargetStates}
            markets={counties}
            onMarketsChange={setCounties}
            marketLabel="Target counties"
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />
          <label style={labelStyle}>Max budget<input style={inputStyle} value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} placeholder="Max budget (optional)" inputMode="decimal" /></label>
          <label style={labelStyle}>Min beds<input style={inputStyle} value={minBeds} onChange={(e) => setMinBeds(e.target.value)} placeholder="Min beds (optional)" inputMode="numeric" /></label>
          <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 6, margin: '0 0 10px', padding: '8px 10px' }}>
            <legend style={{ fontSize: 13 }}>Property types</legend>
            {PROPERTY_TYPES.map((t) => (
              <label key={t} style={{ display: 'inline-block', fontSize: 13, marginRight: 12 }}>
                <input type="checkbox" checked={propTypes.includes(t)} onChange={(e) => setPropTypes(e.target.checked ? [...propTypes, t] : propTypes.filter((x) => x !== t))} /> {t}
              </label>
            ))}
          </fieldset>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={pof} onChange={(e) => setPof(e.target.checked)} />
            I verified proof of funds (my own attestation — not platform verification)
          </label>
          <label style={labelStyle}>Notes<textarea style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes about this buyer…" rows={2} /></label>
          <button type="button" onClick={addBuyer} disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Add buyer'}
          </button>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Deal blast — numbers you enter only</h3>
          <label style={labelStyle}>Property address<input style={inputStyle} value={dealAddress} onChange={(e) => setDealAddress(e.target.value)} placeholder="Deal property address" /></label>
          {/* Slice 133 — state-linked deal county: pick the deal
              state and the county list follows it. A prefilled
              county from a real deal stays visible even before a
              state is picked. */}
          <StateCountyFilter
            single
            states={dealState ? [dealState] : []}
            onStatesChange={(s) => setDealState(s[0] || '')}
            markets={dealCounty ? [dealCounty] : []}
            onMarketsChange={(m) => setDealCounty(m[0] || '')}
            marketLabel="County"
            stateLabel="Deal state"
            marketEmptyLabel="No county filter"
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>Wholesale price<input style={inputStyle} value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} placeholder="Wholesale price" inputMode="decimal" /></label>
            <label style={labelStyle}>ARV<input style={inputStyle} value={arv} onChange={(e) => setArv(e.target.value)} placeholder="ARV from comps" inputMode="decimal" /></label>
            <label style={labelStyle}>Estimated repairs<input style={inputStyle} value={repairs} onChange={(e) => setRepairs(e.target.value)} placeholder="Estimated repairs" inputMode="decimal" /></label>
            <label style={labelStyle}>Earnest money deposit<input style={inputStyle} value={emd} onChange={(e) => setEmd(e.target.value)} placeholder="Agreed EMD amount" inputMode="decimal" /></label>
            <label style={labelStyle}>Beds<input style={inputStyle} value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="Beds" inputMode="numeric" /></label>
            <label style={labelStyle}>Baths<input style={inputStyle} value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="Baths" inputMode="numeric" /></label>
            <label style={labelStyle}>Sq ft<input style={inputStyle} value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="Square feet" inputMode="numeric" /></label>
          </div>
          {spread != null && (
            <p style={{ fontSize: 13, color: '#cbd5e1' }}>
              Potential Gross Spread: ${spread.toLocaleString()} — estimated from your own figures
              (ARV − price − repairs). An estimate, never a guaranteed return.
            </p>
          )}
          <p style={{ fontSize: 13 }}>
            Matched buyers for this deal: <strong>{matched.length}</strong> of {buyers.length}
            {dealCounty ? ` (county: ${dealCounty})` : ' (pick a county to narrow the match)'}.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12 }}>{blastText}</pre>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={copyBlast} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>
              Copy blast (primary)
            </button>
            {matched.length > 0 ? (
              <a href={mailtoHref} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', textDecoration: 'none', fontSize: 13 }}>
                Open in my email (BCC {matched.length})
              </a>
            ) : (
              <span style={{ fontSize: 13, color: '#cbd5e1', alignSelf: 'center' }}>No matched buyers yet — add buyers or widen the deal county.</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#cbd5e1' }}>
            The mailto link is a convenience only — the app never sends email itself. Large lists may
            exceed mailto limits; send big blasts from your email directly.
          </p>
          {/* Slice 134 — Broadcast to My BYOK Buyers (SMS). Sends
              the blast above, by text, only to this wholesaler's
              own matched buyers with a phone who have not opted
              out — on explicit click, through the dispatcher. */}
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 12, paddingTop: 12 }}>
            <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Broadcast to My BYOK Buyers — SMS</h4>
            <p style={{ fontSize: 13, margin: '0 0 8px' }}>
              {broadcastWithPhone.length} matched buyers with a phone, {broadcastOptedOut.length} opted out —{' '}
              {broadcastEligible.length} will receive it
            </p>
            <p style={{ fontSize: 12, color: '#cbd5e1', margin: '0 0 8px' }}>
              Sends the blast above by text from your own SMS provider, only on your click. Opted-out
              buyers are excluded here and re-checked by the dispatcher at send time.
            </p>
            <button
              type="button"
              onClick={sendBroadcast}
              disabled={broadcastSending || broadcastEligible.length === 0}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}
            >
              {broadcastSending ? 'Sending…' : 'Broadcast to My BYOK Buyers'}
            </button>
            {broadcastEligible.length === 0 && (
              <p style={{ fontSize: 13, color: '#cbd5e1', margin: '8px 0 0' }}>
                No matched buyer has a phone on file and has not opted out.
              </p>
            )}
            {broadcastResult && <p style={{ fontSize: 13, margin: '8px 0 0' }}>{broadcastResult}</p>}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: '16px 0 8px' }}>Your cash buyers ({buyers.length})</h3>
      {loading ? (
        <p style={{ fontSize: 14, color: '#cbd5e1' }}>Loading cash buyers…</p>
      ) : loadError ? (
        <p style={{ fontSize: 14, color: '#fca5a5' }}>{loadError}</p>
      ) : buyers.length === 0 ? (
        <p style={{ fontSize: 14, color: '#cbd5e1' }}>No cash buyers yet — add your first buyer above. No buyers are seeded.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {buyers.map((b) => (
            <li key={b.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13 }}>
              <strong>{b.name}</strong>{b.company ? ` — ${b.company}` : ''} · {b.email}
              {b.phone ? ` · ${b.phone}` : ''}
              {b.target_counties.length > 0 ? ` · Counties: ${b.target_counties.join(', ')}` : ''}
              {b.max_budget != null ? ` · Max $${Number(b.max_budget).toLocaleString()}` : ''}
              {b.min_beds != null ? ` · Min ${b.min_beds} beds` : ''}
              {b.property_types.length > 0 ? ` · ${b.property_types.join(', ')}` : ''}
              {b.pof_verified ? ' · ✓ POF verified by me' : ' · POF not verified'}
              {b.notes ? <div style={{ color: '#cbd5e1', marginTop: 2 }}>{b.notes}</div> : ''}
              <button type="button" onClick={() => deleteBuyer(b.id, b.name)} style={{ marginTop: 6, fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Slice 133 — one-click buyer invite link (the
          wholesaler's own link; buyers register themselves). */}
      <BuyerInviteLink userId={userId} publicSlug={profile?.public_slug ?? null} />
      {/* Slice 131 — Buyer Networks (OpenBuyersList links + my buy box). */}
      <BuyerNetworks userId={userId} />
    </div>
  );
}
