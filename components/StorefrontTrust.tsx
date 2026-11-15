'use client';

import { useState } from 'react';
import type { StorefrontProfile } from '../lib/storefront';
import { noStrangersText } from '../lib/storefront-i18n';
import type { StorefrontDict, StorefrontLang } from '../lib/storefront-i18n';

// Slice 124 — trust & credibility blocks for /sell/<slug>, below
// the contact block. Everything here is either generic and true
// for every direct sale, or rendered from the wholesaler's own
// Storefront Settings. Nothing is invented: the comparison table
// shows only when the wholesaler has saved their own offer terms;
// testimonials and past-deal cards show only when the wholesaler
// entered them; the track record is the platform's own counted
// closings (or the honest "no closings counted yet" line).
//
// Slice 125 — platform copy is translated by the language
// toggle (English / Español / Kreyòl Ayisyen); anything the
// wholesaler wrote (offer terms, testimonials, past deals)
// appears exactly as written. The no-strangers promise block
// shows ONLY when the wholesaler opted into it in Storefront
// Settings — never for a wholesaler who has not.

const SITUATION_ICONS = ['🏠', '🗝️', '⚠️', '😩', '✈️'];

function FaqAccordion({ t }: { t: StorefrontDict }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
      <h2>{t.faqTitle}</h2>
      {t.faqs.map((f, i) => (
        <div key={f.q} style={{ borderTop: i === 0 ? 'none' : '1px solid #334155', padding: '8px 0' }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{ background: 'none', border: 'none', color: '#e2e8f0', fontSize: 15, fontWeight: 700, textAlign: 'left', width: '100%', padding: 0, cursor: 'pointer' }}
          >
            {open === i ? '▾' : '▸'} {f.q}
          </button>
          {open === i && <p style={{ fontSize: 14, margin: '6px 0 0' }}>{f.a}</p>}
        </div>
      ))}
    </section>
  );
}

export default function StorefrontTrust({
  profile,
  company,
  closedCount,
  lang,
  t,
}: {
  profile: StorefrontProfile | null;
  company: string;
  closedCount: number | null;
  lang: StorefrontLang;
  t: StorefrontDict;
}) {
  const turnaround = profile?.turnaround_promise?.trim() || '';
  const hasTerms =
    !!profile &&
    !!(profile.offer_fees?.trim() || profile.offer_repairs?.trim() || profile.offer_close_days?.trim() || profile.offer_closing_costs?.trim());
  const testimonials = profile?.testimonials || [];
  const pastDeals = profile?.past_deals || [];
  const showNoStrangers = profile?.no_strangers_enabled === true;

  return (
    <div>
      <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
        <h2>{t.howTitle}</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ fontSize: 24, margin: '0 0 4px' }}>1️⃣</p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{t.how1Title}</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>{t.how1Body}</p>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ fontSize: 24, margin: '0 0 4px' }}>2️⃣</p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{t.how2Title}</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>
              {turnaround
                ? /^within\s/i.test(turnaround)
                  ? `Within ${turnaround.replace(/^within\s+/i, '')}.`
                  : `${turnaround.charAt(0).toUpperCase()}${turnaround.slice(1)}.`
                : t.how2Body}
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ fontSize: 24, margin: '0 0 4px' }}>3️⃣</p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{t.how3Title}</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>{t.how3Body}</p>
          </div>
        </div>
      </section>

      {showNoStrangers && (
        <section style={{ background: '#052e16', border: '1px solid #4ade80', padding: 20, borderRadius: 12, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>{t.noStrangersTitle}</h2>
          <p style={{ fontSize: 15, margin: 0 }}>🤝 {noStrangersText(profile?.no_strangers_text, lang)}</p>
        </section>
      )}

      {hasTerms && profile && (
        <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
          <h2>{t.compareTitle}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #334155' }}></th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #334155' }}>{t.compareColUs} {company}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #334155' }}>{t.compareColAgent}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '6px 8px' }}>{t.compareFees}</td>
                <td style={{ padding: '6px 8px' }}>{profile.offer_fees || '—'}</td>
                <td style={{ padding: '6px 8px' }}>{t.compareAgentFees}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px' }}>{t.compareRepairs}</td>
                <td style={{ padding: '6px 8px' }}>{profile.offer_repairs || '—'}</td>
                <td style={{ padding: '6px 8px' }}>{t.compareAgentRepairs}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px' }}>{t.compareClose}</td>
                <td style={{ padding: '6px 8px' }}>{profile.offer_close_days || '—'}</td>
                <td style={{ padding: '6px 8px' }}>{t.compareAgentClose}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px' }}>{t.compareCosts}</td>
                <td style={{ padding: '6px 8px' }}>{profile.offer_closing_costs || '—'}</td>
                <td style={{ padding: '6px 8px' }}>{t.compareAgentCosts}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{t.compareNote}</p>
        </section>
      )}

      <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
        <h2>{t.situationsTitle}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {t.situations.map((label, i) => (
            <span key={label} style={{ background: '#1e293b', padding: '8px 12px', borderRadius: 999, fontSize: 13.5 }}>
              {SITUATION_ICONS[i] || '•'} {label}
            </span>
          ))}
        </div>
      </section>

      {closedCount !== null && (
        <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
          <h2>{t.trackTitle}</h2>
          <p style={{ fontSize: 14, margin: 0 }}>
            {closedCount > 0
              ? `🏆 ${closedCount} ${t.trackSome}`
              : t.trackNone}
          </p>
          {pastDeals.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              {pastDeals.map((d, i) => (
                <div key={i} style={{ background: '#1e293b', padding: 12, borderRadius: 8, minWidth: 180, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{t.pastDealCity} {d.city}</p>
                  <p style={{ fontSize: 13.5, margin: 0 }}>
                    {t.pastDealDays} {d.days}
                    {d.note ? ` — ${d.note}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {testimonials.length > 0 && (
        <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
          <h2>{t.testimonialsTitle}</h2>
          {testimonials.map((tm, i) => (
            <blockquote key={i} style={{ margin: '0 0 12px', borderLeft: '3px solid #4ade80', paddingLeft: 12 }}>
              <p style={{ fontSize: 14, margin: 0 }}>&ldquo;{tm.quote}&rdquo;</p>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>— {tm.name}</p>
            </blockquote>
          ))}
        </section>
      )}

      <FaqAccordion t={t} />
    </div>
  );
}
