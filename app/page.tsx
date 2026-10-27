'use client';

import { useState } from 'react';
import DealAnalyzer from '../components/DealAnalyzer';
import AuthPanel from '../components/AuthPanel';
import Leads from '../components/Leads';
import TodayCenter from '../components/TodayCenter';
import { supabaseConfigured } from '../lib/supabase';
import type { Lead } from '../lib/leads';

const STAGES = ['Find', 'Qualify', 'Contract', 'Market', 'Show', 'Close', 'Track'];

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  return (
    <div>
      <h1>WholesalingOS — Production Build, Slice 2</h1>
      <p>
        One pipeline, one deal record: Find → Qualify → Contract → Market
        → Show → Close → Track. Slice 1 was the foundation + Deal Analyzer.
        Slice 2 adds sign-in and the Lead CRM + Today Center. Contracts,
        viewings, and escrow are Slice 3.
      </p>

      <section style={{ background: supabaseConfigured ? '#052e16' : '#422006', padding: 16, borderRadius: 12 }}>
        <strong>Sync status: {supabaseConfigured ? 'Supabase configured — sign-in and lead sync can be tested.' : 'Supabase NOT configured yet — sign-in and lead sync are local-only until then.'}</strong>
        <p style={{ fontSize: 13 }}>
          To turn on sync: create a fresh Supabase project (rotate the compromised Oct 19 key first),
          run production/schema.sql then schema-v2-additions.sql in its SQL editor, and set
          NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY. Google sign-in also needs the
          Google provider enabled in Supabase Auth. Until then, no data is claimed to sync.
        </p>
      </section>

      <div style={{ marginTop: 16 }}>
        <AuthPanel onUser={(id) => setUserId(id)} />
      </div>

      <h2 style={{ marginTop: 24 }}>Pipeline</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {STAGES.map((s) => (
          <span key={s} style={{ background: '#1e293b', padding: '8px 12px', borderRadius: 999 }}>{s}</span>
        ))}
      </div>

      <TodayCenter leads={leads} />
      <Leads userId={userId} onLeads={setLeads} />

      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 16 }}>
        No fake leads, buyers, or deals are seeded here. Empty states are
        honest empty states until you enter your own data. Your buyer list
        and leads are yours only — Row Level Security in schema.sql blocks
        other users from reading them.
      </p>

      <DealAnalyzer />
    </div>
  );
}
