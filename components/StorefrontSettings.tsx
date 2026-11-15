'use client';

import { useEffect, useState } from 'react';
import {
  emptyStorefrontProfile,
  loadMyStorefront,
  saveMyStorefront,
  PROPERTY_TYPES,
  type StorefrontProfile,
  type StorefrontTestimonial,
  type StorefrontPastDeal,
} from '../lib/storefront';
import { loadSellerPageSettings } from '../lib/portals';

// Slice 124 — Storefront Settings in the wholesaler dashboard.
// Everything saved here is PUBLIC: it is exactly what a seller
// sees at the top of this wholesaler's /sell/<slug> page — name,
// company, logo/headshot, public phone and email, service areas,
// buy-box property types, bio, title company, booking link,
// turnaround promise, response-time text, offer terms, and the
// testimonials / past-deal cards they enter. Nothing private is
// stored here and nothing private is ever shown on the page.
// Testimonials must be real sellers' real words; past-deal cards
// must be real closings — the platform's counted total is shown
// separately on the page, so anything invented would stand out.

export default function StorefrontSettingsCard({ userId }: { userId: string }) {
  const [p, setP] = useState<StorefrontProfile | null>(null);
  const [slug, setSlug] = useState('');
  const [areasText, setAreasText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await loadSellerPageSettings(userId);
        if (cancelled) return;
        setSlug(s?.public_slug || '');
        const mine = await loadMyStorefront(userId);
        if (cancelled) return;
        const base = mine || emptyStorefrontProfile(s?.public_slug || '', s?.company || '');
        if (!mine && s?.company) base.company_name = s.company;
        setP(base);
        setAreasText(base.service_areas.join(', '));
      } catch {
        if (!cancelled) setMsg('Storefront settings are not available yet — the Slice 124 migration must be run in Supabase first.');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!p) {
    return (
      <section style={{ background: '#16213a', padding: 16, borderRadius: 12, marginTop: 16 }}>
        <h2>Storefront settings</h2>
        <p style={{ fontSize: 13 }}>{msg || 'Loading your storefront settings…'}</p>
      </section>
    );
  }

  const pageUrl = slug ? `https://wholesalingos.thefeetwashers.com/sell/${slug}` : '';

  const set = <K extends keyof StorefrontProfile>(key: K, value: StorefrontProfile[K]) =>
    setP({ ...p, [key]: value });

  const toggleType = (t: string) =>
    set('property_types', p.property_types.includes(t) ? p.property_types.filter((x) => x !== t) : [...p.property_types, t]);

  const editTestimonial = (i: number, patch: Partial<StorefrontTestimonial>) => {
    const next = p.testimonials.map((t, j) => (j === i ? { ...t, ...patch } : t));
    set('testimonials', next);
  };

  const editDeal = (i: number, patch: Partial<StorefrontPastDeal>) => {
    const next = p.past_deals.map((d, j) => (j === i ? { ...d, ...patch } : d));
    set('past_deals', next);
  };

  const save = async () => {
    if (!slug) {
      setMsg('Set your seller page address first (in "Your public seller page" above), then save your storefront.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const toSave: StorefrontProfile = {
        ...p,
        public_slug: slug,
        service_areas: areasText.split(',').map((a) => a.trim()).filter(Boolean),
      };
      await saveMyStorefront(userId, toSave);
      setP(toSave);
      setMsg('Saved — your seller page now shows this profile.');
    } catch {
      setMsg('Save failed — check the connection and try again. If this keeps happening, the Slice 124 migration may not be applied yet.');
    }
    setBusy(false);
  };

  return (
    <section style={{ background: '#16213a', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Storefront settings — what sellers see on your page</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Everything here is public — it appears at the top of your /sell/ page. Only fill in
        what you are happy for any seller to see. Your private email and account details are
        never shown; the public phone and email below are the ones you choose to publish.
      </p>
      <div>
        <input placeholder="Display name — e.g. Erna Julien" value={p.display_name}
          onChange={(e) => set('display_name', e.target.value)} style={{ minWidth: 260 }} />
        <input placeholder="Title — e.g. Acquisitions Manager" value={p.title}
          onChange={(e) => set('title', e.target.value)} style={{ minWidth: 240, marginLeft: 6 }} />
      </div>
      <div style={{ marginTop: 6 }}>
        <input placeholder="Company / brand name" value={p.company_name}
          onChange={(e) => set('company_name', e.target.value)} style={{ minWidth: 280 }} />
      </div>
      <div style={{ marginTop: 6 }}>
        <input placeholder="Logo image URL (paste a link)" value={p.logo_url}
          onChange={(e) => set('logo_url', e.target.value)} style={{ minWidth: 280 }} />
        <input placeholder="Headshot image URL (paste a link)" value={p.headshot_url}
          onChange={(e) => set('headshot_url', e.target.value)} style={{ minWidth: 280, marginLeft: 6 }} />
      </div>
      <div style={{ marginTop: 6 }}>
        <input placeholder="Public phone — shown with Call & Text buttons" value={p.public_phone}
          onChange={(e) => set('public_phone', e.target.value)} style={{ minWidth: 260 }} />
        <input placeholder="Public email — shown as a mail link" value={p.public_email}
          onChange={(e) => set('public_email', e.target.value)} style={{ minWidth: 260, marginLeft: 6 }} />
      </div>
      <div style={{ marginTop: 6 }}>
        <input placeholder="Areas you buy in — counties / cities, separated by commas" value={areasText}
          onChange={(e) => setAreasText(e.target.value)} style={{ minWidth: 420 }} />
      </div>
      <div style={{ marginTop: 6 }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>We buy: </span>
        {PROPERTY_TYPES.map((t) => (
          <label key={t} style={{ fontSize: 13, marginRight: 12 }}>
            <input type="checkbox" checked={p.property_types.includes(t)} onChange={() => toggleType(t)} /> {t}
          </label>
        ))}
      </div>
      <div style={{ marginTop: 6 }}>
        <textarea placeholder="Short seller bio — 250 characters max. How you help local homeowners (foreclosure, inherited homes, bad tenants, major repairs) with zero fees."
          value={p.seller_bio} onChange={(e) => set('seller_bio', e.target.value.slice(0, 250))} rows={3}
          style={{ width: '100%', maxWidth: 560 }} />
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{p.seller_bio.length}/250 characters</p>
      </div>
      <div style={{ marginTop: 6 }}>
        <input placeholder="Title company name (optional — shown as 'Closings handled by …')" value={p.title_company}
          onChange={(e) => set('title_company', e.target.value)} style={{ minWidth: 340 }} />
        <input placeholder="Booking link (optional — Calendly, etc.)" value={p.booking_link}
          onChange={(e) => set('booking_link', e.target.value)} style={{ minWidth: 280, marginLeft: 6 }} />
      </div>
      <div style={{ marginTop: 6 }}>
        <input placeholder="Turnaround promise — e.g. within 24 hours" value={p.turnaround_promise}
          onChange={(e) => set('turnaround_promise', e.target.value)} style={{ minWidth: 280 }} />
        <input placeholder="Response-time line — e.g. We reply to every submission." value={p.response_time_text}
          onChange={(e) => set('response_time_text', e.target.value)} style={{ minWidth: 320, marginLeft: 6 }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
          Your offer terms — shown in the &ldquo;Selling to us vs. a traditional agent&rdquo; table. Edit these to match what you actually offer.
        </p>
        <input placeholder="Fees / commissions — e.g. $0 — no fees or commissions" value={p.offer_fees}
          onChange={(e) => set('offer_fees', e.target.value)} style={{ minWidth: 320 }} />
        <input placeholder="Repairs needed — e.g. None needed — we buy as-is" value={p.offer_repairs}
          onChange={(e) => set('offer_repairs', e.target.value)} style={{ minWidth: 320, marginLeft: 6 }} />
        <div style={{ marginTop: 6 }}>
          <input placeholder="Time to close — e.g. 7–14 days" value={p.offer_close_days}
            onChange={(e) => set('offer_close_days', e.target.value)} style={{ minWidth: 280 }} />
          <input placeholder="Closing costs — e.g. We pay them" value={p.offer_closing_costs}
            onChange={(e) => set('offer_closing_costs', e.target.value)} style={{ minWidth: 280, marginLeft: 6 }} />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
          Testimonials (optional, up to 3) — only real sellers&apos; real words, with their first name.
        </p>
        {p.testimonials.map((t, i) => (
          <div key={i} style={{ marginTop: 6 }}>
            <input placeholder="What the seller said" value={t.quote}
              onChange={(e) => editTestimonial(i, { quote: e.target.value })} style={{ minWidth: 340 }} />
            <input placeholder="First name" value={t.name}
              onChange={(e) => editTestimonial(i, { name: e.target.value })} style={{ width: 120, marginLeft: 6 }} />
            <button onClick={() => set('testimonials', p.testimonials.filter((_, j) => j !== i))} style={{ marginLeft: 6 }}>Remove</button>
          </div>
        ))}
        {p.testimonials.length < 3 && (
          <button onClick={() => set('testimonials', [...p.testimonials, { quote: '', name: '' }])} style={{ marginTop: 6 }}>+ Add a testimonial</button>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
          Past deals (optional, up to 3) — only real closings. Your platform-counted total is
          shown separately on your page, so only add deals that actually closed.
        </p>
        {p.past_deals.map((d, i) => (
          <div key={i} style={{ marginTop: 6 }}>
            <input placeholder="City — e.g. Fort Pierce" value={d.city}
              onChange={(e) => editDeal(i, { city: e.target.value })} style={{ minWidth: 200 }} />
            <input placeholder="Days to close — e.g. 10 days" value={d.days}
              onChange={(e) => editDeal(i, { days: e.target.value })} style={{ width: 130, marginLeft: 6 }} />
            <input placeholder="Note — e.g. $0 repairs" value={d.note}
              onChange={(e) => editDeal(i, { note: e.target.value })} style={{ minWidth: 200, marginLeft: 6 }} />
            <button onClick={() => set('past_deals', p.past_deals.filter((_, j) => j !== i))} style={{ marginLeft: 6 }}>Remove</button>
          </div>
        ))}
        {p.past_deals.length < 3 && (
          <button onClick={() => set('past_deals', [...p.past_deals, { city: '', days: '', note: '' }])} style={{ marginTop: 6 }}>+ Add a past deal</button>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save storefront settings'}</button>
      </div>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      {pageUrl && (
        <p style={{ fontSize: 13 }}>
          Your live page: <a href={pageUrl} target="_blank" rel="noreferrer">{pageUrl}</a>
        </p>
      )}
    </section>
  );
}
