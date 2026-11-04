'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Lead } from '../lib/leads';
import { firstPhone, firstEmail } from '../lib/comms';
import { checkPhone } from '../lib/phone';
import { logSentOutreach } from '../lib/outreach';

// Slice 44 — send from inside the app, through the wholesaler's OWN
// provider accounts (Twilio for texts, Resend for email; keys live in
// the hosting environment — see app/api/send). This panel renders
// inside the Comms Center's cleared state, and the server re-checks
// every gate before sending: sign-in, lead ownership, do-not-contact,
// consent on file (express or requested — never 'unknown'), and the
// blocklist, fail-closed. One tap sends one message to one lead.
// There is no batch mode and never will be.
//
// Until the owner connects the accounts, GET /api/send reports both
// channels off and this panel says so plainly instead of pretending.

export default function InAppSend({ userId, lead, merged, tplKey }: {
  userId: string;
  lead: Lead;
  merged: string;
  tplKey: string;
}) {
  const [cfg, setCfg] = useState<{ sms: boolean; email: boolean } | null>(null);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState<'sms' | 'email' | ''>('');
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch('/api/send')
      .then((r) => r.json())
      .then((j) => setCfg({ sms: !!j.sms, email: !!j.email }))
      .catch(() => setCfg({ sms: false, email: false }));
  }, []);

  if (cfg === null) return null;

  if (!cfg.sms && !cfg.email) {
    return (
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 12 }}>
        <strong>Sending from inside the app isn't connected yet.</strong> It runs on your own accounts —
        Twilio for texts (with A2P registration) and Resend for email — with the keys placed in the hosting
        environment, never in the app. Until then, the channels above open your own phone and mail apps,
        which is the same message from the same you.
      </p>
    );
  }

  const consentOk = lead.consent_status === 'express_consent' || lead.consent_status === 'requested_contact';
  const phone = firstPhone(lead);
  const email = firstEmail(lead);
  const phoneOk = !!phone && checkPhone(phone).valid;

  const send = async (channel: 'sms' | 'email') => {
    setSending(channel);
    setResult('');
    try {
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setResult('Your session expired — sign in again.'); setSending(''); return; }
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel, lead_id: lead.id, body: merged, subject }),
      });
      const j = (await res.json()) as { ok?: boolean; provider_id?: string; error?: string };
      if (res.ok && j.ok) {
        await logSentOutreach(userId, lead.id || null, channel, tplKey).catch(() => {});
        setResult(`✅ Sent by ${channel === 'sms' ? 'text' : 'email'} from your account${j.provider_id ? ` — provider ID ${j.provider_id}` : ''}. It's logged on this lead.`);
      } else {
        setResult(`Not sent: ${j.error || 'unknown error'}`);
      }
    } catch {
      setResult('Not sent: the request did not complete.');
    }
    setSending('');
  };

  return (
    <div style={{ marginTop: 12, background: '#0f172a', borderRadius: 10, padding: 12 }}>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        <strong>Send from WholesalingOS</strong> — through your own {cfg.sms && cfg.email ? 'Twilio + Resend accounts' : cfg.sms ? 'Twilio account' : 'Resend account'}.
        One tap, one message, this lead only.
      </p>
      {!consentOk && (
        <p style={{ fontSize: 13, color: '#fbbf24' }}>
          In-app sending needs consent on file first — this lead's consent is "{lead.consent_status || 'unknown'}".
          Record express consent below (with its source), or use the tap-to-open channels above.
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {cfg.sms && (
          <button onClick={() => send('sms')} disabled={!consentOk || !phoneOk || sending !== ''}>
            {sending === 'sms' ? 'Sending…' : `💬 Send text to ${phone || '—'}`}
          </button>
        )}
        {cfg.sms && !phone && <span style={{ fontSize: 12.5, color: '#94a3b8' }}>No phone on file.</span>}
        {cfg.sms && phone && !phoneOk && <span style={{ fontSize: 12.5, color: '#fbbf24' }}>That phone fails the format check.</span>}
        {cfg.email && (
          <>
            <input placeholder="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ minWidth: 200 }} />
            <button onClick={() => send('email')} disabled={!consentOk || !email || sending !== ''}>
              {sending === 'email' ? 'Sending…' : `✉️ Send email to ${email || '—'}`}
            </button>
            {!email && <span style={{ fontSize: 12.5, color: '#94a3b8' }}>No email on file.</span>}
          </>
        )}
      </div>
      {result && <p style={{ fontSize: 13, marginBottom: 0 }}>{result}</p>}
    </div>
  );
}
