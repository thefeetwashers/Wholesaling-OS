'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import {
  POF_BUCKET,
  POF_STATUS_LABELS,
  deleteMyPof,
  loadMyPof,
  submitPofDocument,
  type PofDocument,
} from '../lib/proof-of-funds';

// Slice 133 item 2 — proof-of-funds upload for the Cash Buyer
// VIP Portal (/vip). The buyer picks a file (a bank letter or
// statement, PDF or image) and it uploads into the PRIVATE
// 'buyer-pof-documents' bucket under the buyer's own user id.
// The operator reviews it and marks it verified or rejected —
// nothing here claims verification; the status shown is always
// the real row, and a verified badge appears only after the
// operator actually verifies it.
//
// Privacy: the document is private — only the buyer and the
// operator can ever open it (1-hour signed URL, operator side).
// No bank account numbers are ever displayed anywhere, and no
// document content is shown on any public page. A re-upload
// returns the status to pending review and clears any old
// verification. Upload or save failures are reported honestly,
// never as a fake success.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function ProofOfFundsUpload({ userId }: { userId: string }) {
  const [doc, setDoc] = useState<PofDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let live = true;
    loadMyPof(userId)
      .then((row) => {
        if (live) setDoc(row);
      })
      .catch((e) => {
        if (live) {
          const text = e instanceof Error ? e.message : 'Could not load your proof of funds.';
          setLoadError(
            /does not exist|relation .* does not exist|PGRST205/i.test(text)
              ? 'Proof-of-funds verification is not set up yet — run migration 20261117141000_slice133_proof_of_funds.sql first.'
              : text,
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  async function uploadFile(file: File) {
    if (!supabaseConfigured || !supabase) {
      setMsg('Storage is not configured.');
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMsg('Upload a PDF, PNG, or JPG — a bank letter or statement.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setMsg('That file is over 10 MB — upload a smaller copy.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
      const path = `${userId}/pof-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(POF_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const saved = await submitPofDocument(userId, path);
      if (doc?.storage_path && doc.storage_path !== path) {
        // The old document is replaced: remove its file so no
        // stale copy stays in the private bucket.
        await supabase.storage.from(POF_BUCKET).remove([doc.storage_path]).catch(() => undefined);
      }
      setDoc(saved);
      setMsg('Uploaded — your proof of funds is pending operator review.');
    } catch {
      setMsg('The upload failed — check the connection and try again. Nothing was saved.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeDocument() {
    if (!doc?.storage_path || !supabaseConfigured || !supabase) return;
    setBusy(true);
    setMsg('');
    try {
      await supabase.storage.from(POF_BUCKET).remove([doc.storage_path]);
      await deleteMyPof(userId);
      setDoc(null);
      setMsg('Your proof-of-funds document was removed.');
    } catch {
      setMsg('The document was not removed — try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading your proof of funds…</p>;
  }
  if (loadError) {
    return <p style={{ fontSize: 13, color: '#f87171' }}>{loadError}</p>;
  }

  const status = doc?.status ?? 'none';

  return (
    <div>
      <p style={{ fontSize: 13, margin: '0 0 6px' }}>
        Upload a bank letter or statement showing you can close. It stays private — only you and
        the operator can open it, and it is never shown on the public directory. No account
        numbers are ever displayed. The operator reviews it and marks it verified or rejected.
      </p>
      {status === 'verified' && doc?.verified_at ? (
        <p style={{ fontSize: 13, color: '#4ade80', margin: '0 0 6px' }}>
          ✓ POF verified — {formatDate(doc.verified_at)}. Your published buy box shows this badge in
          the Cash Buyers directory.
        </p>
      ) : status === 'pending' ? (
        <p style={{ fontSize: 13, color: '#fbbf24', margin: '0 0 6px' }}>
          Submitted {doc?.uploaded_at ? `on ${formatDate(doc.uploaded_at)}` : ''} — pending operator
          review. Uploading a new document replaces this one.
        </p>
      ) : status === 'rejected' ? (
        <p style={{ fontSize: 13, color: '#f87171', margin: '0 0 6px' }}>
          Not verified — the operator reviewed your document and did not accept it. Upload a new
          document and it will be reviewed again.
        </p>
      ) : (
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px' }}>
          No proof of funds submitted yet.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
          style={{ fontSize: 13, maxWidth: '100%' }}
        />
        {doc && (
          <button type="button" onClick={removeDocument} disabled={busy} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer', fontSize: 13 }}>
            Remove my document
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>
        PDF, PNG, or JPG, up to 10 MB. {doc ? `Current status: ${POF_STATUS_LABELS[doc.status]}.` : ''}
      </p>
      {msg && <p style={{ fontSize: 13, margin: '6px 0 0' }}>{msg}</p>}
    </div>
  );
}
