'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadAutopsyForFile, loadMyAutopsies, saveAutopsy, type DealAutopsy as AutopsyRow } from '../lib/autopsy';

// Slice 67 — the 2-minute autopsy on a finished escrow file. Shows
// only when the file's outcome is closed or fell through. One autopsy
// per file; saving again updates it. Private to the wholesaler.

export default function DealAutopsy({ escrowFileId, outcome }: { escrowFileId: string; outcome: string }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [existing, setExisting] = useState<AutopsyRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fee, setFee] = useState('');
  const [worked, setWorked] = useState('');
  const [killed, setKilled] = useState('');
  const [lesson, setLesson] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    loadAutopsyForFile(escrowFileId).then((a) => {
      if (a) {
        setExisting(a);
        setFee(a.fee_amount != null ? String(a.fee_amount) : '');
        setWorked(a.worked || '');
        setKilled(a.killed || '');
        setLesson(a.lesson || '');
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [open, loaded, escrowFileId]);

  if (outcome !== 'closed' && outcome !== 'fell_through') return null;

  const save = async () => {
    if (!userId) { setMsg('Sign-in session not found — reload and try again.'); return; }
    const ok = await saveAutopsy(userId, {
      escrow_file_id: escrowFileId,
      outcome: outcome as 'closed' | 'fell_through',
      fee_amount: fee.trim() === '' ? null : Number(fee),
      worked, killed, lesson,
    });
    setMsg(ok ? 'Autopsy saved. It is in your lessons list below your escrow files.' : 'Could not save — try again.');
    if (ok) setExisting({ escrow_file_id: escrowFileId, outcome: outcome as 'closed' | 'fell_through', worked, killed, lesson });
  };

  return (
    <span style={{ display: 'inline-block', marginLeft: 6 }}>
      <button onClick={() => setOpen(!open)}>{open ? 'Hide autopsy' : existing || loaded ? '📝 Autopsy' : '📝 Autopsy'}</button>
      {open && (
        <span style={{ display: 'block', background: '#0f172a', padding: 12, borderRadius: 10, marginTop: 8, maxWidth: 560 }}>
          <strong style={{ fontSize: 13 }}>2-minute autopsy — {outcome === 'closed' ? 'this one closed' : 'this one fell through'}</strong>
          <span style={{ display: 'block', marginTop: 6 }}>
            <input placeholder={outcome === 'closed' ? 'Your assignment fee on this deal ($)' : 'Fee you expected ($, optional)'}
              value={fee} onChange={(e) => setFee(e.target.value)} style={{ width: 260 }} />
          </span>
          <span style={{ display: 'block', marginTop: 6 }}>
            <textarea placeholder="What worked? (the step that moved this deal)" value={worked}
              onChange={(e) => setWorked(e.target.value)} rows={2} style={{ width: '100%' }} />
          </span>
          <span style={{ display: 'block', marginTop: 6 }}>
            <textarea placeholder={outcome === 'closed' ? 'What almost killed it?' : 'What killed it?'} value={killed}
              onChange={(e) => setKilled(e.target.value)} rows={2} style={{ width: '100%' }} />
          </span>
          <span style={{ display: 'block', marginTop: 6 }}>
            <textarea placeholder="The lesson you are taking to the next deal" value={lesson}
              onChange={(e) => setLesson(e.target.value)} rows={2} style={{ width: '100%' }} />
          </span>
          {msg && <span style={{ display: 'block', fontSize: 12.5, marginTop: 6 }}>{msg}</span>}
          <button onClick={save} style={{ marginTop: 8 }}>Save autopsy</button>
          <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            Yours alone — the platform never reads, ranks, or shares your lessons.
          </span>
        </span>
      )}
    </span>
  );
}

// The wholesaler's own lessons list, shown under their escrow files.
export function AutopsyLessons() {
  const [rows, setRows] = useState<AutopsyRow[]>([]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) loadMyAutopsies(data.user.id).then(setRows).catch(() => {});
    }).catch(() => {});
  }, []);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 14, background: '#0f172a', padding: 14, borderRadius: 10 }}>
      <strong style={{ fontSize: 13.5 }}>📚 Your deal lessons — from your own autopsies</strong>
      <ul style={{ fontSize: 13, paddingLeft: 18, marginTop: 8 }}>
        {rows.map((a) => (
          <li key={a.id} style={{ marginBottom: 6 }}>
            {a.outcome === 'closed' ? '✅ Closed' : '🪦 Fell through'}
            {a.fee_amount != null ? ` · fee $${Number(a.fee_amount).toLocaleString('en-US')}` : ''}
            {a.lesson ? ` · “${a.lesson}”` : ''}
            {a.killed ? <span style={{ color: '#94a3b8' }}>{` · watch-out: ${a.killed}`}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
