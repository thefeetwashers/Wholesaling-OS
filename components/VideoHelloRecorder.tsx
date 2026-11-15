'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';

// Slice 125 — the 30-second video hello. The wholesaler records
// a selfie video right here in Storefront Settings (in-browser
// MediaRecorder, no app or upload from disk needed) and it plays
// on their /sell/<slug> page. The video lives in the private
// 'storefront-videos' bucket under the wholesaler's own user id;
// the public page plays it through a short-lived signed URL
// minted per load — there is no public listing of videos, and no
// stock video or placeholder is ever shown. Recording or upload
// failures are reported honestly, never as a fake success.
// Recording stops automatically at 30 seconds.

const MAX_SECONDS = 30;

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // ignore — fall through to the default
    }
  }
  return '';
}

export default function VideoHelloRecorder({
  userId,
  videoUrl,
  onVideoChanged,
}: {
  userId: string;
  videoUrl: string;
  onVideoChanged: (path: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [supported] = useState(() => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    setMsg('');
    setPreview('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    } catch {
      setMsg('Camera or microphone could not be opened — check the browser permission and try again.');
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stopStream();
      setMsg('Recording is not supported in this browser — try Chrome or Safari on your phone.');
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      stopStream();
      if (blob.size === 0) {
        setMsg('Nothing was recorded — try again.');
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      (recorder as unknown as { _blob?: Blob })._blob = blob;
      recorderRef.current = recorder;
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    setSeconds(0);
    const started = Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) {
        stopRecording();
        return;
      }
      timerRef.current = setTimeout(tick, 250);
    };
    timerRef.current = setTimeout(tick, 250);
  };

  const stopRecording = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setRecording(false);
  };

  const uploadPreview = async () => {
    const recorder = recorderRef.current as unknown as { _blob?: Blob } | null;
    const blob = recorder?._blob;
    if (!blob) {
      setMsg('Record a video first.');
      return;
    }
    if (!supabaseConfigured || !supabase) {
      setMsg('Storage is not configured.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const path = `${userId}/hello-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('storefront-videos')
        .upload(path, blob, { contentType: blob.type || 'video/webm', upsert: false });
      if (upErr) throw upErr;
      if (videoUrl) {
        await supabase.storage.from('storefront-videos').remove([videoUrl]).catch(() => undefined);
      }
      onVideoChanged(path);
      setMsg('Saved — your video hello now plays on your seller page.');
    } catch {
      setMsg('The upload failed — check the connection and try again. Nothing was saved.');
    }
    setBusy(false);
  };

  const removeVideo = async () => {
    if (!videoUrl || !supabaseConfigured || !supabase) return;
    setBusy(true);
    setMsg('');
    await supabase.storage.from('storefront-videos').remove([videoUrl]).catch(() => undefined);
    onVideoChanged('');
    setMsg('Video removed from your seller page.');
    setBusy(false);
  };

  if (!supported) {
    return (
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Video recording needs a browser with camera access (Chrome or Safari on your phone).
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, margin: '0 0 6px' }}>
        A 30-second video hello from you — it plays at the top of your seller page so sellers meet a real person.
        Record here; nothing is saved until you tap “Save this video”.
      </p>
      {videoUrl && !preview && (
        <p style={{ fontSize: 13, color: '#4ade80', margin: '0 0 6px' }}>
          ✓ A video hello is live on your page.
        </p>
      )}
      <video ref={videoRef} playsInline muted={!preview} controls={!!preview}
        style={{ display: recording || preview ? 'block' : 'none', width: '100%', maxWidth: 360, borderRadius: 8, background: '#000', marginBottom: 8 }}
        src={preview || undefined} />
      {recording && (
        <p style={{ fontSize: 13, color: '#f87171', margin: '0 0 6px' }}>
          ● Recording… {seconds}s / {MAX_SECONDS}s — it stops automatically at {MAX_SECONDS} seconds.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!recording && (
          <button onClick={startRecording} disabled={busy}>
            {preview ? 'Record again' : videoUrl ? 'Record a new video' : '🎥 Record a 30-second video hello'}
          </button>
        )}
        {recording && <button onClick={stopRecording}>Stop recording</button>}
        {preview && !recording && (
          <button onClick={uploadPreview} disabled={busy}>{busy ? 'Saving…' : 'Save this video'}</button>
        )}
        {videoUrl && !recording && (
          <button onClick={removeVideo} disabled={busy}>Remove my video</button>
        )}
      </div>
      {msg && <p style={{ fontSize: 13, margin: '6px 0 0' }}>{msg}</p>}
    </div>
  );
}
