import { NextResponse } from 'next/server';

// Slice 28 — AI assistant gateway. ONE provider, chosen by the platform
// owner with server env vars (set in Vercel, never in code):
//   AI_PROVIDER = anthropic | openai | google
//   AI_API_KEY  = that provider's API key (owner's account, owner's bill)
//   AI_MODEL    = optional override; defaults below apply otherwise.
// Until those are set, GET reports configured:false and the panel in the
// app honestly shows "not connected" — there is no fake AI anywhere.
// Every POST requires a valid signed-in Supabase session (verified
// against the project's Auth API), so the owner's key can only be spent
// by signed-in users, on summaries of their OWN office data, which the
// client builds from rows RLS already restricts to them.

const PROVIDER = (process.env.AI_PROVIDER || '').toLowerCase();
const KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.AI_MODEL || '';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
  google: 'gemini-2.0-flash',
};

function isConfigured(): boolean {
  return !!KEY && (PROVIDER === 'anthropic' || PROVIDER === 'openai' || PROVIDER === 'google');
}

const SYSTEM = [
  'You are the WholesalingOS office assistant for ONE real estate wholesaler, inside their own private office.',
  'Answer using ONLY the office summary provided. Never invent numbers, people, property facts, or prices that are not in the summary.',
  'You may explain the numbers, suggest the next action, and draft messages in the style of the wholesaler\'s templates.',
  'You never send messages or contact anyone yourself — drafts go to the wholesaler, who sends them personally from the Comms Center.',
  'If asked to automatically call, text, or message leads or sellers, decline briefly and explain the tap-to-send rule: outreach needs the person\'s consent and the wholesaler\'s own tap.',
  'Keep answers short, concrete, and in plain language.',
].join(' ');

export async function GET() {
  return NextResponse.json({ configured: isConfigured(), provider: isConfigured() ? PROVIDER : null });
}

async function verifyUser(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !SUPA_URL || !SUPA_ANON) return false;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPA_ANON },
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function askProvider(prompt: string): Promise<string> {
  const model = MODEL || DEFAULT_MODELS[PROVIDER];
  if (PROVIDER === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 900, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw new Error(`Anthropic API error ${r.status} — check AI_API_KEY and AI_MODEL on the server.`);
    const j = await r.json();
    return (j.content || []).map((b: { text?: string }) => b.text || '').join('').trim();
  }
  if (PROVIDER === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw new Error(`OpenAI API error ${r.status} — check AI_API_KEY and AI_MODEL on the server.`);
    const j = await r.json();
    const c = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
    return String(c || '').trim();
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!r.ok) throw new Error(`Google AI API error ${r.status} — check AI_API_KEY and AI_MODEL on the server.`);
  const j = await r.json();
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  return parts.map((p: { text?: string }) => p.text || '').join('').trim();
}

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { configured: false, error: 'The AI assistant is not connected yet — the platform owner adds one AI API key on the server to turn it on.' },
      { status: 503 },
    );
  }
  if (!(await verifyUser(req))) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const question = String(body.question || '').slice(0, 2000);
  const context = String(body.context || '').slice(0, 6000);
  if (!question) return NextResponse.json({ error: 'Ask a question first.' }, { status: 400 });
  try {
    const answer = await askProvider(`OFFICE SUMMARY (the signed-in wholesaler's own data):\n${context}\n\nREQUEST:\n${question}`);
    if (!answer) return NextResponse.json({ error: 'The assistant returned an empty answer — try again.' }, { status: 502 });
    return NextResponse.json({ configured: true, provider: PROVIDER, answer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Assistant request failed.' }, { status: 502 });
  }
}
