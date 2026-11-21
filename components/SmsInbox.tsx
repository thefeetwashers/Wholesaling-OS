// Slice 134 — SmsInbox: the two-way SMS inbox (BYOK).
//
// Mounted at the end of the Comms Center. Shows the caller's OWN
// sms_messages rows (explicit column select, newest first) and
// subscribes with Supabase Realtime so new arrivals appear with a
// toast — "live updates when the connection is open", never a speed
// promise (Realtime needs the table in the
// publication and an open connection; neither is guaranteed).
//
// Every body renders as React text — never raw HTML.
// Quick replies go through the
// send-buyer-blast dispatcher (one invoke per reply); nothing is
// reported sent unless the dispatcher says so, and a not-deployed
// function or unconnected provider is reported honestly.
//
// No reply box on a number that opted out: the sender's phone is
// checked against the caller's own cash_buyers rows with
// sms_opt_out = true (STOP sets it). Keyword auto-routing is NOT
// built and NOT claimed here.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import {
  loadMySmsMessages,
  loadBuyerOptOutPhones,
  isOptedOutPhone,
  isStopKeyword,
  smsCounterpart,
  invokeSendBuyerBlast,
  type SmsMessage,
} from '../lib/sms';
import BatchBlaster from './BatchBlaster';

const SMS_INBOUND_WEBHOOK_URL = 'https://nabztcwabkqhxyxcxarx.supabase.co/functions/v1/sms-inbound';

interface Conversation {
  counterpart: string;
  messages: SmsMessage[];
  latestAt: string;
}

