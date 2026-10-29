'use client';

import { useEffect, useState } from 'react';
import { SCRIPT_TEMPLATES, mergeTemplate } from '../lib/scripts-data';
import {
  loadMyLeads,
  logCall,
  loadFollowUpQueue,
  logOutreach,
  checkBlocklist,
  CALL_OUTCOMES,
  type CallOutcome,
  type FollowUpRow,
  type OutreachChannel,
} from '../lib/outreach';
import type { Lead } from '../lib/leads';

// Slice 12 — Scripts & outreach. The 8 templates are the user's own
// prototype templates. Nothing here sends: email opens the user's mail
// client, other channels copy the text, and the outreach composer refuses
// to prepare a message until the server-side blocklist check answers
// "clear" (fail closed — an unconfigured or failed check pauses outreach
// instead of skipping it). No AI caller: FCC Feb 2024 — AI voices are
// "artificial" under the TCPA without prior express consent; Florida is
// two-party consent for recording (Fla. Stat. §934.03).

const card: React.CSSProperties = { background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 };

export default function Outreach({ userId }: { userId: string | null }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tplKey, setTplKey] = useState(SCRIPT_TEMPLATES[0].key);
  const [leadId, setLeadId] = useState('');
  const [you, setYou] = useState('');
  const [biz, setBiz] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const [outcome, setOutcome] = useState<CallOutcome>('follow_up');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [queue, setQueue] = useState<FollowUpRow[]>([]);

  const [channel, setChannel] = useState<OutreachChannel>('email');
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'clear' | 'blocked' | 'unconfigured' | 'error'>('idle');

  const lead = leads.find((l) => l.id === leadId) || null;
  const tpl = SCRIPT_TEMPLATES.find((s) => s.key === tplKey) || SCRIPT_TEMPLATES[0];
  const merged = mergeTemplate(tpl.body, {
    name: lead?.owner_name || '{name}',
    you: you || '{you}',
    biz: biz || '{biz}',
    city: lead?.city || '{city}',
    address: lead?.property_address || '{address}',
  });

  const refreshQueue = () => { if (userId) loadFollowUpQueue(userId).then(setQueue).catch(() => {}); };
  useEffect(() => {
    if (!userId) return;
    loadMyLeads(userId).then(setLeads).catch(() => {});
    refreshQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!userId) return null;
  const leadLabel = (l: Lead) => `${l.owner_name || 'Owner'} — ${l.property_address}${l.city ? `, ${l.city}` : ''}`;
  const leadName = (id?: string | null) => {
    const l = leads.find((x) => x.id === id);
    return l ? leadLabel(l) : 'Lead';
  };

  return (
    <section style={card}>
      <h2>Scripts & Outreach</h2>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}

      <h3>Script library — your prototype templates</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select value={tplKey} onChange={(e) => setTplKey(e.target.value)}>
          {SCRIPT_TEMPLATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={leadId} onChange={(e) => { setLeadId(e.target.value); setCheckState('idle'); }}>
          <option value="">Pick a lead to fill merge fields…</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{leadLabel(l)}</option>)}
        </select>
        <input placeholder="Your name ({you})" value={you} onChange={(e) => setYou(e.target.value)} />
        <input placeholder="Your business ({biz})" value={biz} onChange={(e) => setBiz(e.target.value)} />
      </div>
      <p style={{ fontSize: 13, background: '#0f172a', padding: 12, borderRadius: 10, whiteSpace: 'pre-wrap' }}>{merged}</p>
      <button onClick={async () => { try { await navigator.clipboard.writeText(merged); setCopied(true); } catch { setCopied(false); } }}>
        Copy script
      </button>
      {copied ? ' Copied.' : ''}

      <h3>Log a call</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)}>
          {CALL_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input placeholder="Duration (sec)" inputMode="numeric" style={{ width: 110 }} value={duration} onChange={(e) => setDuration(e.target.value)} />
        <input placeholder="Next step" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
        <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minWidth: 200 }} />
        <button onClick={async () => {
          try {
            await logCall(userId, {
              lead_id: leadId || null,
              outcome,
              duration_seconds: duration ? Number(duration) : null,
              notes: notes || undefined,
              next_step: nextStep || undefined,
              next_step_date: nextDate || null,
            });
            setMsg('Call logged to your call history.');
            setNotes(''); setNextStep(''); setNextDate(''); setDuration('');
            refreshQueue();
          } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not log the call.'); }
        }}>Save call log</button>
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Call in your own voice — AI-generated voices are "artificial" under the TCPA (FCC, Feb 2024) and need the
        other party's prior express consent. Florida is two-party consent for recording (Fla. Stat. §934.03).
      </p>

      <h3>Outreach composer — blocklist-checked, never auto-sent</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select value={channel} onChange={(e) => { setChannel(e.target.value as OutreachChannel); setCheckState('idle'); }}>
          <option value="email">Email</option>
          <option value="sms">SMS (copy text)</option>
          <option value="whatsapp">WhatsApp (copy text)</option>
          <option value="mail">Mail (copy text)</option>
          <option value="door">Door knock (copy script)</option>
        </select>
        <button disabled={!lead || checkState === 'checking'} onClick={async () => {
          if (!lead) return;
          setCheckState('checking');
          const result = await checkBlocklist(lead.property_address, lead.phones?.[0]);
          setCheckState(result);
          if (result === 'clear') {
            try { await logOutreach(userId, lead.id || null, channel, tpl.key); } catch { /* log failure does not unblock sending UI copy */ }
          }
        }}>Check blocklist & prepare</button>
      </div>
      {!lead && <p style={{ fontSize: 13 }}>Pick a lead above first — the check runs against that lead's address/phone.</p>}
      {checkState === 'checking' && <p style={{ fontSize: 13 }}>Checking the do-not-contact blocklist…</p>}
      {checkState === 'blocked' && (
        <p style={{ fontSize: 13, color: '#f87171' }}>
          <strong>Blocked.</strong> This contact is on the do-not-contact blocklist. Do not reach out.
        </p>
      )}
      {checkState === 'unconfigured' && (
        <p style={{ fontSize: 13, color: '#fbbf24' }}>
          The blocklist check is not configured on the server yet — it needs the Supabase service-role key in the
          hosting environment (owner step). Outreach prep is paused here rather than skipping the check.
        </p>
      )}
      {checkState === 'error' && (
        <p style={{ fontSize: 13, color: '#f87171' }}>The blocklist check did not complete, so nothing was prepared. Try again.</p>
      )}
      {checkState === 'clear' && lead && (
        <div style={{ fontSize: 13 }}>
          <p>Clear — not on the blocklist. Prepared and logged. Send it yourself:</p>
          {channel === 'email' && lead.emails?.[0] ? (
            <a href={`mailto:${lead.emails[0]}?subject=${encodeURIComponent('Your property at ' + lead.property_address)}&body=${encodeURIComponent(merged)}`}>
              Open in your mail app to {lead.emails[0]}
            </a>
          ) : (
            <button onClick={async () => { try { await navigator.clipboard.writeText(merged); setMsg('Message copied — paste it into your ' + channel + ' app.'); } catch { setMsg('Copy failed in this browser.'); } }}>
              Copy message for {channel}
            </button>
          )}
          {channel === 'email' && !lead.emails?.[0] && <p>No email on file for this lead — copy the script above instead.</p>}
        </div>
      )}

      <h3>Follow-up queue — from your call logs</h3>
      {queue.length === 0 ? (
        <p style={{ fontSize: 13 }}>Nothing queued. When you log a call with a next-step date, it appears here.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {queue.map((q) => (
            <li key={q.id}>{q.next_step_date} — {leadName(q.lead_id)}: {q.next_step || 'Follow up'} (last outcome: {q.outcome})</li>
          ))}
        </ul>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        This queue is a manual send list — WholesalingOS never auto-sends messages or auto-dials.
      </p>
    </section>
  );
}
