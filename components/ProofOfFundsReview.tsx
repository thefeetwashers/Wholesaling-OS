'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  POF_STATUS_LABELS,
  loadAllPofDocuments,
  mintPofSignedUrl,
  setPofStatus,
  type PofDocument,
} from '../lib/proof-of-funds';

// Slice 133 item 2 — operator proof-of-funds review, rendered
// inside components/OperatorStats.tsx (the operator's triage
// panel — it already holds the problem-report triage and managed
// disposition requests; the SaaS Admin dashboard is billing, not
// verification, so this does not belong there).
//
// Lists every submitted document, pending first. The operator
// opens a document through a 1-hour signed URL minted with their
// own session (the storage policies allow only the owner or the
// operator), then marks it Verified or Rejected. Verified writes
// only: the decision selects its row back, and the list updates
// only after the save succeeds — a refused save shows an error,
// never a fake decision. No bank account numbers are ever shown:
// the list shows only the buyer's user id, the upload date, and
// the status. The document itself opens in a new tab; the app
// never renders or extracts its contents.

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function ProofOfFundsReview() {
  const [docs, setDocs] = useState<PofDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [operatorUserId, setOperatorUserId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!supabase) throw new Error('Supabase is not configured on this deployment.');
        const { data: userData } = await supabase.auth.getUser();
        if (live) setOperatorUserId(userData.user?.id || null);
        const rows = await loadAllPofDocuments();
        if (live) setDocs(rows);
      } catch (e) {
        if (live) {
          const text = e instanceof Error ? e.message : 'Could not load proof-of-funds documents.';
          setLoadError(
            /does not exist|relation .* does not exist|PGRST205/i.test(text)
              ? 'The buyer_pof_documents table does not exist yet — run migration 20261117141000_slice133_proof_of_funds.sql first.'
              : text,
          );
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  async function decide(doc: PofDocument, status: 'verified' | 'rejected') {
    if (!doc.id || !operatorUserId) return;
    setSavingId(doc.id);
    setMsg('');
    try {
      const saved = await setPofStatus(doc.id, status, operatorUserId);
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? saved : d)));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'The decision did not save.');
    } finally {
      setSavingId(null);
    }
  }

  async function viewDocument(doc: PofDocument) {
    if (!doc.id || !doc.storage_path) return;
    setViewingId(doc.id);
    setMsg('');
    const url = await mintPofSignedUrl(doc.storage_path);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setMsg('The document could not be opened — the file may have been removed, or the Slice 133 migration has not been applied yet.');
    }
    setViewingId(null);
  }

  if (loading) return <p style={{ fontSize: 13, color: '#cbd5e1' }}>Loading proof-of-funds documents…</p>;
  if (loadError) return <p style={{ fontSize: 13, color: '#fca5a5' }}>{loadError}</p>;

  const pending = docs.filter((d) => d.status === 'pending');
  const decided = docs.filter((d) => d.status !== 'pending');

  return (
    <div>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Buyers upload a bank letter or statement; you check it and mark it verified or rejected.
        A verified buyer&apos;s published buy box shows &ldquo;POF verified&rdquo; with the date in
        the Cash Buyers directory. Documents stay private — they open only through a 1-hour link,
        and no account numbers are ever shown here.
      </p>
      {msg && <p style={{ fontSize: 13, color: '#fca5a5' }}>{msg}</p>}
      <h4 style={{ marginTop: 12 }}>Pending review ({pending.length})</h4>
      {pending.length === 0 ? (
        <p style={{ fontSize: 13 }}>No proof-of-funds documents waiting for review.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {pending.map((d) => (
            <li key={d.id} style={{ marginBottom: 12, background: '#0f172a', padding: 12, borderRadius: 10, color: '#e2e8f0' }}>
              Buyer {d.user_id}
              {d.uploaded_at ? ` · uploaded ${formatDate(d.uploaded_at)}` : ''}
              <br />
              <button disabled={viewingId === d.id} onClick={() => viewDocument(d)} style={{ marginTop: 6, marginRight: 6 }}>
                {viewingId === d.id ? 'Opening…' : 'View document'}
              </button>
              <button
                disabled={savingId === d.id || !operatorUserId}
                onClick={() => decide(d, 'verified')}
                style={{ marginTop: 6, marginRight: 6, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
              >
                Verify
              </button>
              <button
                disabled={savingId === d.id || !operatorUserId}
                onClick={() => decide(d, 'rejected')}
                style={{ marginTop: 6, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
              >
                Reject
              </button>
            </li>
          ))}
        </ul>
      )}
      {decided.length > 0 && (
        <>
          <h4 style={{ marginTop: 12 }}>Decided ({decided.length})</h4>
          <ul style={{ fontSize: 13 }}>
            {decided.map((d) => (
              <li key={d.id} style={{ marginBottom: 6 }}>
                Buyer {d.user_id} · {POF_STATUS_LABELS[d.status]}
                {d.status === 'verified' && d.verified_at ? ` — ${formatDate(d.verified_at)}` : ''}
                {d.uploaded_at ? ` · uploaded ${formatDate(d.uploaded_at)}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
