'use client';

import { useState } from 'react';
import type { StorefrontProfile } from '../lib/storefront';

// Slice 124 — trust & credibility blocks for /sell/<slug>, below
// the contact block. Everything here is either generic and true
// for every direct sale, or rendered from the wholesaler's own
// Storefront Settings. Nothing is invented: the comparison table
// shows only when the wholesaler has saved their own offer terms;
// testimonials and past-deal cards show only when the wholesaler
// entered them; the track record is the platform's own counted
// closings (or the honest "no closings counted yet" line).

const SITUATIONS = [
  { icon: '🏠', label: 'Behind on Mortgage / Pre-Foreclosure' },
  { icon: '🗝️', label: 'Inherited / Probate Property' },
  { icon: '⚠️', label: 'Code Violations / Unpermitted Work' },
  { icon: '😩', label: 'Tired Landlord' },
  { icon: '✈️', label: 'Relocating Fast' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do I have to clean out the house?',
    a: 'No. We buy houses as-is — you can leave whatever you do not want. Take what matters to you; we handle the rest.',
  },
  {
    q: "What if I'm behind on payments or facing foreclosure?",
    a: 'Tell us where things stand and we will move fast to review your property. We buy as-is and can often close in days, but we never promise to stop a foreclosure — only a court can do that, and you should talk to an attorney about your deadlines.',
  },
  {
    q: 'How do you calculate my offer?',
    a: 'We look at what similar homes nearby have sold for, subtract the cost of the repairs the home needs, and subtract a margin for the resale. That gives the most we can fairly pay. There is no fee to get the offer, and you are never obligated to take it.',
  },
  {
    q: 'Are there any fees or commissions?',
    a: 'No. Selling directly means no realtor commission from you, and we buy as-is so there are no repair bills before closing. Your exact terms are listed in the comparison above.',
  },
  {
    q: 'Who do I close with?',
    a: 'Every purchase closes through a licensed local title company or real estate attorney — never a wire transfer to an individual. You always know who you are closing with before you sign anything.',
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
      <h2>Questions sellers ask us</h2>
      {FAQS.map((f, i) => (
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
}: {
  profile: StorefrontProfile | null;
  company: string;
  closedCount: number | null;
}) {
  const turnaround = profile?.turnaround_promise?.trim() || '';
  const hasTerms =
    !!profile &&
    !!(profile.offer_fees?.trim() || profile.offer_repairs?.trim() || profile.offer_close_days?.trim() || profile.offer_closing_costs?.trim());
  const testimonials = profile?.testimonials || [];
  const pastDeals = profile?.past_deals || [];

  return (
    <div>
      <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
        <h2>How it works</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ fontSize: 24, margin: '0 0 4px' }}>1️⃣</p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Submit your property</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>Takes about 60 seconds. No obligation.</p>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ fontSize: 24, margin: '0 0 4px' }}>2️⃣</p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Receive a fair cash offer</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>
              {turnaround
                ? /^within\s/i.test(turnaround)
                  ? `Within ${turnaround.replace(/^within\s+/i, '')}.`
                  : `${turnaround.charAt(0).toUpperCase()}${turnaround.slice(1)}.`
                : 'As fast as we can review it.'}
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ fontSize: 24, margin: '0 0 4px' }}>3️⃣</p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Close on your timeline</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>No realtor commissions. No repair costs.</p>
          </div>
        </div>
      </section>

      {hasTerms && profile && (
        <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
          <h2>Selling to us vs. a traditional agent</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #334155' }}></th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #334155' }}>Selling to {company}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #334155' }}>Traditional listing</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '6px 8px' }}>Fees / commissions</td>
                <td style={{ padding: '6px 8px' }}>{profile.offer_fees || '—'}</td>
                <td style={{ padding: '6px 8px' }}>Agent commission due at closing</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px' }}>Repairs needed</td>
                <td style={{ padding: '6px 8px' }}>{profile.offer_repairs || '—'}</td>
                <td style={{ padding: '6px 8px' }}>Often requested by buyers</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px' }}>Time to close</td>
                <td style={{ padding: '6px 8px' }}>{profile.offer_close_days || '—'}</td>
                <td style={{ padding: '6px 8px' }}>Often 30–90 days</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 8px' }}>Closing costs</td>
                <td style={{ padding: '6px 8px' }}>{profile.offer_closing_costs || '—'}</td>
                <td style={{ padding: '6px 8px' }}>Usually the seller&apos;s cost</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
            These are {company}&apos;s own terms, as listed by them — not platform-wide promises.
          </p>
        </section>
      )}

      <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
        <h2>Situations we help with</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SITUATIONS.map((s) => (
            <span key={s.label} style={{ background: '#1e293b', padding: '8px 12px', borderRadius: 999, fontSize: 13.5 }}>
              {s.icon} {s.label}
            </span>
          ))}
        </div>
      </section>

      {closedCount !== null && (
        <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
          <h2>Track record</h2>
          <p style={{ fontSize: 14, margin: 0 }}>
            {closedCount > 0
              ? `🏆 ${closedCount} deal${closedCount === 1 ? '' : 's'} closed on this platform — counted from closing records, not claimed.`
              : 'New on this platform — no closings counted yet. Every closing here gets counted.'}
          </p>
          {pastDeals.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              {pastDeals.map((d, i) => (
                <div key={i} style={{ background: '#1e293b', padding: 12, borderRadius: 8, minWidth: 180, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Purchased in {d.city}</p>
                  <p style={{ fontSize: 13.5, margin: 0 }}>
                    Closed in {d.days}
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
          <h2>What sellers told us</h2>
          {testimonials.map((t, i) => (
            <blockquote key={i} style={{ margin: '0 0 12px', borderLeft: '3px solid #4ade80', paddingLeft: 12 }}>
              <p style={{ fontSize: 14, margin: 0 }}>&ldquo;{t.quote}&rdquo;</p>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>— {t.name}</p>
            </blockquote>
          ))}
        </section>
      )}

      <FaqAccordion />
    </div>
  );
}
