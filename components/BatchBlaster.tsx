// Slice 134 — BatchBlaster: throttled batch SMS blaster (BYOK).
//
// Rendered INSIDE the SmsInbox view — not a standalone page.
// Human tap only: Send starts only on click, Stop halts
// immediately. One recipient per send-buyer-blast call, one every
// interval — the pacing lives here, with setTimeout.
//
// Honest limits, stated in the UI:
//   * The queue runs in this tab — if the tab closes, the queue
//     stops (a server-side queue is a later step).
//   * Invalid numbers are dropped before sending and reported —
//     never sent to.
//   * Numbers matching one of THIS wholesaler's own cash buyers
//     with sms_opt_out = true are filtered out and reported; the
//     dispatcher re-checks opt-out at send time too.
//   * The from-number comes from the caller's own
//     wholesaler_provider_settings row (twilio_from_number,
//     explicit column select — never a star select). It is never
//     invented here; with none saved, the dispatcher resolves the
//     caller's own number when it sends.
//   * Every send is logged by the dispatcher server-side — the
//     browser does NOT write to sms_messages (no double-logging).
//   * Nothing is reported sent unless the dispatcher says so; a
//     not-deployed function or unconnected provider halts the
//     queue with that honest message.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import {
  parsePastedNumbers,
  normalizeSmsPhones,
  loadBuyerOptOutPhones,
  isOptedOutPhone,
  invokeSendBuyerBlast,
} from '../lib/sms';

const MIN_INTERVAL_SEC = 5;
const MAX_INTERVAL_SEC = 120;
const DEFAULT_INTERVAL_SEC = 20;

function clampInterval(v: number): number {
  if (Number.isNaN(v)) return DEFAULT_INTERVAL_SEC;
  return Math.min(MAX_INTERVAL_SEC, Math.max(MIN_INTERVAL_SEC, Math.round(v)));
}

