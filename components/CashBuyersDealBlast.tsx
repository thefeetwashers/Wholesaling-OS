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
//   * County filter uses the full 67-county Florida list
//     (lib/vendor-marketplace.ts), matched against each buyer's
//     own target counties — not a 4-county list.
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
import { FLORIDA_COUNTIES } from '../lib/vendor-marketplace';

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
  const [maxBudget, setMaxBudget] = useState('');
  const [minBeds, setMinBeds] = useState('');
  const [propTypes, setPropTypes] = useState<string[]>([]);
  const [pof, setPof] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Deal blast fields — empty by default, always.
  const [dealAddress, setDealAddress] = useState('');
  const [dealCounty, setDealCounty] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [arv, setArv] = useState('');
  const [repairs, setRepairs] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sqft, setSqft] = useState('');
  const [emd, setEmd] = useState('');
  const [copied, setCopied] = useState(false);

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
      setName(''); setCompany(''); setEmail(''); setPhone(''); setCounties([]);
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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontSize: 13 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 10 };

  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>💵 Cash Buyers — CRM &amp; Deal Blast</h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
        Your cash buyers, and a deal blast built only from numbers you entered (or carried in from a
        real locked-up deal). The app never sends email itself — copy the blast, or open your own mail
        client with BCC. Large lists may exceed mailto limits — send big blasts from your email directly.
      </p>
      {!profile && (
        <p style={{ fontSize: 13, color: '#b45309', margin: '0 0 12px' }}>
          Fill in Storefront Settings to add your name, company, and number to the blast signature —
          this leaves them blank rather than using anyone else&apos;s details.
        </p>
      )}
      {banner && <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>{banner}</div>}
      {copied && <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>Blast copied to clipboard.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Add a cash buyer</h3>
          <label style={labelStyle}>Buyer full name *<input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Buyer full name" /></label>
          <label style={labelStyle}>Buying entity / LLC<input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Buying entity / LLC" /></label>
          <label style={labelStyle}>Email *<input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@email.com" /></label>
          <label style={labelStyle}>Phone<input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" /></label>
          <label style={labelStyle}>Target counties
            <select multiple value={counties} onChange={(e) => setCounties(Array.from(e.target.selectedOptions, (o) => o.value))} style={{ ...inputStyle, height: 110 }}>
              {FLORIDA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#64748b' }}>Hold Ctrl/Cmd to pick several. Empty means any county.</span>
          </label>
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
          <label style={labelStyle}>County
            <select style={inputStyle} value={dealCounty} onChange={(e) => setDealCounty(e.target.value)}>
              <option value="">Select a county…</option>
              {FLORIDA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
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
            <p style={{ fontSize: 13, color: '#475569' }}>
              Potential Gross Spread: ${spread.toLocaleString()} — estimated from your own figures
              (ARV − price − repairs). An estimate, never a guaranteed return.
            </p>
          )}
          <p style={{ fontSize: 13 }}>
            Matched buyers for this deal: <strong>{matched.length}</strong> of {buyers.length}
            {dealCounty ? ` (county: ${dealCounty})` : ' (pick a county to narrow the match)'}.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12 }}>{blastText}</pre>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={copyBlast} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>
              Copy blast (primary)
            </button>
            {matched.length > 0 ? (
              <a href={mailtoHref} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', textDecoration: 'none', fontSize: 13 }}>
                Open in my email (BCC {matched.length})
              </a>
            ) : (
              <span style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>No matched buyers yet — add buyers or widen the deal county.</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            The mailto link is a convenience only — the app never sends email itself. Large lists may
            exceed mailto limits; send big blasts from your email directly.
          </p>
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: '16px 0 8px' }}>Your cash buyers ({buyers.length})</h3>
      {loading ? (
        <p style={{ fontSize: 14, color: '#64748b' }}>Loading cash buyers…</p>
      ) : loadError ? (
        <p style={{ fontSize: 14, color: '#b91c1c' }}>{loadError}</p>
      ) : buyers.length === 0 ? (
        <p style={{ fontSize: 14, color: '#64748b' }}>No cash buyers yet — add your first buyer above. No buyers are seeded.</p>
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
              {b.notes ? <div style={{ color: '#64748b', marginTop: 2 }}>{b.notes}</div> : ''}
              <button type="button" onClick={() => deleteBuyer(b.id, b.name)} style={{ marginTop: 6, fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
