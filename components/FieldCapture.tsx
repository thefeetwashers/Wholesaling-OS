'use client';

import { useRef, useState } from 'react';
import { saveLead, type Lead } from '../lib/leads';

// Slice 85 — Field Capture: the driving-for-dollars quick-add.
// Built for a phone in one hand at the curb: big fields, big
// buttons, the fewest possible keystrokes between "that house
// looks vacant" and a saved lead. Two honest helpers:
//  - GPS stamp: your browser's own location, added to the lead's
//    notes only when you tap for it. Nothing is tracked in the
//    background; no stamp exists unless you ask for one.
//  - Voice note: your browser's built-in speech-to-text fills the
//    notes box. No recording is saved anywhere — the words land
//    as text you can edit before saving. Browsers without speech
//    recognition say so plainly and typing still works.

const big: React.CSSProperties = { fontSize: 17, padding: '13px 12px', borderRadius: 10, width: '100%', boxSizing: 'border-box' };

interface GpsStamp { lat: number; lng: number; accuracy: number }

export default function FieldCapture({ userId }: { userId: string }) {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [county, setCounty] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<GpsStamp | null>(null);
  const [gpsNote, setGpsNote] = useState('');
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechCtor = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined;

  const stampGps = () => {
    setGpsNote('');
    if (!('geolocation' in navigator)) { setGpsNote('This browser has no location service — the address alone still saves fine.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
        setGpsNote('Location stamped — it will be saved in the lead’s notes.');
      },
      () => { setGps(null); setGpsNote('Location wasn’t available (denied or no fix). The address alone still saves fine.'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const toggleDictation = () => {
    if (!speechCtor) return;
    if (listening && recRef.current) { recRef.current.stop(); return; }
    // eslint-disable-next-line @typescript-eslint/no-new, @typescript-eslint/no-explicit-any
    const rec: any = new speechCtor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text) setNotes((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const save = async () => {
    if (!address.trim()) { setErr('The property address is the one thing this needs.'); return; }
    setBusy(true); setErr(''); setSaved('');
    const lines = [notes.trim()];
    if (gps) lines.push(`GPS stamp: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} (±${gps.accuracy} m)`);
    lines.push(`Captured in the field — ${new Date().toLocaleString('en-US')}`);
    const lead: Lead = {
      property_address: address.trim(),
      city: city.trim(), state: state.trim(), zip: zip.trim(), county: county.trim(),
      owner_name: ownerName.trim(),
      phones: [], emails: [],
      list_source: 'Field capture',
      status: 'new',
      notes: lines.filter(Boolean).join('\n'),
      consent_status: 'unknown',
    };
    try {
      const row = await saveLead(userId, lead);
      if (!row) throw new Error('not saved');
      setSaved(`Saved: ${row.property_address} — it's in your Leads and on the Pipeline Board.`);
      setAddress(''); setOwnerName(''); setNotes(''); setGps(null); setGpsNote('');
    } catch {
      setErr('That did not save. Check your connection and try again — nothing was recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, maxWidth: 560 }}>
      <h2>📍 Field Capture — spot it, save it</h2>
      <p style={{ fontSize: 13.5, color: '#94a3b8' }}>
        For driving for dollars and walking a street: address first, details if you have them, gone in
        under a minute. The lead lands in Leads as "Field capture". Add photos afterwards from the
        lead's 📷 Photos panel.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        <input style={big} placeholder="Property address *" value={address} onChange={(e) => setAddress(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px', gap: 10 }}>
          <input style={big} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <input style={big} placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
          <input style={big} placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} />
        </div>
        <input style={big} placeholder="County" value={county} onChange={(e) => setCounty(e.target.value)} />
        <input style={big} placeholder="Owner name (if you know it)" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        <textarea style={{ ...big, minHeight: 84 }} placeholder="What did you see? Boarded windows, mail piled up, tarp on the roof…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" onClick={stampGps} style={{ fontSize: 16, padding: '12px 16px', borderRadius: 10, cursor: 'pointer' }}>
          📍 {gps ? 'Location stamped ✓' : 'Stamp my location'}
        </button>
        {speechCtor ? (
          <button type="button" onClick={toggleDictation} style={{ fontSize: 16, padding: '12px 16px', borderRadius: 10, cursor: 'pointer' }}>
            🎙️ {listening ? 'Stop dictation' : 'Dictate the note'}
          </button>
        ) : (
          <span style={{ fontSize: 13, color: '#94a3b8', alignSelf: 'center' }}>
            Voice dictation isn't available in this browser — typing works everywhere. No recording is ever saved.
          </span>
        )}
      </div>
      {gpsNote && <p style={{ fontSize: 13, color: '#94a3b8' }}>{gpsNote}</p>}
      {listening && <p style={{ fontSize: 13.5 }}>Listening… speak the note; it lands as editable text. No recording is saved.</p>}
      <button type="button" onClick={() => void save()} disabled={busy}
        style={{ fontSize: 18, padding: '15px 20px', borderRadius: 10, width: '100%', marginTop: 14, cursor: 'pointer', background: '#065f46', color: '#fff', border: 'none' }}>
        {busy ? 'Saving…' : 'Save this lead'}
      </button>
      {saved && <p style={{ fontSize: 14.5, color: '#34d399' }}>{saved}</p>}
      {err && <p style={{ fontSize: 14.5, color: '#fbbf24' }}>{err}</p>}
    </section>
  );
}
