'use client';

import { useEffect, useState } from 'react';
import { loadVerifiedPofByUserIds } from '../lib/proof-of-funds';

// Slice 133 item 2 — the "POF verified" badge for a published
// buy box. It reads ONLY the public.verified_buyer_pof view,
// which the migration fills only from rows the operator set to
// 'verified' — so there is no badge without an actual operator
// check, and no badge is ever faked. When the buyer is not
// verified this renders nothing at all: an unverified buy box
// shows no badge rather than a "not verified" label.
//
// verifiedAt is optional: pass it when the parent already loaded
// the verified map for a list (the /buyers directory loads all
// verified rows in one query); leave it out and this component
// loads the one row itself (the owner's own buy box view).

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function BuyerPofStatus({
  userId,
  verifiedAt,
}: {
  userId: string;
  verifiedAt?: string | null;
}) {
  const [loadedAt, setLoadedAt] = useState<string | null | undefined>(verifiedAt);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (verifiedAt !== undefined) {
      setLoadedAt(verifiedAt);
      return;
    }
    let live = true;
    loadVerifiedPofByUserIds([userId])
      .then((map) => {
        if (live) setLoadedAt(map[userId] ?? null);
      })
      .catch(() => {
        if (live) setLoadFailed(true);
      });
    return () => {
      live = false;
    };
  }, [userId, verifiedAt]);

  // Not verified (or the check failed): render nothing. The
  // directory must never show a badge it cannot prove, and a
  // failed load must not read as "not verified" either — silence
  // is the honest state in both cases.
  if (loadFailed) return null;
  if (loadedAt === undefined || loadedAt === null) return null;

  return (
    <p style={{ fontSize: 13, color: '#4ade80', margin: '0 0 8px' }}>
      ✓ POF verified — {formatDate(loadedAt)}
    </p>
  );
}
