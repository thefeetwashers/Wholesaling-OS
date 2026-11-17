'use client';

// Slice 133 — Deal attention stats (components/DealAttentionStats.tsx).
//
// Real counts only, shown on the public deal detail page:
//   * Days on market — computed here from the deal's real
//     published_deals.created_at. No table, no guess.
//   * Views — counted page loads from public.deal_views, via
//     /api/deal-view (service-role route; the client never writes
//     to the table). One counted view per browser session per
//     deal (sessionStorage guard); the label says "counted page
//     loads", not unique visitors.
//   * Responses — counted live from the real
//     public.deal_responses rows by the same route. Only the
//     COUNT is public; who responded and what they wrote stays
//     behind the deal_responses RLS policies.
//   * Price drops — derived ONLY from the real
//     public.deal_price_history rows. A drop is a later recorded
//     price lower than the previous recorded price. The initial
//     row is written at publish time by publishDeal
//     (lib/published-deals.ts); there is no edit flow for a
//     published deal's asking price today, so later rows appear
//     only if an edit flow is added and records them. Deals
//     published before this slice have no history rows, and the
//     component says so instead of inventing a prior price.
//
// The component is standalone: the deal detail page mounts it
// with <DealAttentionStats dealId={deal.id} createdAt={deal.created_at}
// askingPrice={deal.asking_price} />. It fetches nothing until
// mounted, and on any stats failure it still shows days on
// market with an honest "could not be loaded" note for the rest.

import { useEffect, useState } from 'react';

const money = (n: number | null | undefined): string =>
  n == null ? 'not provided' : `$${Math.round(n).toLocaleString()}`;

interface PriceHistoryEntry {
  old_price: number | null;
  new_price: number | null;
  changed_at: string;
}

interface DealStats {
  views: number;
  responses: number;
  priceHistory: PriceHistoryEntry[];
}

function daysOnMarket(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

// Drops, derived from consecutive recorded prices: a row whose
// new_price is lower than the previous row's new_price. The
// initial row (old_price null) can never be a drop — it is the
// first recorded price.
function priceDrops(history: PriceHistoryEntry[]): { amount: number; from: number; to: number; when: string }[] {
  const drops: { amount: number; from: number; to: number; when: string }[] = [];
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1].new_price;
    const cur = history[i].new_price;
    if (prev != null && cur != null && cur < prev) {
      drops.push({ amount: prev - cur, from: prev, to: cur, when: history[i].changed_at });
    }
  }
  return drops;
}

export default function DealAttentionStats({
  dealId,
  createdAt,
  askingPrice,
}: {
  dealId: string;
  createdAt: string | null | undefined;
  askingPrice: number | null | undefined;
}) {
  const [stats, setStats] = useState<DealStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    let live = true;
    const key = `ws_deal_viewed_${dealId}`;
    let counted = false;
    try {
      counted = sessionStorage.getItem(key) === '1';
    } catch {
      counted = false;
    }
    const load = async () => {
      try {
        let res: Response;
        if (counted) {
          // Already counted this visit — read the stats without
          // recording another view.
          res = await fetch(`/api/deal-view?dealId=${encodeURIComponent(dealId)}`);
        } else {
          res = await fetch('/api/deal-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId }),
          });
          if (res.ok) {
            try {
              sessionStorage.setItem(key, '1');
            } catch {
              // No storage — the next load counts again, honestly.
            }
          }
        }
        if (!res.ok) throw new Error('Stats request failed.');
        const j = (await res.json()) as DealStats;
        if (!live) return;
        setStats({
          views: typeof j.views === 'number' ? j.views : 0,
          responses: typeof j.responses === 'number' ? j.responses : 0,
          priceHistory: Array.isArray(j.priceHistory) ? j.priceHistory : [],
        });
      } catch {
        if (live) setStatsError(true);
      }
    };
    load();
    return () => {
      live = false;
    };
  }, [dealId]);

  const dom = daysOnMarket(createdAt);
  const drops = stats ? priceDrops(stats.priceHistory) : [];
  const initialPrice = stats && stats.priceHistory.length > 0 ? stats.priceHistory[0].new_price : null;
  const initialWhen = stats && stats.priceHistory.length > 0 ? stats.priceHistory[0].changed_at : null;

  return (
    <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, fontSize: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
        <span>
          <strong>{dom == null ? 'not provided' : `${dom} ${dom === 1 ? 'day' : 'days'}`}</strong>
          {' '}on market
        </span>
        <span>
          <strong>{stats ? stats.views.toLocaleString() : statsError ? 'could not be loaded' : '…'}</strong>
          {' '}views
        </span>
        <span>
          <strong>{stats ? stats.responses.toLocaleString() : statsError ? 'could not be loaded' : '…'}</strong>
          {' '}{stats && stats.responses === 1 ? 'response' : 'responses'}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: '#64748b', margin: '8px 0 0' }}>
        Views are counted page loads (one per visit) — not unique visitors. Responses are the count of buyer responses to
        this deal; who responded stays private.
      </p>
      {stats && (
        <>
          <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Price history</h3>
          {stats.priceHistory.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
              Price history was not recorded for this deal — it was published before price tracking started, or no asking
              price was given at publish time.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 6px' }}>
                Published at <strong>{money(initialPrice)}</strong>
                {initialWhen ? ` on ${new Date(initialWhen).toLocaleDateString()}` : ''}
                {askingPrice != null && initialPrice != null && askingPrice !== initialPrice
                  ? ` · now asking ${money(askingPrice)}`
                  : ''}
              </p>
              {drops.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>No price drops recorded.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {drops.map((d, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      Price dropped <strong>{money(d.amount)}</strong> — {money(d.from)} → {money(d.to)}
                      {` on ${new Date(d.when).toLocaleDateString()}`}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
      {statsError && (
        <p style={{ margin: '8px 0 0', fontSize: 13.5, color: '#64748b' }}>
          Views, responses, and price history could not be loaded just now.
        </p>
      )}
    </div>
  );
}
