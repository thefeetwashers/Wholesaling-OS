'use client';

import { useEffect, useState } from 'react';
import type { PublicSellerPage } from '../lib/portals';
import type { StorefrontProfile } from '../lib/storefront';
import { DEFAULT_RESPONSE_TIME } from '../lib/storefront';
import type { StorefrontDict, StorefrontLang } from '../lib/storefront-i18n';

// Slice 124 — the wholesaler profile header & trust card at the
// top of every /sell/<slug> page. Everything here is dynamic per
// wholesaler and comes only from what they saved in Storefront
// Settings (or the company headline/about the page already had).
// Nothing is invented: a phone, email, title company, booking
// link, or response-time line appears only when the wholesaler
// set it; the turnaround banner shows the wholesaler's own
// promise, and falls back to a plain no-obligation line when they
// have not set one. The page must feel welcoming, not like a form.
//
// Slice 125 — the video hello plays here when the wholesaler
// recorded one: the page mints a short-lived signed URL for that
// wholesaler's video only (the bucket stays private, no listing).
// If there is no video, or the signed URL cannot be minted, no
// video section appears — never a placeholder. Platform copy is
// translated by the language toggle; anything the wholesaler
// wrote (headline, about, bio, response-time line, turnaround
// promise, title company) appears exactly as written.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

export default function StorefrontHeader({
  page,
  profile,
  lang,
  t,
}: {
  page: PublicSellerPage;
  profile: StorefrontProfile | null;
  lang: StorefrontLang;
  t: StorefrontDict;
}) {
  const company = profile?.company_name?.trim() || page.company;
  const name = profile?.display_name?.trim() || '';
  const title = profile?.title?.trim() || '';
  const phone = profile?.public_phone?.trim() || '';
  const email = profile?.public_email?.trim() || '';
  const bio = profile?.seller_bio?.trim() || '';
  const turnaround = profile?.turnaround_promise?.trim() || '';
  const responseText = profile?.response_time_text?.trim() || DEFAULT_RESPONSE_TIME;
  const titleCompany = profile?.title_company?.trim() || '';
  const bookingLink = profile?.booking_link?.trim() || '';
  const areas = profile?.service_areas || [];
  const types = profile?.property_types || [];
  const headshot = profile?.headshot_url?.trim() || '';
  const logo = profile?.logo_url?.trim() || '';
  const [videoSrc, setVideoSrc] = useState('');

  // Slice 125 — signed playback URL for this wholesaler's video
  // hello only. A failure leaves videoSrc empty and the section
  // hidden; the page never shows a fake video.
  useEffect(() => {
    if (!profile?.video_url?.trim() || !profile.public_slug) {
      setVideoSrc('');
      return;
    }
    let cancelled = false;
    fetch(`/api/storefront-video?slug=${encodeURIComponent(profile.public_slug)}`)
      .then((r) => r.json().catch(() => null))
      .then((j) => {
        if (!cancelled && j && typeof j.url === 'string' && j.url) setVideoSrc(j.url);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [profile?.video_url, profile?.public_slug]);

  const bannerTitle = turnaround
    ? `${t.getOffer} ${turnaround === 'within 24 hours' ? 'in 24 Hours' : turnaround}`
    : `${t.getOffer} — ${t.offerTagline}`;

  return (
    <div>
      <div className="ws-hero">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {headshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headshot} alt={name || company} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`${company} logo`} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'contain', background: '#fff', flexShrink: 0 }} />
          ) : name ? (
            <span style={{ width: 84, height: 84, borderRadius: '50%', background: '#4ade80', color: '#052e16', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, flexShrink: 0 }}>
              {initials(name)}
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ margin: 0 }}>{company}</h1>
            {name && (
              <p style={{ fontSize: 16, margin: '4px 0 0' }}>
                {name}{title ? ` — ${title}` : ''}
              </p>
            )}
            <p style={{ margin: '8px 0 0' }}>
              {page.headline || 'We buy houses as-is — on your timeline.'}
            </p>
            {page.about && <p style={{ fontSize: 14 }}>{page.about}</p>}
            {bio && <p style={{ fontSize: 14, fontStyle: 'italic' }}>{bio}</p>}
          </div>
        </div>

        {videoSrc && (
          <div style={{ marginTop: 16 }}>
            <video src={videoSrc} controls playsInline preload="metadata"
              style={{ width: '100%', maxWidth: 420, borderRadius: 12, background: '#000' }} />
          </div>
        )}

        {(phone || email || bookingLink) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
            {phone && (
              <>
                <a href={telHref(phone)} style={{ background: '#4ade80', color: '#052e16', padding: '10px 18px', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
                  📞 Call {phone}
                </a>
                <a href={`sms:${phone.replace(/[^+\d]/g, '')}`} style={{ background: '#1e293b', color: '#e2e8f0', padding: '10px 18px', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
                  💬 Text us
                </a>
                <span style={{ fontSize: 13, color: '#4ade80' }}>{t.callText}</span>
              </>
            )}
            {email && (
              <a href={`mailto:${email}`} style={{ fontSize: 14, color: '#93c5fd' }}>
                ✉️ {email}
              </a>
            )}
            {bookingLink && (
              <a href={bookingLink} target="_blank" rel="noreferrer" style={{ background: '#1e293b', color: '#e2e8f0', padding: '10px 18px', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
                📅 {t.bookCall}
              </a>
            )}
          </div>
        )}

        {(areas.length > 0 || types.length > 0) && (
          <div style={{ marginTop: 14 }}>
            {areas.length > 0 && (
              <p style={{ fontSize: 13, margin: '0 0 6px' }}>
                <strong>{t.areasLabel}</strong>
                {areas.map((a) => (
                  <span key={a} style={{ background: '#1e293b', padding: '4px 10px', borderRadius: 999, marginRight: 6, display: 'inline-block' }}>{a}</span>
                ))}
              </p>
            )}
            {types.length > 0 && (
              <p style={{ fontSize: 13, margin: 0 }}>
                <strong>{t.weBuyLabel}</strong>
                {types.map((ty) => (
                  <span key={ty} style={{ background: '#1e293b', padding: '4px 10px', borderRadius: 999, marginRight: 6, display: 'inline-block' }}>{ty}</span>
                ))}
              </p>
            )}
          </div>
        )}

        <p style={{ fontSize: 13.5, color: '#4ade80', marginTop: 14 }}>
          ⏱️ {responseText}
        </p>
        <p style={{ fontSize: 13.5, marginTop: 6 }}>
          {t.closingAssurance}
          {titleCompany ? ` ${t.closingsHandledBy} ${titleCompany}.` : ''}
        </p>
        {lang !== 'en' && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{t.asWrittenNote}</p>
        )}
      </div>

      <div style={{ background: '#052e16', border: '1px solid #4ade80', padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{bannerTitle}</p>
        <p style={{ fontSize: 14, margin: '6px 0 0' }}>{t.bannerSub}</p>
      </div>
    </div>
  );
}
