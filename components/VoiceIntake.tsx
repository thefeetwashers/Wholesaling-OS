'use client';

import { useEffect, useRef, useState } from 'react';
import { checkPhone } from '../lib/phone';
import { detectCallerType, splitSpokenAddress, type CallerType } from '../lib/voice-intake';

// Slice 41 — voice intake on the public seller page. Visitor-initiated
// only: it never calls or messages anyone; it answers here, for a
// person who tapped "Talk to us". It labels itself as automated in
// its first line. The browser does the listening (Web Speech) and the
// speaking (speechSynthesis); the questions are a fixed script — the
// same fields the typed form collects — and every question also has a
// typed fallback. Only the confirmed fields are sent, to /api/intake,
// which creates the lead server-side. The conversation itself is
// never stored or sent anywhere. On browsers without speech
// recognition the widget does not render at all and the form below
// remains the intake.
//
// Speech recognition types are not in the standard TS DOM lib, so the
// minimal surface used here is declared locally.

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type Step = 'idle' | 'caller' | 'name' | 'phone' | 'address' | 'price' | 'confirm' | 'sending' | 'done' | 'failed';

interface Line { who: 'assistant' | 'visitor'; text: string }

export default function VoiceIntake({ slug, company }: { slug: string; company: string }) {
  const [supported, setSupported] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState('');
  const [listening, setListening] = useState(false);
  const [phoneTries, setPhoneTries] = useState(0);
  const [fields, setFields] = useState({ caller_type: 'unknown' as CallerType, owner_name: '', phone: '', property_address: '', city: '', state: '', zip: '', asking_price: '' });
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSupported(typeof w.SpeechRecognition === 'function' || typeof w.webkitSpeechRecognition === 'function');
  }, []);

  if (!supported) return null;

  const speak = (text: string) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      window.speechSynthesis.speak(u);
    } catch { /* speaking is an enhancement; the text is on screen */ }
  };

  const say = (text: string) => {
    setLines((prev) => [...prev, { who: 'assistant', text }]);
    speak(text);
  };

  const start = () => {
    setFields({ caller_type: 'unknown', owner_name: '', phone: '', property_address: '', city: '', state: '', zip: '', asking_price: '' });
    setLines([]);
    setPhoneTries(0);
    setStep('caller');
    say(`Hi, I'm the automated intake assistant for ${company}. I can take your details by voice and save them for ${company} to review — it takes about a minute. Only the details you confirm at the end are saved; this conversation is not stored. First: are you looking to sell a property, or are you a buyer?`);
  };

  const submit = async (f: typeof fields) => {
    setStep('sending');
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, website: '', ...f }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && j.ok) {
        setStep('done');
        say(`Thank you, ${f.owner_name.split(' ')[0] || 'there'}. ${company} has your details and will reach out shortly.`);
      } else {
        setStep('failed');
        say(`I couldn't save that just now${j.error ? ` — ${j.error}` : ''}. Please use the form below instead; it goes to the same place.`);
      }
    } catch {
      setStep('failed');
      say('I couldn\'t save that just now. Please use the form below instead; it goes to the same place.');
    }
  };

  const answer = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setLines((prev) => [...prev, { who: 'visitor', text }]);
    setTyped('');
    if (step === 'caller') {
      const ct = detectCallerType(text);
      const next = { ...fields, caller_type: ct };
      setFields(next);
      setStep('name');
      say(ct === 'buyer' ? 'Great — we work with buyers too. What is your full name?' : 'Thanks. What is your full name?');
    } else if (step === 'name') {
      setFields({ ...fields, owner_name: text });
      setStep('phone');
      say(`Thanks, ${text.split(' ')[0]}. What is the best phone number to reach you?`);
    } else if (step === 'phone') {
      const check = checkPhone(text);
      if (!check.valid && phoneTries < 1) {
        setPhoneTries(phoneTries + 1);
        say(`I want to make sure ${company} can reach you — that number looks off: ${check.reason}. Could you say it once more, slowly?`);
        return;
      }
      const next = { ...fields, phone: check.valid && check.e164 ? check.e164 : text };
      setFields(next);
      setStep('address');
      say(fields.caller_type === 'buyer'
        ? 'And which area are you looking to buy in? City, state, and ZIP is fine.'
        : 'Now the property address — street, city, state, and ZIP.');
    } else if (step === 'address') {
      const parts = splitSpokenAddress(text);
      setFields({ ...fields, ...parts });
      setStep('price');
      say(fields.caller_type === 'buyer'
        ? 'What budget range are you working with?'
        : 'Do you have an asking price in mind? You can also say "not sure".');
    } else if (step === 'price') {
      const next = { ...fields, asking_price: /not sure|no idea|don't know/i.test(text) ? '' : text };
      setFields(next);
      setStep('confirm');
      say(`Here's what I have: ${next.owner_name}, phone ${next.phone || 'not given'}, ${fields.caller_type === 'buyer' ? 'buying' : 'selling'} — ${next.property_address}${next.asking_price ? `, ${fields.caller_type === 'buyer' ? 'budget' : 'asking'} ${next.asking_price}` : ''}. Say "yes" to save it, or "start over" to redo it.`);
    } else if (step === 'confirm') {
      if (/^(yes|yeah|yep|correct|save|ok|okay|sure)\b/i.test(text)) {
        void submit(fields);
      } else if (/start over|redo|restart/i.test(text)) {
        start();
      } else {
        say('Say "yes" to save these details, or "start over" to redo them.');
      }
    }
  };

  const listen = () => {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
    if (!Ctor) return;
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const transcript = ev.results[0][0].transcript;
      setListening(false);
      answer(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const active = step !== 'idle' && step !== 'done';

  return (
    <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
      <h2>Prefer to talk? 🎙️</h2>
      {step === 'idle' && (
        <>
          <p style={{ fontSize: 14 }}>
            Talk through your details with {company}'s automated intake assistant instead of typing —
            about a minute. It never calls you; it only answers here, on this page.
          </p>
          <button onClick={start} style={{ fontSize: 15, padding: '10px 22px' }}>Talk to us</button>
        </>
      )}
      {lines.map((l, i) => (
        <p key={i} style={{ fontSize: 14, margin: '6px 0', color: l.who === 'assistant' ? '#e2e8f0' : '#93c5fd' }}>
          <strong>{l.who === 'assistant' ? 'Assistant: ' : 'You: '}</strong>{l.text}
        </p>
      ))}
      {active && step !== 'sending' && (
        <div style={{ marginTop: 10 }}>
          <button onClick={listen} disabled={listening} style={{ padding: '8px 18px' }}>
            {listening ? 'Listening…' : '🎙️ Tap and speak'}
          </button>
          <span style={{ margin: '0 8px', fontSize: 13, color: '#94a3b8' }}>or type:</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') answer(typed); }}
            placeholder="Type your answer" style={{ minWidth: 220 }} />
          <button onClick={() => answer(typed)} style={{ marginLeft: 6 }}>Send</button>
        </div>
      )}
      {step === 'sending' && <p style={{ fontSize: 14 }}>Saving…</p>}
      {step === 'done' && <p style={{ fontSize: 14.5 }}>✅ Saved. {company} will reach out shortly — nothing else you need to do.</p>}
      {step === 'failed' && <p style={{ fontSize: 13.5, color: '#fbbf24' }}>That didn't save — please use the form below; it goes to the same place.</p>}
    </section>
  );
}
