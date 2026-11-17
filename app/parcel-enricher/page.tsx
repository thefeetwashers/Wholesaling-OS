// Slice 135 — Bulk FL Parcel Enricher page (/parcel-enricher).
//
// Thin wrapper: loads the signed-in user id and renders
// components/ParcelEnricher.tsx, which does the work. Sign-in
// links to the homepage sign-in section (/#signin), the same way
// the public deals page reaches it — auth is not rebuilt here.
// Mounting/nav is the coordinator's job (app/page.tsx).

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import ParcelEnricher from '../../components/ParcelEnricher';

export default function ParcelEnricherPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
      setChecked(true);
    });
  }, []);

  return (
    <main style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ margin: '0 0 8px' }}>
          <Link href="/" style={{ color: '#7dd3fc' }}>← Back to home</Link>
        </p>
        <h1 style={{ margin: '0 0 4px' }}>Bulk parcel enricher</h1>
        <p style={{ fontSize: 13.5, color: '#cbd5e1', marginTop: 0 }}>
          Resolve up to 50 Florida parcel IDs at once — owner, addresses, just value, county — from
          the FDOR statewide cadastral roll.
        </p>
        {!checked ? (
          <p style={{ fontSize: 13.5, color: '#cbd5e1' }}>Checking sign-in…</p>
        ) : !userId ? (
          <p style={{ fontSize: 13.5 }}>
            Sign in to use the parcel enricher.{' '}
            <Link href="/#signin" style={{ color: '#7dd3fc' }}>Sign in</Link>
          </p>
        ) : (
          <ParcelEnricher userId={userId} />
        )}
      </div>
    </main>
  );
}
