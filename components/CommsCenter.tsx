'use client';

import { useEffect, useState } from 'react';
import { SCRIPT_TEMPLATES, mergeTemplate } from '../lib/scripts-data';
import {
  loadMyLeads,
  logCall,
  logOutreach,
  checkBlocklist,
  CALL_OUTCOMES,
  type CallOutcome,
} from '../lib/outreach';
import { updateLeadFields, type Lead } from '../lib/leads';
import { checkPhone } from '../lib/phone';
import InAppSend from './InAppSend';
import {
  firstPhone,
  firstEmail,
  isDoNotContact,
  consentLabel,
  channelLinks,
  addToBlocklist,
} from '../lib/comms';
import { loadAllTags, type DistressTagRow } from '../lib/distress';
import { courtesyHold, courtesyHoldLine } from '../lib/courtesy';

// Slice 24 — Comms center. One place to contact a lead across call,
// text, WhatsApp, and email. Every channel is a link the wholesaler
// taps and sends from their OWN phone and accounts — the platform
// never auto-sends and never auto-dials (user decision, Oct 31, 2026:
// comms center only, no Allo, no automation). Before any channel opens,
// the server blocklist check must answer "clear" (fail closed, same as
// the Slice 12 composer). Consent state is shown on the lead, opt-outs
// are one tap, and every contact + disposition is logged.

const card: React.CSSProperties = { background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 };

