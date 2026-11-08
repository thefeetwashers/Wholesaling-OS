'use client';

import { useEffect, useState } from 'react';
import { US_STATES, loadMyStates, saveMyStates } from '../lib/my-states';

// Slice 96 — My States settings card (dashboard). Pick the
// states and territories you work; the Auction Feed opens on
// your first saved state. Presentation and defaults only — the
// copy says so on the card: saving states never removes a door.

export default function MyStatesCard({ userId }: { userId: string }) {
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;
    loadMyStates(userId).then((v) => { if (live) setPicked(v); }).catch(() => { if (live) setPicked([]); });
    return () => { live = false; };
  }, [userId]);

  if (!picked) return null;

  const toggle = (code: string) => {
    setMsg('');
    setPicked((cur) => (cur && cur.includes(code) ? cur.filter((c) => c !== code) : [...(cur || []), code]));
  };

  const save = async () => {
    setBusy(true);
    const ok = await saveMyStates(userId, picked);
    setBusy(false);
    setMsg(ok ? 'Saved — your Auction Feed now opens on your first saved state.' : 'Saving failed — please try again.');
  };

  return (
    <section style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 16, padding: '20px 24px', marginTop: 16 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>🗺️ My States — where you work</h2>
      <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 10px' }}>
        Pick the states and territories you work. Your Auction Feed opens on your first saved state
        (in the list’s order). This sets defaults only — it never limits your coverage: every county
        door, playbook, and feed state stays available to you either way.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {US_STATES.map((s) => {
          const on = picked.includes(s.code);
          return (
            <button
              key={s.code}
              onClick={() => toggle(s.code)}
              title={s.name}
              style={{
                padding: '6px 11px', borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 400,
                background: on ? '#065f46' : '#0f172a', color: on ? '#ecfdf5' : '#cbd5e1',
                border: `1px solid ${on ? 'rgba(110,231,183,0.6)' : 'rgba(148,163,184,0.35)'}`,
              }}
            >
              {s.code}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save my states'}</button>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          {picked.length === 0 ? 'None saved — the feed opens on Florida, the platform’s home state.' : `${picked.length} saved: ${picked.join(', ')}`}
        </span>
      </div>
      {msg && <p style={{ fontSize: 13, color: '#6ee7b7', marginTop: 8 }}>{msg}</p>}
    </section>
  );
}