export default function SmsInbox({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [optedOut, setOptedOut] = useState<Set<string>>(new Set());
  const [optOutUnknown, setOptOutUnknown] = useState(false);
  const [toast, setToast] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<Record<string, boolean>>({});
  const [replyResult, setReplyResult] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError('');
    loadMySmsMessages(userId)
      .then((rows) => {
        if (live) setMessages(rows);
      })
      .catch((e) => {
        if (live) setLoadError(e instanceof Error ? e.message : 'Could not load your texts.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
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

  // Realtime arrivals on the caller's own rows only. A toast is
  // rendered as React text; the row itself is prepended like any
  // other load — nothing here promises sub-second delivery.
  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    const channel = supabase
      .channel(`sms-inbox-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sms_messages', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as SmsMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
          setToast(`New text from ${row.from_number} — live updates when the connection is open.`);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const conversations = useMemo<Conversation[]>(() => {
    const byNumber = new Map<string, SmsMessage[]>();
    for (const m of messages) {
      const key = smsCounterpart(m);
      const list = byNumber.get(key) || [];
      list.push(m);
      byNumber.set(key, list);
    }
    const convos: Conversation[] = [];
    for (const [counterpart, list] of byNumber) {
      const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
      convos.push({ counterpart, messages: sorted, latestAt: sorted[sorted.length - 1]?.created_at || '' });
    }
    convos.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    return convos;
  }, [messages]);

  async function sendReply(to: string) {
    const body = (drafts[to] || '').trim();
    if (!body || replyBusy[to]) return;
    setReplyBusy((cur) => ({ ...cur, [to]: true }));
    setReplyResult((cur) => ({ ...cur, [to]: '' }));
    const res = await invokeSendBuyerBlast({ channel: 'sms', to, to_number: to, body });
    if (res.ok) {
      setDrafts((cur) => ({ ...cur, [to]: '' }));
      setReplyResult((cur) => ({ ...cur, [to]: `Sent to ${to}.` }));
    } else {
      setReplyResult((cur) => ({ ...cur, [to]: res.error || 'Not sent.' }));
    }
    setReplyBusy((cur) => ({ ...cur, [to]: false }));
  }

  const card: React.CSSProperties = { background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 };

  return (
    <section style={card}>
      <h2>SMS Inbox — two-way texts on your own number</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Texts sent and received through your own SMS provider land here, newest conversation first.
        New arrivals appear live when the connection is open. Bodies render as plain text — links
        and code in a message never run here.
      </p>
      {toast && (
        <p style={{ fontSize: 13, background: '#0f172a', padding: 10, borderRadius: 8 }}>{toast}</p>
      )}

      <details style={{ fontSize: 13, background: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13.5 }}>Help / Setup Guide — point your provider at this inbox</summary>
        <p style={{ margin: '8px 0' }}>
          Inbound webhook URL (paste this into your provider — this is the real URL, not a
          placeholder):
        </p>
        <p style={{ wordBreak: 'break-all', background: '#1e293b', padding: 8, borderRadius: 6 }}>{SMS_INBOUND_WEBHOOK_URL}</p>
        <ul style={{ margin: '8px 0', paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Twilio — on the phone number (or Messaging Service), set the &ldquo;A MESSAGE COMES IN&rdquo; webhook to the URL above.</li>
          <li>Telnyx — on the number&apos;s Messaging Profile, set the inbound webhook URL to the URL above.</li>
          <li>TextBee — point your TextBee gateway&apos;s receive webhook at the URL above.</li>
          <li>httpSMS — in the phone app, set the webhook URL to the URL above.</li>
        </ul>
        <p style={{ margin: '8px 0' }}>
          US carriers require 10DLC registration for application-to-person texts — register your
          number/brand before blasting, or carriers may block delivery.
        </p>
      </details>

      {loading ? (
        <p style={{ fontSize: 13 }}>Loading your texts…</p>
      ) : loadError ? (
        <p style={{ fontSize: 13, color: '#f87171' }}>{loadError}</p>
      ) : conversations.length === 0 ? (
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          No texts yet — inbound texts arrive here once your provider webhook above points at this
          inbox.
        </p>
      ) : (
        conversations.map((convo) => {
          const isOut = isOptedOutPhone(convo.counterpart, optedOut);
          return (
            <div key={convo.counterpart} style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 13.5, margin: '0 0 8px' }}>
                <strong>{convo.counterpart}</strong>
                {isOut ? ' · Opted out' : ''}
                {optOutUnknown ? ' · opt-out status could not be checked yet' : ''}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
                {convo.messages.map((m) => (
                  <li key={m.id} style={{ fontSize: 13, background: '#0f172a', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                      {m.direction === 'inbound' ? 'Inbound' : 'Outbound'} · from {m.from_number} · to {m.to_number}
                      {m.provider ? ` · ${m.provider}` : ''}
                      {m.status ? ` · ${m.status}` : ''}
                      {' · '}
                      {new Date(m.created_at).toLocaleString()}
                      {m.direction === 'inbound' && isStopKeyword(m.body) ? ' · STOP keyword — this sender opted out' : ''}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
                  </li>
                ))}
              </ul>
              {isOut ? (
                <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>
                  Opted out — replies are closed for this number.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <input
                      placeholder={`Reply to ${convo.counterpart}…`}
                      value={drafts[convo.counterpart] || ''}
                      onChange={(e) => setDrafts((cur) => ({ ...cur, [convo.counterpart]: e.target.value }))}
                      style={{ flex: '1 1 240px', minWidth: 200 }}
                    />
                    <button
                      type="button"
                      onClick={() => sendReply(convo.counterpart)}
                      disabled={!((drafts[convo.counterpart] || '').trim()) || !!replyBusy[convo.counterpart]}
                    >
                      {replyBusy[convo.counterpart] ? 'Sending…' : 'Send reply'}
                    </button>
                  </div>
                  {replyResult[convo.counterpart] && (
                    <p style={{ fontSize: 13, margin: '8px 0 0' }}>{replyResult[convo.counterpart]}</p>
                  )}
                </>
              )}
            </div>
          );
        })
      )}

      <BatchBlaster userId={userId} />
    </section>
  );
}
