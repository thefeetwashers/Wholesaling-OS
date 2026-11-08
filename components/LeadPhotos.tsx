'use client';

import { useEffect, useRef, useState } from 'react';
import {
  loadLeadPhotos, uploadLeadPhoto, deleteLeadPhoto, MAX_PHOTOS_PER_LEAD, type LeadPhoto,
} from '../lib/photos';
import type { Lead } from '../lib/leads';

// Slice 84 — photo attachments on a lead. The wholesaler's own
// walk-through photos (and any a seller sent through the seller
// page, labeled as such) live in the private lead-photos bucket;
// this panel mints short-lived signed URLs so only this account
// can open them.

export default function LeadPhotos({ userId, lead }: { userId: string; lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<LeadPhoto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    if (!lead.id) return;
    loadLeadPhotos(userId, lead.id).then(setPhotos).catch(() => setPhotos([]));
  };

  useEffect(() => { if (open && photos === null) refresh(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFiles = async (files: FileList | null) => {
    if (!files || !lead.id) return;
    setBusy(true); setNote('');
    try {
      const list = Array.from(files);
      for (const f of list) {
        if ((photos?.length || 0) >= MAX_PHOTOS_PER_LEAD) { setNote(`Up to ${MAX_PHOTOS_PER_LEAD} photos per lead.`); break; }
        await uploadLeadPhoto(userId, lead.id, f);
      }
      refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Upload failed.');
      refresh();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (p: LeadPhoto) => {
    setBusy(true);
    try { await deleteLeadPhoto(userId, p); } catch { /* the refresh shows the true state */ }
    setBusy(false);
    refresh();
  };

  if (!open) {
    return (
      <div style={{ marginTop: 6 }}>
        <button type="button" onClick={() => setOpen(true)}>📷 Photos</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 10, padding: 12 }}>
      <strong style={{ fontSize: 13.5 }}>📷 Photos — private to your account</strong>
      <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '4px 0 8px' }}>
        Walk-through shots, condition photos, paperwork snaps. Images only, 5 MB each, up to {MAX_PHOTOS_PER_LEAD} per
        lead. Only you can open them — every view is a short-lived signed link. Photos a seller sends through
        your seller page land here too, labeled "from seller".
      </p>
      {photos === null ? (
        <p style={{ fontSize: 13 }}>Loading…</p>
      ) : photos.length === 0 ? (
        <p style={{ fontSize: 13 }}>No photos on this lead yet.</p>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {photos.map((p) => (
            <figure key={p.id} style={{ margin: 0, width: 96 }}>
              {p.url
                ? <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.file_name || 'lead photo'} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 6 }} /></a>
                : <div style={{ width: 96, height: 72, background: '#1e293b', borderRadius: 6 }} />}
              <figcaption style={{ fontSize: 11, color: '#94a3b8', wordBreak: 'break-all' }}>
                {p.source === 'seller' ? 'from seller · ' : ''}{p.file_name || 'photo'}
              </figcaption>
              <button type="button" disabled={busy} onClick={() => remove(p)} style={{ fontSize: 11.5 }}>Delete</button>
            </figure>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <input ref={fileRef} type="file" accept="image/*" multiple disabled={busy} onChange={(e) => void onFiles(e.target.files)} />
        {busy && <span style={{ fontSize: 12.5 }}> Working…</span>}
        {note && <span style={{ fontSize: 12.5, color: '#fbbf24' }}> {note}</span>}
        {' '}
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: 12 }}>Close</button>
      </div>
    </div>
  );
}