export default function BatchBlaster({ userId }: { userId: string }) {
  const [numbersText, setNumbersText] = useState('');
  const [message, setMessage] = useState('');
  const [intervalSec, setIntervalSec] = useState(DEFAULT_INTERVAL_SEC);
  const [fromNumber, setFromNumber] = useState<string | null>(null);
  const [fromState, setFromState] = useState<'loading' | 'saved' | 'missing' | 'unknown'>('loading');
  const [optedOut, setOptedOut] = useState<Set<string>>(new Set());
  const [optOutUnknown, setOptOutUnknown] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'stopped'>('idle');
  const [sent, setSent] = useState(0);
  const [failed, setFailed] = useState(0);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState('');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef(false);
  const sentRef = useRef(0);
  const failedRef = useRef(0);
  const indexRef = useRef(0);
  const totalRef = useRef(0);

  // The sending number is the dispatcher's own-keys resolution —
  // read here only to show it. Explicit column, own row only.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!supabaseConfigured || !supabase) {
          if (live) setFromState('unknown');
          return;
        }
        const { data, error } = await supabase
          .from('wholesaler_provider_settings')
          .select('twilio_from_number')
          .eq('user_id', userId)
          .maybeSingle();
        if (!live) return;
        if (error) {
          // Column lands with the Slice 134 migration; before it
          // applies the select errors — unknown, never invented.
          setFromState('unknown');
          return;
        }
        const num =
          data && typeof (data as { twilio_from_number?: unknown }).twilio_from_number === 'string'
            ? ((data as { twilio_from_number: string }).twilio_from_number as string).trim()
            : '';
        if (num) {
          setFromNumber(num);
          setFromState('saved');
        } else {
          setFromState('missing');
        }
      } catch {
        if (live) setFromState('unknown');
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  // The caller's own opted-out buyers, for the pre-send filter.
  useEffect(() => {
    let live = true;
    loadBuyerOptOutPhones(userId)
      .then((r) => {
        if (!live) return;
        setOptedOut(r.optedOut);
        setOptOutUnknown(r.optOutUnknown);
      })
      .catch(() => {
        if (live) setOptOutUnknown(true);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  // A running queue stops with the tab — clear the timer on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const parsed = useMemo(() => {
    const entries = parsePastedNumbers(numbersText);
    const { valid, invalid } = normalizeSmsPhones(entries);
    const optedOutFiltered = valid.filter((p) => isOptedOutPhone(p, optedOut));
    const eligible = valid.filter((p) => !isOptedOutPhone(p, optedOut));
    return { valid, invalid, optedOutFiltered, eligible };
  }, [numbersText, optedOut]);

  const stopQueue = (note: string) => {
    stopRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const done = sentRef.current + failedRef.current;
    setPhase('stopped');
    setCurrent(null);
    setResult(`${note} Stopped at ${done} of ${totalRef.current} — sent ${sentRef.current}, failed ${failedRef.current}.`);
  };

  const startSend = () => {
    if (phase === 'running') return;
    const body = message.trim();
    if (!body) {
      setResult('Write the message first — nothing was sent.');
      return;
    }
    const list = parsed.eligible;
    if (list.length === 0) {
      setResult('No numbers to send to — paste valid numbers that have not opted out. Nothing was sent.');
      return;
    }
    const intervalMs = clampInterval(intervalSec) * 1000;
    stopRef.current = false;
    sentRef.current = 0;
    failedRef.current = 0;
    indexRef.current = 0;
    totalRef.current = list.length;
    setSent(0);
    setFailed(0);
    setTotal(list.length);
    setCurrentIndex(0);
    setCurrent(list[0]);
    setResult('');
    setPhase('running');

    const step = async () => {
      if (stopRef.current) return;
      const i = indexRef.current;
      if (i >= list.length) {
        setPhase('done');
        setCurrent(null);
        setResult(
          `Done — sent ${sentRef.current} of ${list.length}, ${failedRef.current} failed.`,
        );
        return;
      }
      const to = list[i];
      setCurrent(to);
      setCurrentIndex(i + 1);
      const res = await invokeSendBuyerBlast({ channel: 'sms', to, to_number: to, body });
      if (stopRef.current) return;
      if (res.notDeployed || res.notConfigured) {
        // A missing function or unconnected provider halts the
        // queue — hammering it once per recipient would be worse.
        stopQueue(res.error || 'Sending stopped.');
        return;
      }
      if (res.ok) {
        sentRef.current += 1;
        setSent(sentRef.current);
      } else {
        failedRef.current += 1;
        setFailed(failedRef.current);
      }
      indexRef.current = i + 1;
      if (indexRef.current >= list.length) {
        setPhase('done');
        setCurrent(null);
        setResult(
          `Done — sent ${sentRef.current} of ${list.length}, ${failedRef.current} failed.`,
        );
        return;
      }
      timerRef.current = setTimeout(step, intervalMs);
    };
    void step();
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontSize: 13 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 10 };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: 16 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Batch blaster — one text at a time, on your number</h3>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 8px' }}>
        Paste numbers, write one message, and send it to each number in turn, paced so carriers
        don&apos;t see a burst. Human tap only — Send starts on your click, Stop halts immediately.
      </p>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 8px' }}>
        Sending from:{' '}
        {fromState === 'loading' && 'checking your provider settings…'}
        {fromState === 'saved' && fromNumber}
        {fromState === 'missing' &&
          'no sending number saved — connect your own SMS provider in My Providers first. The dispatcher will not invent one.'}
        {fromState === 'unknown' &&
          'could not be checked yet — the provider-settings column is not applied yet. The dispatcher resolves your own number when it sends; nothing is invented here.'}
      </p>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 12px' }}>
        The queue runs in this tab — if the tab closes, the queue stops (a server-side queue is a
        later step). Sends are logged server-side by the dispatcher — this page never writes to the
        message log directly.
      </p>
      <label style={labelStyle}>
        Numbers — one per line or comma-separated
        <textarea
          style={{ ...inputStyle, minHeight: 90 }}
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
          placeholder={'One number per line, or separated by commas'}
          disabled={phase === 'running'}
        />
      </label>
      <p style={{ fontSize: 13, margin: '0 0 10px' }}>
        {parsed.valid.length} valid, {parsed.invalid.length} invalid dropped
        {parsed.invalid.length > 0 ? ' — invalid numbers are never sent to' : ''}
        {', '}
        {parsed.optedOutFiltered.length} opted out filtered
        {optOutUnknown ? ' (opt-out list could not be checked yet — the opt-out column is not applied yet, so filtering may be incomplete; the dispatcher re-checks at send time)' : ''}
        {parsed.eligible.length > 0 ? ` — ${parsed.eligible.length} will receive it` : ' — none to send to yet'}
      </p>
      <label style={labelStyle}>
        Message
        <textarea
          style={{ ...inputStyle, minHeight: 80 }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write the text…"
          disabled={phase === 'running'}
        />
      </label>
      <label style={labelStyle}>
        Seconds between sends ({MIN_INTERVAL_SEC}–{MAX_INTERVAL_SEC})
        <input
          style={inputStyle}
          type="number"
          min={MIN_INTERVAL_SEC}
          max={MAX_INTERVAL_SEC}
          value={intervalSec}
          onChange={(e) => setIntervalSec(clampInterval(Number(e.target.value)))}
          disabled={phase === 'running'}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={startSend}
          disabled={phase === 'running' || parsed.eligible.length === 0 || !message.trim()}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}
        >
          {phase === 'running' ? 'Sending…' : `Send to ${parsed.eligible.length} number${parsed.eligible.length === 1 ? '' : 's'}`}
        </button>
        <button
          type="button"
          onClick={() => stopQueue('Stopped by you.')}
          disabled={phase !== 'running'}
          style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
        >
          Stop
        </button>
      </div>
      {phase === 'running' && (
        <p style={{ fontSize: 13, margin: '10px 0 0' }}>
          Sent {sent} of {total}
          {failed > 0 ? `, ${failed} failed` : ''}
          {current ? ` — now sending to ${current} (${currentIndex} of ${total})` : ''}
        </p>
      )}
      {phase === 'stopped' && (
        <p style={{ fontSize: 13, margin: '10px 0 0' }}>
          Stopped at {sent + failed} of {total} — sent {sent}, failed {failed}.
        </p>
      )}
      {result && <p style={{ fontSize: 13, margin: '10px 0 0' }}>{result}</p>}
    </div>
  );
}
