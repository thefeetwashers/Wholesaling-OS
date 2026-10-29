'use client';

import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';

// Sign-in panel. Email/password uses Supabase Auth directly.
// Google uses Supabase's Google OAuth provider — it only works after
// the owner enables Google in Supabase Auth and adds Google Cloud
// OAuth credentials there (owner step, not in this code).
// Owner/admin account: thefeetwashers@gmail.com. ejulien@ is NOT the owner.
export default function AuthPanel({ onUser }: { onUser: (id: string | null, email: string | null) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  // OAuth errors come back in the URL, not through supabase.auth — surface them.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error_description') || params.get('error');
    if (err) setMessage(decodeURIComponent(err.replace(/\+/g, ' ')));
  }, []);

  // Fallback for the profiles row: the Supabase signup trigger normally
  // creates it, but if it ever misses, a lead save would fail on the
  // profiles foreign key. This upserts only the signed-in user's own row.
  const ensureProfile = async (id: string, email: string | null) => {
    if (!supabase || !email) return;
    await supabase.from('profiles').upsert({ id, email }, { onConflict: 'id', ignoreDuplicates: true });
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUserEmail(u?.email ?? null);
      onUser(u?.id ?? null, u?.email ?? null);
      if (u) void ensureProfile(u.id, u.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUserEmail(u?.email ?? null);
      onUser(u?.id ?? null, u?.email ?? null);
      if (u) void ensureProfile(u.id, u.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supabaseConfigured || !supabase) {
    return (
      <section style={{ background: '#422006', padding: 16, borderRadius: 12 }}>
        <strong>Sign-in not available yet — Supabase is not configured.</strong>
        <p style={{ fontSize: 13 }}>
          Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY, run
          production/schema.sql in that project, and this panel will offer
          email/password sign-in and Google sign-in. No sign-in is faked here.
        </p>
      </section>
    );
  }

  if (userEmail) {
    return (
      <section style={{ background: '#052e16', padding: 16, borderRadius: 12 }}>
        <strong>Signed in as {userEmail}</strong>
        {userEmail === 'thefeetwashers@gmail.com' && <span> — owner/admin account</span>}
        <button style={{ marginLeft: 12 }} onClick={async () => { await supabase.auth.signOut(); }}>Sign out</button>
      </section>
    );
  }

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12 }}>
      <h2>Sign in</h2>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginRight: 8 }} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginRight: 8 }} />
      <button onClick={async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setMessage(error ? error.message : '');
      }}>Sign in</button>{' '}
      <button onClick={async () => {
        const { error } = await supabase.auth.signUp({ email, password });
        setMessage(error ? error.message : 'Check your email to confirm, if confirmation is enabled.');
      }}>Create account</button>{' '}
      <button onClick={async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
        setMessage(error ? error.message : '');
      }}>Continue with Google</button>
      {message && <p style={{ fontSize: 13, color: '#f87171' }}>{message}</p>}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Google sign-in needs the Google provider enabled in Supabase Auth first.
        Owner account is thefeetwashers@gmail.com.
      </p>
    </section>
  );
}
