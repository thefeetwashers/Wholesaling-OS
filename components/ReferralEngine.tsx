'use client';

import { useEffect, useState } from 'react';
import { loadSellerPageSettings } from '../lib/portals';
import { loadMyReferralStats, type ReferralStats } from '../lib/referral';

// Slice 71 — "Give a month, get a month." A wholesaler shares one
// link; anyone who signs up through it is recorded as referred by
// them. When a referred wholesaler's PAID subscription starts, the
// platform owner owes the referrer a one-month credit ($150),
// applied by the owner to the referrer's next bill. The rules are
// printed on the panel itself: trials do not count, the credit is
// not cash, and nothing is billed or paid automatically.

export default function ReferralEngine({ userId }: { userId: string }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    loadSellerPageSettings(userId)
      .then((s) => { if (live) setSlug(s.public_slug || ''); })
      .catch(() => { if (live) setSlug(''); });
    loadMyReferralStats()
      .then((st) => { if (live) setStats(st); })
      .catch(() => { if (live) setStats({ signedUp: 0, paid: 0 }); });
    return () => { live = false; };
  }, [userId]);

  if (slug === null) return null;

  const link = slug ? `https://wholesalingos.thefeetwashers.com/?ref=${slug}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable; the link text is selectable */ }
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🎁 Give a month, get a month</h2>
      <p style={{ fontSize: 13.5, color: '#94a3b8', maxWidth: 780 }}>
        Share your link with a wholesaler who should be working in here. When they sign up through it and their
        <strong> paid</strong> subscription starts, the owner credits your account one month — $150 — against your
        next bill. The honest rules: trials don&rsquo;t count, the credit is a bill credit and never cash, and the
        owner applies it by hand — nothing is billed or paid automatically, so nobody can game it.
      </p>
      {slug ? (
        <>
          <p style={{ fontSize: 14 }}>
            Your link: <code style={{ background: '#0f172a', padding: '4px 8px', borderRadius: 6 }}>{link}</code>{' '}
            <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
          </p>
          <p style={{ fontSize: 13.5 }}>
            {stats === null
              ? 'Counting your referrals…'
              : stats.signedUp === 0
                ? 'Nobody has signed up through your link yet. First one is the hardest — send it to one wholesaler today.'
                : `${stats.signedUp} signed up through your link · ${stats.paid} paying — ${stats.paid > 0 ? `$${stats.paid * 150} in credits earned.` : 'credits land when the first one starts paying.'}`}
          </p>
        </>
      ) : (
        <p style={{ fontSize: 13.5 }}>
          Your referral link uses the same name as your seller page. Set your page address first —
          it&rsquo;s in <strong>Seller Page &amp; Intake</strong> in the sidebar — then come back here for your link.
        </p>
      )}
    </section>
  );
}
