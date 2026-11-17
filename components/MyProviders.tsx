// Slice 137, Part B — My Providers settings card (BYOK).
//
// The wholesaler's own AI keys for the AI Deal Copilot
// (components/AiCopilot.tsx). Pick a provider (Gemini / Groq), paste
// your own free key, save it to your own row in
// wholesaler_provider_settings (user_id = auth.uid()).
//
// Keys are stored as PLAIN TEXT in your own provider-settings row so
// the Copilot Edge Function can use them — never claim "encrypted".
// The full key is never read back into the browser: settings load
// calls the SECURITY DEFINER RPC get_ai_key_status() (Slice 137
// migration), which returns only { ai_provider, has_gemini_key,
// has_groq_key, gemini_key_mask, groq_key_mask }. The paste field is
// never repopulated with a stored key, and after saving only the
// mask (first 4 + last 4 chars) is shown. No select('*') anywhere.
//
// If the RPC does not exist yet (Slice 137 migration not run), the
// card says so honestly instead of crashing.

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { extractEdgeFunctionError } from '../lib/ai-copilot';

type Provider = 'gemini' | 'groq';

interface KeyStatus {
  ai_provider: string | null;
  has_gemini_key: boolean;
  has_groq_key: boolean;
  gemini_key_mask: string | null;
  groq_key_mask: string | null;
}

const PROVIDER_META: Record<Provider, { label: string; keyLabel: string; getKeyUrl: string; getKeyText: string }> = {
  gemini: {
    label: 'Gemini (Google)',
    keyLabel: 'Gemini API key',
    getKeyUrl: 'https://aistudio.google.com',
    getKeyText: 'Get a free key at Google AI Studio',
  },
  groq: {
    label: 'Groq',
    keyLabel: 'Groq API key',
    getKeyUrl: 'https://console.groq.com/keys',
    getKeyText: 'Get a free key at the Groq console',
  },
};

function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return '••••••••';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

function isMissingRpcMessage(msg: string): boolean {
  return /could not find the function|function .* does not exist|PGRST202|schema cache|404/i.test(msg);
}

