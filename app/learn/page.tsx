import React from 'react';
import type { Metadata } from 'next';
import { LESSONS } from '../../lib/lessons';

// Slice 95 — WholesalingOS School, index. Public lessons that
// teach the real routines: government doors, official records,
// the honest fire-damaged lesson, and the path onto the lead
// sheet. Every lesson ends at the same door — the 90-day trial.

export const metadata: Metadata = {
  title: 'WholesalingOS School — learn wholesaling from the real sources',
  description: 'Free lessons on finding deals on government websites, finding off-market property in official records, the truth about fire-damaged lists, and working a found property onto your lead sheet.',
  alternates: { canonical: '/learn' },
};

const wrap: React.CSSProperties = { maxWidth: 900, margin: '0 auto' };

export default function LearnIndex() {
  return (
    <div style={wrap}>
      <p className="ws-buildtag">WholesalingOS School</p>
      <section style={{ background: '#1e293b', padding: 22, borderRadius: 12, marginTop: 16 }}>
        <h1>Learn it the way it actually works</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65 }}>
          No gurus, no secret databases, no lists that do not exist. These lessons teach the routines
          WholesalingOS is built around — the official doors, the hand-pulled lists, the lawful contact
          pattern, and the buttons inside the office that take it from there. Read them free, follow them
          with no account, and when you want the machinery, the office is 90 days free.
        </p>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
        {LESSONS.map((l) => (
          <a key={l.slug} href={`/learn/${l.slug}`} style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 12, padding: '16px 18px', textDecoration: 'none', color: '#e2e8f0' }}>
            <div style={{ fontSize: 22 }}>{l.icon}</div>
            <div style={{ fontSize: 16.5, fontWeight: 700, color: '#fff', marginTop: 6 }}>{l.title}</div>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.55, margin: '8px 0' }}>{l.dek}</p>
            <span style={{ fontSize: 12.5, color: '#7dd3fc' }}>About {l.minutes} minutes →</span>
          </a>
        ))}
      </div>
      <section style={{ background: '#052e16', border: '1px solid #166534', padding: 20, borderRadius: 12, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>The office these lessons point to</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>
          WholesalingOS is the wholesaling office that does what it says: real records, real math, real
          closings, and a 90-day free trial long enough to catch anything fake. One flat fee after that —
          $150 a month — and no cut of your deals, ever.
        </p>
        <a href="/" style={{ display: 'inline-block', background: '#059669', color: '#fff', fontWeight: 700, padding: '11px 22px', borderRadius: 8, textDecoration: 'none' }}>
          Start your 90 days free
        </a>
      </section>
    </div>
  );
}
