'use client';

import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import type { ProfileAccess } from '../lib/access';

// Slice 75 — Sealed-Office Win-Back. When a wholesaler's trial or
// subscription lapses, the app locks — but nothing is deleted and
// nothing is shown to anyone else: the same row-level security that
// sealed the office while they worked keeps sealing it while they
// are gone. This panel states that covenant where the lapsed user
// actually lands, with their own waiting counts read from their own
// rows (RLS lets an owner read their own records; the billing lock
// is app-layer only), and the one-click way back: subscribe, and
// the office reopens exactly as it was left.

interface Counts { leads: number; buyers: number; deals: number }

async function countOwn(table: string, userId: string): Promise<number> {
  if (!supabase) throw new Error('not configured');
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export default function SealedOffice({ userId, access }: { userId: string; access: ProfileAccess | null }) {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabaseConfigured || !supabase) return;
      try {
        const [leads, buyers, deals] = await Promise.all([
          countOwn('leads', userId),
          countOwn('buyers', userId),
          countOwn('deals', userId),
        ]);
        if (live) setCounts({ leads, buyers, deals });
      } catch { /* counts stay hidden rather than guessed */ }
    })();
    return () => { live = false; };
  }, [userId]);

  const ended = access?.trial_ends_at && new Date(access.trial_ends_at).getTime() < Date.now()
    ? new Date(access.trial_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <section style={{ background: '#1e293b', border: '1px solid #38bdf8', padding: 20, borderRadius: 12, marginTop: 16 }}>
      <h2>🔒 Your office is sealed — not deleted</h2>
      {ended && <p style={{ fontSize: 14 }}>Your free days ended {ended}. Everything you built is still here.</p>}
      {counts && (
        <p style={{ fontSize: 14.5 }}>
          Waiting for you, exactly as you left them:{' '}
          <strong>{counts.leads} lead{counts.leads === 1 ? '' : 's'}</strong> ·{' '}
          <strong>{counts.buyers} cash buyer{counts.buyers === 1 ? '' : 's'}</strong> ·{' '}
          <strong>{counts.deals} deal{counts.deals === 1 ? '' : 's'}</strong>.
        </p>
      )}
      <p style={{ fontSize: 13.5, color: '#94a3b8' }}>
        We keep a sealed office for at least 12 months after it lapses. Nothing is sold, shared, or shown to
        anyone — the seal is the same row-level security that protected your office while you worked, and it
        does not lift until you are back.
      </p>
      <p style={{ fontSize: 14 }}>
        Reopening takes one step: subscribe above, and your office comes back exactly as you left it —
        same leads, same buyers, same deals, same records.
      </p>
    </section>
  );
}
