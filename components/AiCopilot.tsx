// Slice 137, Part B — AI Deal Copilot widget (BYOK).
//
// A floating bottom-left button + drawer, SEPARATE from the Slice 28
// shared-key AssistantPanel (components/AssistantPanel.tsx, untouched).
// This Copilot runs on the wholesaler's OWN key (BYOK, saved in
// "My Providers" — components/MyProviders.tsx) through the
// ai-wholesale-copilot Edge Function. It opens ONLY via the
// 'ws:open-copilot' CustomEvent dispatched by lib/ai-copilot.ts
// openCopilot(contextSummary, autoQuestion?) — no other open
// mechanism exists.
//
// Honest states, no fake AI: with no key configured the function
// answers 400 not-connected and the widget shows that; when the
// Edge Function is not deployed yet it says so; when Supabase is
// not configured on this deployment it says so. The widget never
// crashes when the Supabase client is null.
//
// Chat history is rendered as React text ({msg.text} as children)
// — NEVER dangerouslySetInnerHTML, NEVER innerHTML, never
// interpolate user or model text into HTML.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { extractEdgeFunctionError } from '../lib/ai-copilot';

type ChatMsg = { role: 'user' | 'copilot'; text: string };

const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: 'Calculate MAO',
    prompt: 'Calculate MAO — ARV $[ARV], rehab $[REHAB], my fee $[FEE]',
  },
  { label: 'Seller Rebuttal', prompt: 'Seller Rebuttal' },
  { label: 'Buyer SMS', prompt: 'Buyer SMS' },
];

const NOT_DEPLOYED_MESSAGE =
  'Edge Function not deployed yet — deploy it from Supabase first';

function isNotDeployedMessage(msg: string): boolean {
  return /not found|failed to send|failed to fetch|fetch failed|404/i.test(msg);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'The Copilot could not be reached.';
}

