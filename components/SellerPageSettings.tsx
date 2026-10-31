'use client';

import { useEffect, useState } from 'react';
import {
  loadSellerPageSettings,
  saveSellerPageSettings,
  type SellerPageSettings,
} from '../lib/portals';

// Wholesaler branding + public seller page controls (Slice 20). The
// page lives at /sell/<slug> under the wholesaler's own company name;
// seller submissions land in this wholesaler's Leads as
// "Seller landing page" leads. Settings save to the wholesaler's own
// profiles row only.

const SLUG_OK = /^[a-z0-9-]{3,40}$/;

export default function SellerPageSettingsCard({ userId }: { userId: string }) {
  const [s, setS] = useState<SellerPageSettings | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSellerPageSettings(userId).then(setS).catch(() => setMsg('Seller page settings are not available yet — schema v3.7 must be run in Supabase first.'));
  }, [userId]);

  if (!s) {
    return (
      <section style={{ background: '#16213a', padding: 16, borderRadius: 12, marginTop: 16 }}>
        <h2>Your public seller page</h2>
        <p style={{ fontSize: 13 }}>{msg || 'Loading your page settings…'}</p>
      </section>
    );
  }

  const slug = s.public_slug.trim().toLowerCase();
  const pageUrl = slug ? `https://wholesalingos.thefeetwashers.com/sell/${slug}` : '';

  const save = async () => {
    if (slug && !SLUG_OK.test(slug)) {
      setMsg('Page address must be 3–40 characters: lowercase letters, numbers, and hyphens only.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await saveSellerPageSettings(userId, s);
      setMsg(s.seller_page_enabled && slug
        ? 'Saved — your seller page is live at the address below.'
        : 'Saved. Your seller page is currently off; turn it on and save to publish it.');
      loadSellerPageSettings(userId).then(setS).catch(() => {});
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setMsg(text.includes('profiles_public_slug_key') || text.includes('duplicate key')
        ? 'That page address is already taken by another wholesaler. Pick a different one.'
        : 'Save failed — check the connection and try again.');
    }
    setBusy(false);
  };

  return (
    <section style={{ background: '#16213a', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Your public seller page — your company, your front door</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Motivated sellers find this page, submit their property, and it lands in your Leads
        as a “Seller landing page” lead. Only your company name, headline, and about text are
        public — your email and account details are never shown.
      </p>
      <div>
        <input placeholder="Company name (shown on your page)" value={s.company}
          onChange={(e) => setS({ ...s, company: e.target.value })} style={{ minWidth: 280 }} />
      </div>
      <div style={{ marginTop: 6 }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>wholesalingos.thefeetwashers.com/sell/</span>
        <input placeholder="your-company" value={s.public_slug}
          onChange={(e) => setS({ ...s, public_slug: e.target.value })} />
      </div>
      <div style={{ marginTop: 6 }}>
        <input placeholder="Headline — e.g. We buy houses in Fort Pierce, any condition" value={s.seller_page_headline}
          onChange={(e) => setS({ ...s, seller_page_headline: e.target.value })} style={{ minWidth: 340 }} />
      </div>
      <div style={{ marginTop: 6 }}>
        <textarea placeholder="About your company — how you work, how fast you can close, what sellers can expect" value={s.seller_page_about}
          onChange={(e) => setS({ ...s, seller_page_about: e.target.value })} rows={3} style={{ width: '100%', maxWidth: 560 }} />
      </div>
      <label style={{ fontSize: 14, display: 'block', marginTop: 8 }}>
        <input type="checkbox" checked={s.seller_page_enabled}
          onChange={(e) => setS({ ...s, seller_page_enabled: e.target.checked })} />{' '}
        Publish my seller page
      </label>
      <div style={{ marginTop: 10 }}>
        <button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save page settings'}</button>
      </div>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
      {s.seller_page_enabled && pageUrl && (
        <p style={{ fontSize: 13 }}>
          Your live page: <a href={pageUrl} target="_blank" rel="noreferrer">{pageUrl}</a>{' '}
          <button onClick={() => { navigator.clipboard?.writeText(pageUrl); setMsg('Page address copied.'); }}>Copy link</button>
        </p>
      )}
    </section>
  );
}
