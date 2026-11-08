'use client';

import { useEffect, useState } from 'react';
import { createJvPost, deleteJvPost, loadJvBoard, setJvPostStatus, type JvPost } from '../lib/jv';

// Slice 69 — JV Board. Wholesalers post deals they want a partner on;
// other signed-in wholesalers see the post and the poster's email and
// reach out themselves. Discovery only — the JV split is agreed and
// signed in the Contracts desk between the two wholesalers. The
// platform takes no cut of a JV split and wires nothing.

const EMPTY = {
  title: '', property_address: '', city: '', state: '', zip: '',
  kind: 'house' as 'house' | 'land', arv: '', asking: '', split_offered: '', notes: '',
};

const money = (n?: number | null) => (n == null ? '' : `$${Math.round(Number(n)).toLocaleString('en-US')}`);

export default function JvBoard({ userId, userEmail }: { userId: string | null; userEmail: string | null }) {
  const [posts, setPosts] = useState<JvPost[] | null>(null);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => { loadJvBoard().then(setPosts).catch(() => setPosts([])); };
  useEffect(() => { refresh(); }, []);

  const mine = (posts || []).filter((p) => p.owner_id === userId);
  const board = (posts || []).filter((p) => p.status === 'open');

  const submit = async () => {
    if (!userId || !userEmail) { setMsg('Sign in first — posting needs your account.'); return; }
    if (!f.title.trim()) { setMsg('Give the deal a headline — address or a short description.'); return; }
    setBusy(true);
    const ok = await createJvPost(userId, userEmail, {
      ...f,
      owner_email: userEmail,
      arv: f.arv.trim() === '' ? null : Number(f.arv),
      asking: f.asking.trim() === '' ? null : Number(f.asking),
    });
    setBusy(false);
    setMsg(ok ? 'Posted. Every signed-in wholesaler can see it on this board.' : 'It could not be posted. Try again in a moment.');
    if (ok) { setF(EMPTY); refresh(); }
  };

  const inp = { marginRight: 6, marginTop: 4 } as const;

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>JV Board — find a partner, split the deal</h2>
      <p style={{ fontSize: 13.5, color: '#94a3b8', maxWidth: 780 }}>
        Post a deal you want a JV partner on, or pick up someone else&rsquo;s. The split is agreed between the
        two wholesalers and signed in the Contracts desk — this board is the introduction, nothing more.
        The platform takes <strong>no cut</strong> of a JV split and wires nothing. Posting shows your account
        email to signed-in wholesalers so a partner can reach you.
      </p>

      <div style={{ background: '#0f172a', padding: 14, borderRadius: 10, marginTop: 10 }}>
        <strong style={{ fontSize: 14 }}>Post a deal</strong>
        <div>
          <input placeholder="Headline — e.g. 3/2 under contract in Fort Pierce *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ ...inp, minWidth: 340 }} />
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as 'house' | 'land' })} style={inp}>
            <option value="house">House</option>
            <option value="land">Land</option>
          </select>
        </div>
        <div>
          <input placeholder="Property address" value={f.property_address} onChange={(e) => setF({ ...f, property_address: e.target.value })} style={{ ...inp, minWidth: 280 }} />
          <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} style={inp} />
          <input placeholder="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} style={{ width: 80 }} />
          <input placeholder="ZIP" value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })} style={{ width: 100 }} />
        </div>
        <div>
          <input placeholder="ARV ($) if you have one" value={f.arv} onChange={(e) => setF({ ...f, arv: e.target.value })} style={inp} />
          <input placeholder="Your contract price ($)" value={f.asking} onChange={(e) => setF({ ...f, asking: e.target.value })} style={inp} />
          <input placeholder="Split offered — e.g. 50/50" value={f.split_offered} onChange={(e) => setF({ ...f, split_offered: e.target.value })} style={inp} />
        </div>
        <div>
          <textarea placeholder="What you bring, what you need — buyer, funds for the double close, boots on the ground…"
            value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} style={{ width: '100%', maxWidth: 680, marginTop: 4 }} />
        </div>
        {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
        <button onClick={submit} disabled={busy} style={{ marginTop: 8 }}>{busy ? 'Posting…' : 'Post to the board'}</button>
      </div>

      <h3 style={{ marginTop: 18 }}>Open posts</h3>
      {posts === null ? (
        <p style={{ fontSize: 13.5 }}>Loading the board…</p>
      ) : board.length === 0 ? (
        <p style={{ fontSize: 13.5, color: '#94a3b8' }}>No open posts yet. The first deal on this board could be yours — boards fill because someone posts first.</p>
      ) : (
        <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
          {board.map((p) => (
            <li key={p.id} style={{ marginBottom: 10 }}>
              <strong>{p.title}</strong>
              {p.property_address ? ` — ${p.property_address}` : ''}{p.city ? `, ${p.city}, ${p.state || ''} ${p.zip || ''}` : ''}
              {p.arv ? ` · ARV ${money(p.arv)}` : ''}{p.asking ? ` · contract ${money(p.asking)}` : ''}
              {p.split_offered ? ` · split ${p.split_offered}` : ''}
              <br />
              <span style={{ color: '#94a3b8' }}>
                {p.kind === 'land' ? '🌱 land' : '🏠 house'} · posted by {p.owner_email}
                {p.owner_id === userId ? ' (you)' : ''}
              </span>
              {p.notes ? <><br />{p.notes}</> : null}
            </li>
          ))}
        </ul>
      )}

      {mine.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Your posts</h3>
          <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
            {mine.map((p) => (
              <li key={p.id} style={{ marginBottom: 6 }}>
                <strong>{p.title}</strong> · {p.status === 'open' ? 'Open' : 'Closed'}
                {' '}
                {p.status === 'open'
                  ? <button onClick={async () => { await setJvPostStatus(p.id!, 'closed'); refresh(); }}>Close post</button>
                  : <button onClick={async () => { await setJvPostStatus(p.id!, 'open'); refresh(); }}>Reopen</button>}
                {' '}
                <button onClick={async () => { await deleteJvPost(p.id!); refresh(); }}>Delete</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