export default function AiCopilot() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const thinkingRef = useRef(false);
  // Context lives in state for rendering, and mirrored in a ref so
  // ask() — called in the same tick as the open event, before the
  // state update lands — still sends the fresh context.
  const contextRef = useRef<string | null>(null);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || thinkingRef.current) return;
    thinkingRef.current = true;
    setThinking(true);
    setError(null);
    setMessages((cur) => [...cur, { role: 'user', text: q }]);
    setInput('');
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured on this deployment — the Copilot cannot reach the AI service.');
      }
      const { data, error: fnError } = await supabase.functions.invoke('ai-wholesale-copilot', {
        body: { question: q, deal_context: contextRef.current ?? undefined },
      });
      // The function answers honestly when no key is connected:
      // a 400 with a not-connected message, or data.error.
      const dataError =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : null;
      if (fnError) {
        const { message: msg, status } = await extractEdgeFunctionError(fnError);
        if (status === 400 || /not[- ]connected|no .*key|not configured/i.test(msg)) {
          throw new Error(msg);
        }
        if (isNotDeployedMessage(msg)) throw new Error(NOT_DEPLOYED_MESSAGE);
        throw new Error(msg);
      }
      if (dataError) throw new Error(dataError);
      const answer =
        data && typeof data === 'object'
          ? ((data as { answer?: unknown }).answer ??
            (data as { reply?: unknown }).reply ??
            (data as { text?: unknown }).text)
          : null;
      if (typeof answer !== 'string' || answer.trim() === '') {
        throw new Error('The Copilot answered, but the reply was empty — please try again.');
      }
      setMessages((cur) => [...cur, { role: 'copilot', text: answer }]);
    } catch (err) {
      const msg = errorText(err);
      setError(isNotDeployedMessage(msg) ? NOT_DEPLOYED_MESSAGE : msg);
    } finally {
      thinkingRef.current = false;
      setThinking(false);
    }
  }, []);

  // The ONLY open mechanism: the 'ws:open-copilot' event from
  // lib/ai-copilot.ts. Sets context, opens the drawer, and — when
  // an autoQuestion is given — fills the input and sends it
  // immediately; otherwise focuses the input.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ context?: unknown; autoQuestion?: unknown }>).detail || {};
      const summary = typeof detail.context === 'string' ? detail.context : '';
      const autoQuestion =
        typeof detail.autoQuestion === 'string' && detail.autoQuestion.trim() !== ''
          ? detail.autoQuestion
          : null;
      if (summary.trim() !== '') {
        contextRef.current = summary;
        setContext(summary);
      }
      setOpen(true);
      setError(null);
      if (autoQuestion) {
        setInput(autoQuestion);
        void ask(autoQuestion);
      } else {
        // Let the drawer mount before focusing the input.
        window.setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('ws:open-copilot', onOpen);
    return () => window.removeEventListener('ws:open-copilot', onOpen);
  }, [ask]);

  const submit = () => {
    if (input.trim() === '') return;
    void ask(input);
  };

  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    setError(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((cur) => !cur);
          setError(null);
          window.setTimeout(() => inputRef.current?.focus(), 50);
        }}
        aria-label="Open AI Deal Copilot"
        style={{
          position: 'fixed', left: 16, bottom: 16, zIndex: 60,
          background: '#0ea5e9', color: '#fff', border: '1px solid #38bdf8',
          borderRadius: 999, padding: '10px 16px', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}
      >
        🤖 AI Deal Copilot
      </button>

      {open && (
        <section
          aria-label="AI Deal Copilot"
          style={{
            position: 'fixed', left: 16, bottom: 76, zIndex: 60,
            width: 'min(420px, calc(100vw - 32px))', maxHeight: '70vh',
            display: 'flex', flexDirection: 'column',
            background: '#1e293b', color: '#e2e8f0',
            border: '1px solid rgba(56,189,248,0.45)', borderRadius: 14,
            boxShadow: '0 16px 40px rgba(0,0,0,0.55)', overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(148,163,184,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>🤖 AI Deal Copilot</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close AI Deal Copilot"
                style={{ background: 'transparent', border: '1px solid #475569', padding: '4px 9px' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0', lineHeight: 1.45 }}>
              Free tier — rate-limited, daily ceiling, resets midnight Pacific; free-tier prompts
              may be used by Google to improve its products — never paste SSNs or seller phone numbers.
            </p>
          </div>

          {/* Context banner — directly above the chat history. */}
          {context !== null && context !== '' && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: '#0f172a',
                borderBottom: '1px solid rgba(148,163,184,0.25)',
                fontSize: 13,
              }}
            >
              <span
                title={context}
                style={{
                  flex: 1, minWidth: 0, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                📌 Context: {context}
              </span>
              <button
                type="button"
                onClick={() => { contextRef.current = null; setContext(null); }}
                aria-label="Clear context"
                title="Clear context"
                style={{ background: 'transparent', border: '1px solid #475569', padding: '2px 8px', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 ? (
              <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: 0, lineHeight: 1.55 }}>
                Ask me about your deal. I can help with deal math, seller negotiation,
                creative finance, and buyer scripts — using the deal context above when one is set.
                Replace the $[bracketed] fill-ins in a quick prompt with your real numbers before you ask.
              </p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%', padding: '8px 11px', borderRadius: 10,
                    background: msg.role === 'user' ? '#0c4a6e' : '#0f172a',
                    border: '1px solid rgba(148,163,184,0.25)',
                    fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word',
                  }}
                >
                  {msg.text}
                </div>
              ))
            )}
            {thinking && <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Thinking…</p>}
            {error && (
              <p role="alert" style={{ fontSize: 13, color: '#fca5a5', margin: 0 }}>
                {error}
              </p>
            )}
          </div>

          <div style={{ padding: '10px 12px 12px', borderTop: '1px solid rgba(148,163,184,0.25)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  type="button"
                  onClick={() => fillPrompt(qp.prompt)}
                  style={{
                    background: '#0f172a', border: '1px solid rgba(56,189,248,0.5)',
                    color: '#bae6fd', borderRadius: 999, padding: '5px 11px', fontSize: 12.5,
                  }}
                >
                  {qp.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                placeholder="Ask about this deal…"
                aria-label="Ask the AI Deal Copilot"
                disabled={thinking}
                style={{ flex: 1, minWidth: 0, margin: 0 }}
              />
              <button
                type="button"
                onClick={submit}
                disabled={thinking || input.trim() === ''}
                style={{ background: '#0284c7', borderColor: '#38bdf8', color: '#fff', flexShrink: 0 }}
              >
                {thinking ? 'Thinking…' : 'Ask'}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '8px 0 0' }}>
              Runs on your own key (My Providers) and your own quota — no shared key.
              {context === null || context === '' ? ' No deal context set — open me from a deal to attach one.' : ''}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