export default function CommsCenter({ userId }: { userId: string | null }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tagsByLead, setTagsByLead] = useState<Record<string, DistressTagRow[]>>({});
  const [leadId, setLeadId] = useState('');
  const [tplKey, setTplKey] = useState(SCRIPT_TEMPLATES[0].key);
  const [you, setYou] = useState('');
  const [biz, setBiz] = useState('');
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'clear' | 'blocked' | 'unconfigured' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [dispNotes, setDispNotes] = useState('');
  const [dispDate, setDispDate] = useState('');
  const [consentSource, setConsentSource] = useState('');
  const [dncArm, setDncArm] = useState(false);

  const lead = leads.find((l) => l.id === leadId) || null;
  const tpl = SCRIPT_TEMPLATES.find((s) => s.key === tplKey) || SCRIPT_TEMPLATES[0];
  const merged = mergeTemplate(tpl.body, {
    name: lead?.owner_name || '{name}',
    you: you || '{you}',
    biz: biz || '{biz}',
    city: lead?.city || '{city}',
    address: lead?.property_address || '{address}',
  });
  const links = lead ? channelLinks(lead, merged) : null;
  const dnc = lead ? isDoNotContact(lead) : false;
  // Slice 115 — the courtesy hold rides alongside consent and the
  // blocklist here: visible before any channel opens, never a
  // hidden block.
  const hold = lead
    ? courtesyHold(tagsByLead[lead.id || ''] || [], new Date().toISOString().slice(0, 10))
    : null;

  const refreshLeads = () => { if (userId) loadMyLeads(userId).then(setLeads).catch(() => {}); };
  useEffect(() => {
    if (!userId) return;
    refreshLeads();
    loadAllTags(userId).then(setTagsByLead).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!userId) return null;
  const leadLabel = (l: Lead) =>
    `${l.owner_name || 'Owner'} — ${l.property_address}${l.city ? `, ${l.city}` : ''}${isDoNotContact(l) ? ' · DO NOT CONTACT' : ''}`;

  const consentColor = !lead ? '#94a3b8'
    : lead.consent_status === 'requested_contact' || lead.consent_status === 'express_consent' ? '#4ade80'
    : lead.consent_status === 'opted_out' ? '#f87171' : '#fbbf24';

  const pickLead = (id: string) => {
    setLeadId(id);
    setCheckState('idle');
    setDncArm(false);
    setMsg('');
  };

  const tapChannel = (channel: 'call' | 'sms' | 'whatsapp' | 'email') => {
    if (!lead) return;
    logOutreach(userId, lead.id || null, channel, tpl.key).catch(() => {});
  };

  const logDisposition = async (outcome: CallOutcome) => {
    if (!lead) return;
    try {
      await logCall(userId, {
        lead_id: lead.id || null,
        outcome,
        notes: dispNotes || undefined,
        next_step: dispNotes || undefined,
        next_step_date: dispDate || null,
      });
      setMsg(`Logged: ${outcome.replace(/_/g, ' ')} for ${lead.owner_name || 'this lead'}.`);
      setDispNotes('');
      setDispDate('');
    } catch {
      setMsg('That log failed — check the connection and try again.');
    }
  };

  const markDoNotContact = async () => {
    if (!lead || !lead.id) return;
    try {
      await updateLeadFields(userId, lead.id, {
        do_not_contact: true,
        consent_status: 'opted_out',
        consent_at: new Date().toISOString(),
      });
      await logCall(userId, { lead_id: lead.id, outcome: 'do_not_call', notes: 'Marked Do Not Contact in the comms center.' }).catch(() => {});
      const res = await addToBlocklist(lead.property_address, firstPhone(lead));
      if (res === 'added') setMsg('Done. This lead is marked Do Not Contact in your office and added to the platform-wide blocklist.');
      else if (res === 'already') setMsg('Done. This lead is marked Do Not Contact in your office; it was already on the platform-wide blocklist.');
      else if (res === 'unconfigured') setMsg('Marked Do Not Contact in your office, effective now. The platform-wide blocklist entry is still pending — it needs the server key (owner step) before it can be written.');
      else setMsg('Marked Do Not Contact in your office, effective now. The platform-wide blocklist write did not complete — it will be retried next time this lead is marked.');
      setDncArm(false);
      setCheckState('idle');
      refreshLeads();
    } catch {
      setMsg('That change failed — check the connection and try again.');
    }
  };

  const recordConsent = async () => {
    if (!lead || !lead.id) return;
    try {
      await updateLeadFields(userId, lead.id, {
        consent_status: 'express_consent',
        consent_at: new Date().toISOString(),
        consent_source: consentSource.trim() || 'Recorded by the wholesaler in the comms center',
      });
      setMsg('Express consent recorded on this lead with your source note.');
      setConsentSource('');
      refreshLeads();
    } catch {
      setMsg('That change failed — check the connection and try again.');
    }
  };

  return (
    <section style={card}>
      <h2>Comms Center — you tap, your phone sends</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Pick a lead, pick a script, pass the blocklist check, then tap the channel — the message opens in your own
        phone or mail app, from your own number and accounts; or, once you've connected your own Twilio/Resend
        accounts, send it from right here — still one tap per message, consent on file required. Nothing here
        auto-sends or auto-dials, and there is no AI caller: AI voices are “artificial” under the TCPA without
        prior express consent (FCC, Feb 2024).
      </p>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select value={leadId} onChange={(e) => pickLead(e.target.value)}>
          <option value="">Pick a lead…</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{leadLabel(l)}</option>)}
        </select>
        <select value={tplKey} onChange={(e) => { setTplKey(e.target.value); setCheckState('idle'); }}>
          {SCRIPT_TEMPLATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <input placeholder="Your name ({you})" value={you} onChange={(e) => setYou(e.target.value)} />
        <input placeholder="Your business ({biz})" value={biz} onChange={(e) => setBiz(e.target.value)} />
      </div>

      {!lead && <p style={{ fontSize: 13 }}>Pick a lead to see its contact options.</p>}

      {lead && (
        <>
          <p style={{ fontSize: 13.5, marginBottom: 4 }}>
            <strong>{lead.owner_name || 'Owner'}</strong> — {lead.property_address}
            {firstPhone(lead) ? ` · ${firstPhone(lead)}` : ' · no phone on file'}
            {firstEmail(lead) ? ` · ${firstEmail(lead)}` : ' · no email on file'}
          </p>
          {firstPhone(lead) && !checkPhone(firstPhone(lead) as string).valid && (
            <p style={{ fontSize: 13, color: '#fbbf24', marginTop: 0 }}>
              ⚠ This phone number fails the format check ({checkPhone(firstPhone(lead) as string).reason}) —
              double-check it on the lead before you rely on it. A format check cannot confirm the line is
              active or who owns it.
            </p>
          )}
          <p style={{ fontSize: 13, color: consentColor, marginTop: 0 }}>
            Consent: {consentLabel(lead)}
            {lead.consent_at ? ` · recorded ${new Date(lead.consent_at).toLocaleDateString()}` : ''}
            {lead.list_source ? ` · Source: ${lead.list_source}` : ''}
          </p>
          {hold && (
            <p style={{ fontSize: 13.5, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', padding: 12, borderRadius: 10 }}>
              🤝 <strong>Courtesy hold.</strong> {courtesyHoldLine(hold)} The channels below still open —
              the platform does not block you — but the courtesy this office stands for is to wait.
              If you reach out anyway, that choice is yours, and it is logged like any other outreach.
            </p>
          )}
          <p style={{ fontSize: 13, background: '#0f172a', padding: 12, borderRadius: 10, whiteSpace: 'pre-wrap' }}>{merged}</p>

          {dnc ? (
            <p style={{ fontSize: 13.5, color: '#f87171' }}>
              <strong>Do not contact.</strong> This lead has opted out or been marked. The contact channels stay closed.
            </p>
          ) : (
            <>
              <button disabled={checkState === 'checking'} onClick={async () => {
                setCheckState('checking');
                const result = await checkBlocklist(lead.property_address, firstPhone(lead) || undefined);
                setCheckState(result);
              }}>Check blocklist &amp; unlock channels</button>
              {checkState === 'checking' && <p style={{ fontSize: 13 }}>Checking the do-not-contact blocklist…</p>}
              {checkState === 'blocked' && (
                <p style={{ fontSize: 13, color: '#f87171' }}>
                  <strong>Blocked.</strong> This contact is on the do-not-contact blocklist. Do not reach out.
                </p>
              )}
              {checkState === 'unconfigured' && (
                <p style={{ fontSize: 13, color: '#fbbf24' }}>
                  The blocklist check is not configured on the server yet — it needs the Supabase service-role key in
                  the hosting environment (owner step). Channels stay locked here rather than skipping the check.
                </p>
              )}
              {checkState === 'error' && (
                <p style={{ fontSize: 13, color: '#f87171' }}>The blocklist check did not complete, so the channels stay locked. Try again.</p>
              )}
              {checkState === 'clear' && links && (
                <div style={{ fontSize: 13.5 }}>
                  <p>Clear — not on the blocklist. Tap a channel; each tap is logged to this lead:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {links.tel && <a href={links.tel} onClick={() => tapChannel('call')}>📞 Call {firstPhone(lead)}</a>}
                    {links.sms && <a href={links.sms} onClick={() => tapChannel('sms')}>💬 Text</a>}
                    {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noreferrer" onClick={() => tapChannel('whatsapp')}>WhatsApp</a>}
                    {links.mailto && <a href={links.mailto} onClick={() => tapChannel('email')}>✉️ Email</a>}
                    {firstPhone(lead) && (
                      <a href={links.voiceUrl} target="_blank" rel="noreferrer">
                        Open Google Voice — dial {firstPhone(lead)} there
                      </a>
                    )}
                    <button onClick={async () => {
                      try { await navigator.clipboard.writeText(merged); setMsg('Message copied — paste it into any app.'); }
                      catch { setMsg('Copy failed in this browser.'); }
                    }}>Copy message</button>
                  </div>
                  {!firstPhone(lead) && <p style={{ fontSize: 13 }}>No phone on file for this lead — call, text, and WhatsApp unlock once a phone is added to the lead.</p>}
                  {!firstEmail(lead) && <p style={{ fontSize: 13 }}>No email on file for this lead.</p>}
                  <InAppSend userId={userId} lead={lead} merged={merged} tplKey={tpl.key} />
                </div>
              )}
            </>
          )}

          <h3>After you talk — log the disposition</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input placeholder="Notes / next step" value={dispNotes} onChange={(e) => setDispNotes(e.target.value)} style={{ minWidth: 200 }} />
            <input type="date" value={dispDate} onChange={(e) => setDispDate(e.target.value)} />
            {CALL_OUTCOMES.filter((o) => o !== 'do_not_call').map((o) => (
              <button key={o} onClick={() => logDisposition(o)}>{o.replace(/_/g, ' ')}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            A follow-up date puts this lead in your follow-up queue and Today view. “Do not call” is the red button below, not a disposition.
          </p>

          <h3>Consent &amp; opt-out</h3>
          {!dnc && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <input placeholder="How did they consent? (e.g. checked the box on my form)" value={consentSource} onChange={(e) => setConsentSource(e.target.value)} style={{ minWidth: 280 }} />
              <button onClick={recordConsent}>Record express consent</button>
            </div>
          )}
          {!dnc && !dncArm && (
            <button onClick={() => setDncArm(true)} style={{ color: '#f87171' }}>Mark Do Not Contact</button>
          )}
          {!dnc && dncArm && (
            <p style={{ fontSize: 13.5 }}>
              <strong style={{ color: '#f87171' }}>Confirm:</strong> this closes all channels for this lead in your office
              and writes it to the platform blocklist. {' '}
              <button onClick={markDoNotContact} style={{ color: '#f87171' }}>Yes — mark Do Not Contact</button>{' '}
              <button onClick={() => setDncArm(false)}>Cancel</button>
            </p>
          )}
        </>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        WholesalingOS never auto-sends messages, never auto-dials, and never records calls. Florida is two-party
        consent for recording (Fla. Stat. §934.03) — if you record on your own device, get consent first.
      </p>
    </section>
  );
}
