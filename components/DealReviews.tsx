'use client';

import { useEffect, useState } from 'react';
import { loadReviews, addReview, deleteReview, reviewAskText, type DealReview } from '../lib/reviews';

// Slice 88 — reviews after closing, mounted on a closed escrow
// file beside its Deal Autopsy. Two halves, both honest:
//  - ASK: a written request the wholesaler sends through their
//    own email app (mailto) or pastes into a text — the platform
//    sends nothing itself, and the wording asks for permission
//    before anything may be quoted.
//  - RECORD: when a reply actually comes back, the wholesaler
//    records it verbatim — name, role, rating, the words, and
//    the permission flag exactly as given. No seeds, no imports.

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export default function DealReviews({ userId, escrowFileId, outcome }: { userId: string | null; escrowFileId?: string; outcome: string }) {
  const [reviews, setReviews] = useState<DealReview[] | null>(null);
  const [askRole, setAskRole] = useState<'buyer' | 'seller'>('buyer');
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [permission, setPermission] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = () => {
    if (!userId || !escrowFileId) return;
    loadReviews(userId, escrowFileId).then(setReviews).catch(() => setReviews([]));
  };

  useEffect(() => { if (outcome === 'closed') refresh(); }, [escrowFileId, outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  if (outcome !== 'closed' || !escrowFileId || !userId) return null;

  const ask = reviewAskText(askRole);
  const mailto = `mailto:?subject=${encodeURIComponent('Thank you — one small favor')}&body=${encodeURIComponent(ask)}`;

  const save = async () => {
    if (!name.trim()) { setMsg('The reviewer’s name is required — a review without a person is not a review.'); return; }
    try {
      await addReview(userId, {
        escrow_file_id: escrowFileId, reviewer_role: role, reviewer_name: name,
        rating, review_text: text, publish_permission: permission,
      });
      setName(''); setText(''); setRating(5); setPermission(false);
      setMsg('Recorded.');
      refresh();
    } catch {
      setMsg('That did not save. Try again.');
    }
  };

  return (
    <div style={{ marginTop: 12, background: '#0f172a', borderRadius: 10, padding: 14 }}>
      <strong style={{ fontSize: 14 }}>⭐ Reviews — ask, then record what actually comes back</strong>
      <div style={{ marginTop: 8, fontSize: 13.5 }}>
        Ask the{' '}
        <select value={askRole} onChange={(e) => setAskRole(e.target.value as 'buyer' | 'seller')}>
          <option value="buyer">buyer</option>
          <option value="seller">seller</option>
        </select>{' '}
        <a href={mailto}>Open in your email app ↗</a>{' '}
        <button type="button" onClick={() => { void navigator.clipboard.writeText(ask).then(() => setCopied(true)).catch(() => setCopied(false)); }}>
          {copied ? 'Copied ✓' : 'Copy the ask'}
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
        The platform sends nothing — you ask through your own channels, and the wording asks for
        permission before anything may be quoted.
      </p>
      {reviews === null ? (
        <p style={{ fontSize: 13 }}>Loading…</p>
      ) : reviews.length === 0 ? (
        <p style={{ fontSize: 13 }}>No reviews recorded for this closing yet.</p>
      ) : (
        <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
          {reviews.map((r) => (
            <li key={r.id || r.reviewer_name} style={{ marginBottom: 6 }}>
              <span aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</span> — {r.reviewer_name} ({r.reviewer_role})
              {r.review_text ? <><br />“{r.review_text}”</> : ''}
              <br />
              <span style={{ color: '#94a3b8', fontSize: 12.5 }}>
                {r.publish_permission ? 'Permission to publish: yes' : 'Permission to publish: not given — keep private'}
              </span>{' '}
              {r.id && <button type="button" onClick={() => { void deleteReview(userId, r.id!).then(refresh).catch(() => setMsg('Delete failed.')); }}>Delete</button>}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'grid', gap: 6, marginTop: 8, maxWidth: 520 }}>
        <input placeholder="Reviewer's name *" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13.5 }}>
          <label>Role{' '}
            <select value={role} onChange={(e) => setRole(e.target.value as 'buyer' | 'seller')}>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
          </label>
          <label>Rating{' '}
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} of 5</option>)}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} />{' '}
            They said we may publish this
          </label>
        </div>
        <textarea placeholder="Their words, exactly as they wrote them" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" onClick={() => void save()} style={{ cursor: 'pointer' }}>Record this review</button>
        {msg && <span style={{ fontSize: 12.5 }}>{msg}</span>}
      </div>
    </div>
  );
}
