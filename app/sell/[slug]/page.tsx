'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  loadPublicSellerPage,
  submitSellerLead,
  type PublicSellerPage,
  type SellerLeadForm,
} from '../../../lib/portals';

// Public seller landing page (Slice 20): /sell/<slug> under the
// wholesaler's own company name. No account needed. The submission
// becomes a lead in that wholesaler's CRM via the submit_seller_lead
// database function — the page never sees any account data.

const EMPTY: SellerLeadForm = {
  owner_name: '', property_address: '', city: '', state: '', zip: '',
  phone: '', email: '', notes: '', website: '',
};

export default function SellerPage() {
  const params = useParams();
  const slug = String((params as { slug?: string })?.slug || '');
  const [page, setPage] = useState<PublicSellerPage | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [f, setF] = useState<SellerLeadForm>(EMPTY);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    loadPublicSellerPage(slug)
      .then((p) => { if (p) { setPage(p); setState('ready'); } else setState('missing'); })
      .catch(() => setState('missing'));
  }, [slug]);

  const submit = async () => {
    if (!f.owner_name.trim() || !f.property_address.trim()) {
      setErr('Please add your name and the property address.');
      return;
    }
    setBusy(true);
    setErr('');
    const ok = await submitSellerLead(slug, f);
    setBusy(false);
    if (ok) setSent(true);
    else setErr('Your details could not be sent. Check the address and name, then try again.');
  };

  if (state === 'loading') {
    return <p style={{ fontSize: 14 }}>Loading…</p>;
  }

  if (state === 'missing' || !page) {
    return (
      <section style={{ background: '#16213a', padding: 24, borderRadius: 12 }}>
        <h1>This seller page isn’t available</h1>
        <p style={{ fontSize: 14 }}>
          The page you’re looking for is turned off or the address is wrong.
          Check the link with the company that sent it to you.
        </p>
      </section>
    );
  }

  if (sent) {
    return (
      <section style={{ background: '#052e16', padding: 24, borderRadius: 12 }}>
        <h1>Thank you{f.owner_name ? `, ${f.owner_name.split(' ')[0]}` : ''}.</h1>
        <p style={{ fontSize: 15 }}>
          {page.company} received your property details and will reach out shortly.
          There’s nothing else you need to do.
        </p>
      </section>
    );
  }

  return (
    <div>
      <div className="ws-hero">
        <h1>{page.company}</h1>
        <p>{page.headline || 'Thinking of selling your house? Tell us about it — no obligation.'}</p>
        {page.about && <p style={{ fontSize: 14 }}>{page.about}</p>}
      </div>

      <section style={{ background: '#16213a', padding: 20, borderRadius: 12 }}>
        <h2>Tell us about your property</h2>
        <div>
          <input placeholder="Your full name *" value={f.owner_name}
            onChange={(e) => setF({ ...f, owner_name: e.target.value })} style={{ minWidth: 260 }} />
          <input placeholder="Phone" value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input placeholder="Email" value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })} style={{ minWidth: 240 }} />
        </div>
        <div style={{ marginTop: 6 }}>
          <input placeholder="Property address *" value={f.property_address}
            onChange={(e) => setF({ ...f, property_address: e.target.value })} style={{ minWidth: 320 }} />
          <input placeholder="City" value={f.city}
            onChange={(e) => setF({ ...f, city: e.target.value })} />
          <input placeholder="State" value={f.state}
            onChange={(e) => setF({ ...f, state: e.target.value })} style={{ width: 90 }} />
          <input placeholder="ZIP" value={f.zip}
            onChange={(e) => setF({ ...f, zip: e.target.value })} style={{ width: 110 }} />
        </div>
        <div style={{ marginTop: 6 }}>
          <textarea placeholder="Anything we should know? Condition, timeline, situation — whatever you're comfortable sharing."
            value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
            rows={3} style={{ width: '100%', maxWidth: 620 }} />
        </div>
        {/* Honeypot: invisible to people, filled by bots. Do not remove. */}
        <input type="text" name="website" value={f.website} autoComplete="off" tabIndex={-1}
          onChange={(e) => setF({ ...f, website: e.target.value })}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
        {err && <p style={{ fontSize: 13.5, color: '#fbbf24' }}>{err}</p>}
        <div style={{ marginTop: 10 }}>
          <button onClick={submit} disabled={busy} style={{ fontSize: 15, padding: '10px 22px' }}>
            {busy ? 'Sending…' : 'Request my offer'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
          Your information goes only to {page.company} — it is never sold or shared with the
          platform. {page.company} may purchase your property directly or assign its purchase
          contract to another buyer; you’ll always know who you’re closing with before you sign.
        </p>
      </section>
    </div>
  );
}
