'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchTracker, type PublicTrackerLead } from '../../../lib/tracker';
import { getStorefrontDict, STOREFRONT_LANGS, type StorefrontLang } from '../../../lib/storefront-i18n';
import SellerTracker from '../../../components/SellerTracker';
import SellerOfferReceipt from '../../../components/SellerOfferReceipt';

// Slice 125 — the seller's private tracking link, /track/<token>.
// No login. The seller sees only their own progress (Received →
// Reviewed → Offer made → Closing → Closed), the offer receipt
// when an offer exists, and the closing date — never contact
// details, never other leads. Language toggle is the same
// English / Español / Kreyòl Ayisyen set as the seller page.

export default function TrackPage() {
  const params = useParams();
  const token = String((params as { token?: string })?.token || '');
  const [lang, setLang] = useState<StorefrontLang>('en');
  const [lead, setLead] = useState<PublicTrackerLead | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const t = getStorefrontDict(lang);

  useEffect(() => {
    if (!token) {
      setState('missing');
      return;
    }
    fetchTracker(token)
      .then((l) => {
        if (l) {
          setLead(l);
          setState('ready');
        } else {
          setState('missing');
        }
      })
      .catch(() => setState('missing'));
  }, [token]);

  if (state === 'loading') {
    return <p style={{ fontSize: 14 }}>{t.loading}</p>;
  }

  if (state === 'missing' || !lead) {
    return (
      <section style={{ background: '#16213a', padding: 24, borderRadius: 12 }}>
        <h1>{t.trackerTitle}</h1>
        <p style={{ fontSize: 14 }}>{t.trackerInvalid}</p>
      </section>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {STOREFRONT_LANGS.map((l) => (
          <button key={l.code} type="button" onClick={() => setLang(l.code)}
            style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
              background: lang === l.code ? '#4ade80' : '#1e293b',
              color: lang === l.code ? '#052e16' : '#e2e8f0',
              border: lang === l.code ? '1px solid #4ade80' : '1px solid #334155',
              fontWeight: lang === l.code ? 700 : 400,
            }}>
            {l.label}
          </button>
        ))}
      </div>
      <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
        <h1>{t.trackerTitle}</h1>
        <p style={{ fontSize: 14, margin: '6px 0 0' }}>
          {t.trackerFor} {lead.property_address}
          {lead.city ? `, ${lead.city}` : ''}{lead.state ? `, ${lead.state}` : ''}
          {lead.company ? ` — ${lead.company}` : ''}
        </p>
        {lead.preferred_closing_date && (
          <p style={{ fontSize: 14, margin: '6px 0 0' }}>
            📅 {t.trackerPreferredDate}: <strong>{lead.preferred_closing_date}</strong>
          </p>
        )}
      </section>
      <SellerTracker status={lead.seller_status} t={t} />
      {lead.receipt ? (
        <SellerOfferReceipt receipt={lead.receipt} t={t} />
      ) : (
        <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
          <h2>{t.receiptTitle}</h2>
          <p style={{ fontSize: 14, margin: 0 }}>{t.trackerNoOffer}</p>
        </section>
      )}
      {lead.slug && (
        <p style={{ fontSize: 13 }}>
          <a href={`/sell/${lead.slug}`}>← {lead.company || 'Seller page'}</a>
        </p>
      )}
    </div>
  );
}
