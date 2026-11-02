'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sha256Hex } from '../lib/outreach';

// Slice 31 — lead-ingestion webhook panel. The wholesaler creates a
// per-account key here; only its SHA-256 hash is stored (schema v4.2),
// so the full key is shown ONCE at creation and can never be read back
// — lose it and you revoke it and mint a new one. Their own sources
// (a form backend, "Webhooks by Zapier / Make", a licensed feed on
// their own subscription) POST leads to /api/leads/ingest with the
// key; the route stamps provenance, dedupes, and starts consent at
// 'unknown' (or 'requested_contact' when the record itself says the
// person asked to be contacted).

const ENDPOINT = 'https://wholesalingos.thefeetwashers.com/api/leads/ingest';

interface IngestKey {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function newKeyValue(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'wos_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function WebhookPanel({ userId, onAdded }: { userId: string | null; onAdded?: () => void }) {
  const [keys, setKeys] = useState<IngestKey[]>([]);
  const [label, setLabel] = useState('');
  const [freshKey, setFreshKey] = useState('');
  const [testResult, setTestResult] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!supabase || !userId) return;
    const { data } = await supabase
      .from('ingest_keys')
      .select('id, label, key_prefix, created_at, last_used_at, revoked_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setKeys((data || []) as IngestKey[]);
  }

  useEffect(() => { void refresh(); }, [userId]);

  if (!userId) return null;

  async function createKey() {
    if (!supabase) return;
    const name = label.trim();
    if (!name) { setMsg('Name the key first — the name becomes the source stamped on every lead it delivers (for example: "My seller form" or "Zapier — FSBO alerts").'); return; }
    setBusy(true);
    setMsg('');
    try {
      const value = newKeyValue();
      const hash = await sha256Hex(value);
      const { error } = await supabase.from('ingest_keys').insert({
        user_id: userId, label: name, key_hash: hash, key_prefix: value.slice(0, 9),
      });
      if (error) throw error;
      setFreshKey(value);
      setLabel('');
      setTestResult('');
      await refresh();
    } catch (e) {
      setMsg(`Could not create the key: ${(e as { message?: string })?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('ingest_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', userId);
      if (error) throw error;
      await refresh();
    } catch (e) {
      setMsg(`Could not revoke: ${(e as { message?: string })?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTestResult('Sending…');
    try {
      const res = await fetch('/api/leads/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshKey}` },
        body: JSON.stringify({
          property_address: '123 TEST Webhook Lane',
          city: 'Fort Pierce',
          state: 'FL',
          zip: '34950',
          source: 'Webhook panel test',
        }),
      });
      const text = await res.text();
      setTestResult(`HTTP ${res.status} — ${text}`);
      if (res.ok && onAdded) onAdded();
      void refresh();
    } catch (e) {
      setTestResult(`Request failed: ${e instanceof Error ? e.message : 'network error'}`);
    }
  }

  const active = keys.filter((k) => !k.revoked_at);

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Lead webhook — your sources post leads to you</h2>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        Give a key to a source <em>you</em> control — your own seller-form backend, a
        {' '}<strong>Webhooks by Zapier</strong> or <strong>Make</strong> POST action, or a licensed feed running on
        your own subscription — and every lead it sends lands in your pipeline with its source stamped on it,
        duplicates skipped, and consent starting at "unknown". The platform does not scrape or skip-trace
        anything; this is a door, not a vacuum.
      </p>
      <p style={{ fontSize: 13.5 }}>
        <strong>Endpoint:</strong> <code>{ENDPOINT}</code><br />
        <strong>Header:</strong> <code>Authorization: Bearer &lt;your key&gt;</code> (or <code>x-api-key</code>)<br />
        <strong>Body (JSON):</strong> one lead, a list, or <code>{'{ "leads": [...] }'}</code> — up to 100 per request.
        Fields: <code>property_address</code> (required), <code>city</code>, <code>state</code>, <code>zip</code>,
        {' '}<code>county</code>, <code>owner_name</code>, <code>mailing_address</code>, <code>phones</code>,{' '}
        <code>emails</code>, <code>source</code>, and <code>parcel_id</code> / <code>assessed_value</code> /{' '}
        <code>opening_bid</code> / <code>auction_date</code> (saved to the lead's notes). The nested
        feed-schema shape (<code>location.address</code>, <code>source.name</code>…) works too.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ flex: '1 1 260px' }} placeholder="Key name — e.g. My seller form" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button disabled={busy} onClick={createKey}>{busy ? 'Working…' : 'Create a key'}</button>
      </div>
      {msg && <p style={{ fontSize: 13.5 }}>{msg}</p>}
      {freshKey && (
        <div style={{ background: '#052e16', padding: 12, borderRadius: 8, marginTop: 10 }}>
          <p style={{ fontSize: 13.5, marginTop: 0 }}>
            <strong>Your new key — copy it now, it is shown only once</strong> (only a hash is stored):
          </p>
          <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{freshKey}</code>
          <p style={{ fontSize: 13, marginBottom: 6 }}>
            Test it right here before you wire it into anything:
          </p>
          <button disabled={busy} onClick={sendTest}>Send a test lead with this key</button>
          {testResult && <p style={{ fontSize: 13, wordBreak: 'break-all' }}>{testResult}</p>}
          <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
            The test sends one lead for "123 TEST Webhook Lane" — delete it from your Leads list if you
            don't want it. When this panel reloads, the test button goes away with the key; test later
            sends come from your own Zapier/Make/form using the key you saved.
          </p>
        </div>
      )}
      {active.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 13.5 }}>Your active keys</strong>
          {active.map((k) => (
            <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, marginTop: 6 }}>
              <span><code>{k.key_prefix}…</code> — {k.label}</span>
              <span style={{ color: '#94a3b8' }}>
                created {k.created_at.slice(0, 10)} · last used {k.last_used_at ? k.last_used_at.slice(0, 16).replace('T', ' ') : 'never'}
              </span>
              <button disabled={busy} onClick={() => revoke(k.id)}>Revoke</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
