'use client';

import { useEffect, useState } from 'react';
import { loadMyProfile, loadMyReferrals, submitReferral, type Referral, type ReferralStatus } from '../lib/portals';

// Slice 64 — Referrer lane home. A referrer reports a seller THEY found
// to the platform owner and sees only their own submissions with a
// plain status word. They never browse other sellers, other referrers,
// or anyone's workspace — there is nothing here to browse. The $1,000
// is earned when the referred deal closes and funds, and is recorded
// on the deal by the operator; it is never promised sooner.

const STATUS_WORDS: Record<ReferralStatus, string> = {
  received: 'Received',
  working: 'In progress',
  closed: 'Closed — $1,000 earned',
  dead: 'Not moving forward',
};

const EMPTY = {
  seller_name: '', property_address: '', city: '', state: '', zip: '',
  seller_phone: '', seller_email: '', relationship: '', notes: '',
};

export default function ReferrerPortal({ userId }: { userId: string }) {
  const [email, setEmail] = useState('');
  const [mine, setMine] = useState<Referral[] | null>(null);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => { loadMyReferrals(userId).then(setMine).catch(() => setMine([])); };

  useEffect(() => {
    loadMyProfile(userId).then((p) => setEmail(p?.email || '')).catch(() => {});
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const submit = async () => {
    if (!f.property_address.trim()) { setMsg('Add the property address — that is the one thing we must have.'); return; }
    if (!f.relationship.trim()) { setMsg('Tell us how you know this seller — every referral carries its source.'); return; }
    setBusy(true);
    const ok = await submitReferral(userId, email, { ...f, referrer_email: email });
    setBusy(false);
    if (ok) {
      setMsg('Sent. The operator has it now — watch this page for its status.');
      setF(EMPTY);
      refresh();
    } else {
      setMsg('It could not be sent. Try again in a moment.');
    }
  };

  const inp = { marginRight: 6, marginTop: 4 } as const;

  return (
    <div style={{ marginTop: 12 }}>
      <section style={{ background: '#0f172a', padding: 16, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>🤝 Refer a seller — earn $1,000 when it closes</h3>
        <p style={{ fontSize: 13.5, color: '#cbd5e1', maxWidth: 760 }}>
          Know a homeowner who needs to sell? Report them here — with how you know them, because every
          referral on this platform carries its source. The operator works the referral like any other
          lead, under the same consent rules. When that deal <strong>closes and funds</strong>, you earn
          <strong> $1,000</strong>, recorded on the deal itself. Nothing is owed for a referral that
          doesn&rsquo;t close — that&rsquo;s the deal, stated plainly before you send anyone&rsquo;s name.
        </p>
        <div>
          <input placeholder="Seller's full name" value={f.seller_name} onChange={(e) => setF({ ...f, seller_name: e.target.value })} style={{ ...inp, minWidth: 220 }} />
          <input placeholder="Seller's phone (if you have it)" value={f.seller_phone} onChange={(e) => setF({ ...f, seller_phone: e.target.value })} style={inp} />
          <input placeholder="Seller's email (if you have it)" value={f.seller_email} onChange={(e) => setF({ ...f, seller_email: e.target.value })} style={{ ...inp, minWidth: 220 }} />
        </div>
        <div>
          <input placeholder="Property address *" value={f.property_address} onChange={(e) => setF({ ...f, property_address: e.target.value })} style={{ ...inp, minWidth: 300 }} />
          <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} style={inp} />
          <input placeholder="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} style={{ width: 80 }} />
          <input placeholder="ZIP" value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })} style={{ width: 100 }} />
        </div>
        <div>
          <input placeholder="How do you know this seller? *" value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })} style={{ ...inp, minWidth: 340 }} />
        </div>
        <div>
          <textarea placeholder="Anything the operator should know — situation, timeline, condition."
            value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} style={{ width: '100%', maxWidth: 640, marginTop: 4 }} />
        </div>
        {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
        <button onClick={submit} disabled={busy} style={{ marginTop: 8 }}>{busy ? 'Sending…' : 'Send this referral'}</button>
      </section>

      <section style={{ background: '#0f172a', padding: 16, borderRadius: 10, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Your referrals</h3>
        {mine === null ? (
          <p style={{ fontSize: 13 }}>Loading…</p>
        ) : mine.length === 0 ? (
          <p style={{ fontSize: 13.5, color: '#94a3b8' }}>None yet. Your first referral could be the house on your own street.</p>
        ) : (
          <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
            {mine.map((r) => (
              <li key={r.id} style={{ marginBottom: 6 }}>
                <strong>{r.property_address}</strong>{r.city ? ` — ${r.city}, ${r.state || ''}` : ''}
                {' '}· {STATUS_WORDS[r.status]}
                {r.seller_name ? ` · seller: ${r.seller_name}` : ''}
              </li>
            ))}
          </ul>
        )}
        <p style={{ fontSize: 12, color: '#94a3b8' }}>
          You see only your own referrals — never anyone else&rsquo;s sellers, and no one sees yours.
        </p>
      </section>
    </div>
  );
}