export default function MyProviders({ userId }: { userId: string | null }) {
  const [provider, setProvider] = useState<Provider>('gemini');
  const [keyInput, setKeyInput] = useState('');
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Load status through the RPC only — never select('*') the
  // settings row, so the full key never reaches the browser.
  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setNotSetUp(false);
      try {
        if (!supabase) {
          if (live) setLoading(false);
          return;
        }
        const { data, error } = await supabase.rpc('get_ai_key_status');
        if (!live) return;
        if (error) {
          if (isMissingRpcMessage(error.message || '')) setNotSetUp(true);
          else setMsg(`Could not load provider settings: ${error.message}`);
          return;
        }
        const row = (Array.isArray(data) ? data[0] : data) as KeyStatus | null;
        if (row) {
          setStatus(row);
          if (row.ai_provider === 'groq') setProvider('groq');
          else if (row.ai_provider === 'gemini') setProvider('gemini');
        }
      } catch (err) {
        if (!live) return;
        const m = err instanceof Error ? err.message : '';
        if (isMissingRpcMessage(m)) setNotSetUp(true);
        else setMsg(`Could not load provider settings: ${m || 'unknown error'}`);
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, []);

  if (!userId) return null;

  const meta = PROVIDER_META[provider];
  const hasKeyForProvider = provider === 'gemini' ? status?.has_gemini_key : status?.has_groq_key;
  const maskForProvider = provider === 'gemini' ? status?.gemini_key_mask : status?.groq_key_mask;

  const save = async () => {
    const key = keyInput.trim();
    if (key === '') {
      setMsg('Paste your key first — the field is empty.');
      return;
    }
    if (!supabase) {
      setMsg('Supabase is not configured on this deployment — keys cannot be saved.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const uid = authData?.user?.id || userId;
      if (authError || !uid) throw new Error(authError?.message || 'Could not confirm your signed-in account.');
      const row: Record<string, string> = { user_id: uid, ai_provider: provider };
      if (provider === 'gemini') row.gemini_api_key = key;
      else row.groq_api_key = key;
      const { error } = await supabase
        .from('wholesaler_provider_settings')
        .upsert(row, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      // Never repopulate the input with the stored key; show the
      // mask only (first 4 + last 4 chars).
      setKeyInput('');
      setStatus((cur) => ({
        ai_provider: provider,
        has_gemini_key: provider === 'gemini' ? true : cur?.has_gemini_key ?? false,
        has_groq_key: provider === 'groq' ? true : cur?.has_groq_key ?? false,
        gemini_key_mask: provider === 'gemini' ? maskKey(key) : cur?.gemini_key_mask ?? null,
        groq_key_mask: provider === 'groq' ? maskKey(key) : cur?.groq_key_mask ?? null,
      }));
      setMsg(`Saved — your ${meta.label} key is stored for this account only.`);
    } catch (err) {
      setMsg(`Saving failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!supabase) {
      setTestError('Supabase is not configured on this deployment — the test cannot run.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-wholesale-copilot', {
        body: {
          question: 'Reply with one sentence confirming you are the WholesalingOS Copilot.',
          deal_context: undefined,
        },
      });
      const dataError =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : null;
      if (error) {
        const { message: m } = await extractEdgeFunctionError(error);
        if (/not found|failed to send|failed to fetch|fetch failed|404/i.test(m)) {
          throw new Error('Edge Function not deployed yet — deploy it from Supabase first');
        }
        throw new Error(m);
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
      setTestResult(answer);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'The test could not run.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section
      style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 16, padding: '20px 24px', marginTop: 16 }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>🔑 My Providers — your own AI keys</h2>
      <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 10px', maxWidth: 720 }}>
        The AI Deal Copilot runs on your own key (BYOK) — there is no shared platform key.
        Pick a provider, paste your own free key, and the Copilot answers using your key and your quota.
        Keys are stored as plain text in your own provider-settings row so the Copilot can use them —
        they are not encrypted, so use a free key you can revoke and rotate.
      </p>

      {!supabase ? (
        <p style={{ fontSize: 13.5, color: '#fca5a5', margin: 0 }}>
          Supabase is not configured on this deployment — provider settings are unavailable.
        </p>
      ) : notSetUp ? (
        <p style={{ fontSize: 13.5, color: '#fca5a5', margin: 0 }}>
          Provider settings not set up yet — run the Slice 137 migration.
        </p>
      ) : loading ? (
        <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0 }}>Loading your provider settings…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {(Object.keys(PROVIDER_META) as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setProvider(p);
                  setMsg('');
                  setTestResult(null);
                  setTestError(null);
                }}
                aria-pressed={provider === p}
                style={{
                  padding: '8px 14px', borderRadius: 999, fontSize: 13.5,
                  background: provider === p ? '#065f46' : '#0f172a',
                  color: provider === p ? '#ecfdf5' : '#cbd5e1',
                  border: `1px solid ${provider === p ? 'rgba(110,231,183,0.6)' : 'rgba(148,163,184,0.35)'}`,
                }}
              >
                {PROVIDER_META[p].label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 13.5, margin: '0 0 10px' }}>
            <a href={meta.getKeyUrl} target="_blank" rel="noreferrer">{meta.getKeyText}</a>
            {' '}— free tier, your own account.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={`Paste your ${meta.keyLabel} here`}
              aria-label={meta.keyLabel}
              autoComplete="off"
              style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
            />
            <button type="button" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save key'}
            </button>
          </div>

          <p style={{ fontSize: 13, color: '#94a3b8', margin: '10px 0 0' }}>
            {hasKeyForProvider
              ? `${meta.label} key saved: ${maskForProvider || '••••••••'} (first 4 + last 4 characters only — the full key is never shown here).`
              : `No ${meta.label} key saved yet.`}
            {status?.has_gemini_key && provider !== 'gemini' ? ' A Gemini key is also saved.' : ''}
            {status?.has_groq_key && provider !== 'groq' ? ' A Groq key is also saved.' : ''}
            {' '}Saving a new key replaces the saved key for this provider only.
          </p>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" onClick={sendTest} disabled={testing || !hasKeyForProvider}>
              {testing ? 'Testing…' : 'Send Test'}
            </button>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              Uses your own key and quota.
              {!hasKeyForProvider ? ' Save a key for this provider first.' : ''}
            </span>
          </div>
          {testResult !== null && (
            <p style={{ fontSize: 13.5, color: '#6ee7b7', margin: '10px 0 0' }}>{testResult}</p>
          )}
          {testError !== null && (
            <p role="alert" style={{ fontSize: 13.5, color: '#fca5a5', margin: '10px 0 0' }}>{testError}</p>
          )}

          {msg && <p style={{ fontSize: 13, color: '#6ee7b7', marginTop: 10 }}>{msg}</p>}
        </>
      )}
    </section>
  );
}
