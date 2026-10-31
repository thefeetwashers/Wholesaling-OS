'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadLeads } from '../lib/leads';
import { loadKpis } from '../lib/money';
import { loadFollowUpQueue } from '../lib/outreach';
import { SCRIPT_TEMPLATES } from '../lib/scripts-data';

// Slice 28 — the wholesaler's in-office AI assistant. It answers from a
// summary of the wholesaler's OWN data (built here from the same RLS-
// restricted rows the rest of the office shows), and it drafts follow-
// ups for the human to send from the Comms Center. It never contacts
// anyone itself. Until the platform owner sets one AI key on the server
// (AI_PROVIDER + AI_API_KEY in Vercel), the panel honestly shows
// "not connected" and the ask box stays disabled — no fake AI.

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'ChatGPT (OpenAI)',
  google: 'Gemini (Google)',
};

export default function AssistantPanel({ userId }: { userId: string | null }) {
  const [status, setStatus] = useState<{ configured: boolean; provider: string | null } | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [drafts, setDrafts] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/assistant')
      .then((r) => r.json())
      .then((j) => setStatus({ configured: !!j.configured, provider: j.provider || null }))
      .catch(() => setStatus({ configured: false, provider: null }));
  }, []);

  if (!userId) return null;

  async function buildContext(): Promise<string> {
    const [leads, kpis, queue] = await Promise.all([
      loadLeads(userId as string).catch(() => null),
      loadKpis(userId as string).catch(() => null),
      loadFollowUpQueue(userId as string).catch(() => []),
    ]);
    const list = leads || [];
    const byStatus: Record<string, number> = {};
    for (const l of list) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    const lines: string[] = [];
    lines.push(`Leads: ${list.length} total. By status: ${Object.keys(byStatus).map((s) => `${s} ${byStatus[s]}`).join(', ') || 'none'}.`);
    if (kpis) {
      lines.push(
        `This week: ${kpis.leadsThisWeek} new leads, ${kpis.callsThisWeek} calls logged. Offers awaiting a seller answer: ${kpis.offersAwaiting}. ` +
        `Offers accepted (all time): ${kpis.offersAcceptedTotal}. Contracts signed (all time): ${kpis.contractsSignedTotal}. ` +
        `Fees closed (all time): $${kpis.feesClosedTotal.toLocaleString()}. Active listings: ${kpis.activeListings}. ` +
        `Overdue follow-ups: ${kpis.overdueFollowUps}. New leads not yet contacted: ${kpis.uncontactedNew}. Stale listings (100+ days): ${kpis.stale100}.`,
      );
    }
    const byId = new Map<string, (typeof list)[number]>();
    for (const l of list) { if (l.id) byId.set(l.id, l); }
    const due = queue.slice(0, 10).map((q) => {
      const lead = q.lead_id ? byId.get(q.lead_id) : undefined;
      const label = lead ? `${lead.owner_name || 'Owner'} — ${lead.property_address}, ${lead.city || ''}` : 'A lead';
      return `${label} — follow-up due ${q.next_step_date || 'soon'}${q.next_step ? ` (planned: ${q.next_step})` : ''}`;
    });
    lines.push(due.length ? `Follow-ups on the queue:\n${due.join('\n')}` : 'Follow-ups on the queue: none scheduled.');
    lines.push(`Message templates available: ${SCRIPT_TEMPLATES.map((t) => t.label).join('; ')}.`);
    return lines.join('\n');
  }

  async function ask(text: string, into: 'answer' | 'drafts') {
    if (!supabase) { setMsg('Sign-in is not configured on this deployment.'); return; }
    setBusy(true);
    setMsg('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setMsg('Your session expired — sign in again.'); return; }
      const context = await buildContext();
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: text, context }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error || 'The assistant could not answer just now.'); return; }
      if (into === 'answer') setAnswer(j.answer || '');
      else setDrafts(j.answer || '');
    } catch {
      setMsg('The assistant could not be reached — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const connected = !!status?.configured;

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>AI Assistant — your office analyst</h2>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        Ask about your own numbers and pipeline, or have it draft follow-ups from your templates.
        It works only from your office data, and it never contacts a lead or seller by itself —
        drafts are yours to review and send from the Comms Center.
      </p>
      {status === null && <p style={{ fontSize: 13.5 }}>Checking the assistant connection…</p>}
      {status !== null && !connected && (
        <p style={{ background: '#422006', padding: '10px 12px', borderRadius: 8, fontSize: 13.5 }}>
          <strong>Not connected yet.</strong> The assistant turns on when the platform owner adds ONE AI API key
          on the server (Vercel env: <code>AI_PROVIDER</code> = anthropic, openai, or google, plus{' '}
          <code>AI_API_KEY</code>). One key, the owner's own AI account and bill — the panel will light up here
          automatically. Nothing in this panel is simulated in the meantime.
        </p>
      )}
      {connected && (
        <p style={{ fontSize: 13 }}>
          Connected: <strong>{PROVIDER_LABELS[status?.provider || ''] || status?.provider}</strong>. Answers use
          only your office summary — leads, KPIs, and your follow-up queue.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <textarea
          rows={3}
          style={{ flex: '1 1 320px' }}
          placeholder={connected ? 'e.g. What should I work on first today? How are my numbers this week?' : 'Connect an AI key to ask questions'}
          value={question}
          disabled={!connected || busy}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button disabled={!connected || busy || !question.trim()} onClick={() => ask(question.trim(), 'answer')}>
          {busy ? 'Thinking…' : 'Ask'}
        </button>
        <button
          disabled={!connected || busy}
          onClick={() => ask('Write one short follow-up draft for EACH follow-up on my queue, in the style of my day-3 drip template. Format each as "NAME — ADDRESS: draft". Keep each draft under 60 words, friendly, no pressure, and add no facts that are not in the summary. If my queue is empty, say so plainly.', 'drafts')}
        >
          Draft today's follow-ups
        </button>
      </div>
      {msg && <p style={{ color: '#fca5a5', fontSize: 13.5 }}>{msg}</p>}
      {answer && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Answer</h3>
          <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, padding: 12, fontSize: 14, whiteSpace: 'pre-wrap' }}>{answer}</div>
        </div>
      )}
      {drafts && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Follow-up drafts — review, then send from the Comms Center</h3>
          <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, padding: 12, fontSize: 14, whiteSpace: 'pre-wrap' }}>{drafts}</div>
          <button style={{ marginTop: 8 }} onClick={() => { navigator.clipboard?.writeText(drafts).catch(() => {}); setMsg('Drafts copied — paste into the Comms Center composer when you send.'); }}>
            Copy drafts
          </button>
        </div>
      )}
    </section>
  );
}
