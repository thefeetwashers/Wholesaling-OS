'use client';

import { trackerStepIndex } from '../lib/tracker';
import type { SellerStatus } from '../lib/leads';
import type { StorefrontDict } from '../lib/storefront-i18n';

// Slice 125 — the seller's five-step progress, as shown on the
// private tracking link. The seller sees only their own progress:
// Received → Reviewed → Offer made → Closing → Closed. The
// Closing step lights up at 'closing_scheduled' and completes
// at 'closed'. Nothing else about the lead is shown here.

export default function SellerTracker({
  status,
  t,
}: {
  status: SellerStatus;
  t: StorefrontDict;
}) {
  const steps = [
    t.statusReceived,
    t.statusReviewed,
    t.statusOfferMade,
    t.statusClosing,
    t.statusClosed,
  ];
  const reached = trackerStepIndex(status);
  return (
    <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
      <h2>{t.trackerTitle}</h2>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {steps.map((label, i) => {
          const done = i < reached || (status === 'closed' && i === 4);
          const current = i === reached && status !== 'closed';
          return (
            <li key={label} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', opacity: done || current ? 1 : 0.55 }}>
              <span
                style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, flexShrink: 0,
                  background: done ? '#4ade80' : current ? '#fbbf24' : '#334155',
                  color: done ? '#052e16' : current ? '#451a03' : '#94a3b8',
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <span style={{ fontSize: 15, fontWeight: current ? 800 : 400 }}>{label}</span>
              {current && <span style={{ fontSize: 13, color: '#fbbf24' }}>— {t.youAreHere}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
