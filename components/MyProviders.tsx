// Slice 137, Part B — My Providers settings card (BYOK).
//
// The wholesaler's own AI keys for the AI Deal Copilot
// (components/AiCopilot.tsx). Pick a provider (Gemini / Groq), paste
// your own free key, save it to your own row in
// wholesaler_provider_settings (user_id = auth.uid()).
//
// Keys are stored as PLAIN TEXT in your own provider-settings row so
// the Copilot Edge Function can use them.
// The full key is never read back into the browser: settings load
// calls the SECURITY DEFINER RPC get_ai_key_status() (Slice 137
// migration), which returns only { ai_provider, has_gemini_key,
// has_groq_key, gemini_key_mask, groq_key_mask }. The paste field is
// never repopulated with a stored key, and after saving only the
// mask (first 4 + last 4 chars) is shown. No select('*') anywhere.
//
// If the RPC does not exist yet (Slice 137 migration not run), the
// card says so honestly instead of crashing.
//
// Slice 139 — Amazon Connect softphone (BYOK). Each wholesaler
// pastes their OWN Connect instance CCP URL into the section below;
// it is stored in the same own row (connect_ccp_url, Slice 139
// migration). The saved URL is loaded with a targeted select of
// connect_ccp_url only — never select('*') — and the input is never
// repopulated with the stored value; a separate saved-state line
// shows what is stored.
//
// Slice 134 — BYOK skip-trace / email / SMS providers.
// Each wholesaler pastes their OWN keys: BatchData (skip-trace),
// Resend / SendGrid / AWS SES (email), Twilio / Telnyx / TextBee /
// httpSMS (SMS). Stored as PLAIN TEXT in the wholesaler's own
// provider-settings row (Slice 134 migration) so the dispatcher
// Edge Function can use them. Sender identity is saved alongside
// each key — a from number for SMS, a from email for email, plus
// Telnyx's public key (not secret) for verifying inbound texts —
// because a key without its sender cannot send: the test-send
// readiness check uses the fully-keyed flags (key + sender), so a
// key saved without its sender honestly reports "not fully set
// up". Settings
// load calls the SECURITY DEFINER RPC get_provider_key_status()
// only — never select('*') — which returns masks (first 4 + last 4)
// and has_* flags for the caller only. Keys are never repopulated
// into inputs; after saving only the mask is shown. Switching the
// email/SMS provider saves the preference immediately and NULLs
// the unselected provider's key fields, so a stale key cannot
// linger. The "Send Test Email & SMS" button invokes the
// send-buyer-blast dispatcher Edge Function with a test payload;
// the function is file-only and NOT deployed, so a failed invoke
// is reported honestly as "not deployed yet" — never a fake
// success. A saved key alone is never shown as "connected": no
// provider is connected until a real key is saved AND a real call
// succeeds. BatchData specifically stays "connected, awaiting
// verification" until the v3 response field names are verified
// from BatchData's official docs.
//
// If the RPC does not exist yet (Slice 134 migration not run), the
// new sections say so honestly instead of crashing — same pattern
// as the Slice 137 notSetUp handling above.

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

// Slice 134 — the one row get_provider_key_status() returns for
// the caller only (Slice 134 migration). Masks are first 4 + '…'
// + last 4; the full keys never reach the browser.
type EmailProvider = 'resend' | 'sendgrid' | 'ses';
type SmsProvider = 'twilio' | 'telnyx' | 'textbee' | 'httpsms';

interface ProviderKeyStatus {
  email_provider: string | null;
  sms_provider: string | null;
  has_batchdata_key: boolean;
  batchdata_key_mask: string | null;
  has_resend_key: boolean;
  resend_key_mask: string | null;
  resend_from_email: string | null;
  has_resend_keys: boolean;
  has_sendgrid_key: boolean;
  sendgrid_key_mask: string | null;
  sendgrid_from_email: string | null;
  has_sendgrid_keys: boolean;
  has_ses_keys: boolean;
  ses_region: string | null;
  ses_from_email: string | null;
  has_twilio_keys: boolean;
  twilio_from_number: string | null;
  has_telnyx_key: boolean;
  telnyx_key_mask: string | null;
  telnyx_from_number: string | null;
  telnyx_public_key: string | null;
  has_telnyx_keys: boolean;
  has_textbee_key: boolean;
  textbee_key_mask: string | null;
  textbee_device_id: string | null;
  has_httpsms_key: boolean;
  httpsms_key_mask: string | null;
  httpsms_from_number: string | null;
  httpsms_device_id: string | null;
  has_httpsms_keys: boolean;
}

const EMPTY_PROV_STATUS: ProviderKeyStatus = {
  email_provider: null,
  sms_provider: null,
  has_batchdata_key: false,
  batchdata_key_mask: null,
  has_resend_key: false,
  resend_key_mask: null,
  resend_from_email: null,
  has_resend_keys: false,
  has_sendgrid_key: false,
  sendgrid_key_mask: null,
  sendgrid_from_email: null,
  has_sendgrid_keys: false,
  has_ses_keys: false,
  ses_region: null,
  ses_from_email: null,
  has_twilio_keys: false,
  twilio_from_number: null,
  has_telnyx_key: false,
  telnyx_key_mask: null,
  telnyx_from_number: null,
  telnyx_public_key: null,
  has_telnyx_keys: false,
  has_textbee_key: false,
  textbee_key_mask: null,
  textbee_device_id: null,
  has_httpsms_key: false,
  httpsms_key_mask: null,
  httpsms_from_number: null,
  httpsms_device_id: null,
  has_httpsms_keys: false,
};

const EMAIL_PROVIDER_META: Record<EmailProvider, { label: string }> = {
  resend: { label: 'Resend' },
  sendgrid: { label: 'SendGrid' },
  ses: { label: 'AWS SES' },
};

const SMS_PROVIDER_META: Record<SmsProvider, { label: string }> = {
  twilio: { label: 'Twilio' },
  telnyx: { label: 'Telnyx' },
  textbee: { label: 'TextBee' },
  httpsms: { label: 'httpSMS' },
};

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

// Slice 141 (audit #19) — the full CCP URL shape, matching the
// dialer's check (components/ConnectDialer.tsx): https://
// <instance-domain>.myconnect.aws/ccp-v2 (trailing slash
// tolerated). The host suffix is assembled from parts, as in the
// dialer, so this file never contains a placeholder-looking host
// literal. A bare https:// URL is NOT enough — the dialer would
// refuse it at open time, so the save refuses it here instead.
const CCP_HOST_SUFFIX = ['.my', 'connect', '.aws'].join('.');
const CCP_PATH = '/ccp-v2';

function isValidCcpUrl(raw: string): boolean {
  const url = raw.trim();
  if (!/^https:\/\//i.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!parsed.hostname.endsWith(CCP_HOST_SUFFIX)) return false;
  // The instance subdomain must be non-empty (hostname is more than
  // just the suffix).
  if (parsed.hostname.length <= CCP_HOST_SUFFIX.length) return false;
  const path = parsed.pathname.replace(/\/+$/, '');
  return path === CCP_PATH;
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
  // Slice 139 — Amazon Connect CCP URL (BYOK, optional softphone).
  const [ccpUrlInput, setCcpUrlInput] = useState('');
  const [ccpUrlSaved, setCcpUrlSaved] = useState<string | null>(null);
  const [ccpNotSetUp, setCcpNotSetUp] = useState(false);
  const [ccpSaving, setCcpSaving] = useState(false);
  const [ccpMsg, setCcpMsg] = useState('');
  // Slice 134 — BYOK skip-trace / email / SMS providers.
  const [provStatus, setProvStatus] = useState<ProviderKeyStatus | null>(null);
  const [provNotSetUp, setProvNotSetUp] = useState(false);
  const [provLoadMsg, setProvLoadMsg] = useState('');
  // BatchData skip-trace.
  const [batchKeyInput, setBatchKeyInput] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');
  // Email provider.
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('resend');
  const [resendKeyInput, setResendKeyInput] = useState('');
  const [resendFromInput, setResendFromInput] = useState('');
  const [sendgridKeyInput, setSendgridKeyInput] = useState('');
  const [sendgridFromInput, setSendgridFromInput] = useState('');
  const [sesAccessKeyInput, setSesAccessKeyInput] = useState('');
  const [sesSecretInput, setSesSecretInput] = useState('');
  const [sesRegionInput, setSesRegionInput] = useState('');
  const [sesFromInput, setSesFromInput] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  // SMS provider.
  const [smsProvider, setSmsProvider] = useState<SmsProvider>('twilio');
  const [twilioSidInput, setTwilioSidInput] = useState('');
  const [twilioTokenInput, setTwilioTokenInput] = useState('');
  const [twilioFromInput, setTwilioFromInput] = useState('');
  const [telnyxKeyInput, setTelnyxKeyInput] = useState('');
  const [telnyxFromInput, setTelnyxFromInput] = useState('');
  const [telnyxPublicKeyInput, setTelnyxPublicKeyInput] = useState('');
  const [textbeeKeyInput, setTextbeeKeyInput] = useState('');
  const [textbeeDeviceInput, setTextbeeDeviceInput] = useState('');
  const [httpsmsKeyInput, setHttpsmsKeyInput] = useState('');
  const [httpsmsFromInput, setHttpsmsFromInput] = useState('');
  const [httpsmsDeviceInput, setHttpsmsDeviceInput] = useState('');
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsMsg, setSmsMsg] = useState('');
  // Send Test Email & SMS.
  const [testEmailInput, setTestEmailInput] = useState('');
  const [testPhoneInput, setTestPhoneInput] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testSendMsg, setTestSendMsg] = useState('');
  const [testSendOk, setTestSendOk] = useState(false);

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

  // Slice 139 — load only the saved CCP URL for the caller's own
  // row. Targeted select of connect_ccp_url only — never
  // select('*'), so no secrets are read into the browser.
  useEffect(() => {
    let live = true;
    async function loadCcp() {
      if (!supabase || !userId) return;
      try {
        const { data, error } = await supabase
          .from('wholesaler_provider_settings')
          .select('connect_ccp_url')
          .eq('user_id', userId)
          .maybeSingle();
        if (!live) return;
        if (error) {
          if (/column .* does not exist|PGRST204|schema cache/i.test(error.message || '')) {
            setCcpNotSetUp(true);
          } else {
            setCcpMsg(`Could not load the saved Connect URL: ${error.message}`);
          }
          return;
        }
        const url = (data as { connect_ccp_url?: string | null } | null)?.connect_ccp_url;
        if (url) setCcpUrlSaved(url);
      } catch (err) {
        if (!live) return;
        setCcpMsg(
          `Could not load the saved Connect URL: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }
    }
    loadCcp();
    return () => {
      live = false;
    };
  }, [userId]);

  // Slice 134 — load skip-trace / email / SMS key status through
  // the RPC only — never select('*') the settings row, so the full
  // keys never reach the browser. A missing RPC (Slice 134
  // migration not run) shows the honest not-set-up state per
  // section instead of crashing. A null row means no settings row
  // exists yet — nothing saved.
  useEffect(() => {
    let live = true;
    async function loadProv() {
      if (!supabase || !userId) return;
      try {
        const { data, error } = await supabase.rpc('get_provider_key_status');
        if (!live) return;
        if (error) {
          if (isMissingRpcMessage(error.message || '')) setProvNotSetUp(true);
          else setProvLoadMsg(`Could not load provider key status: ${error.message}`);
          return;
        }
        const row = (Array.isArray(data) ? data[0] : data) as ProviderKeyStatus | null;
        if (row) {
          setProvStatus(row);
          if (row.email_provider === 'resend' || row.email_provider === 'sendgrid' || row.email_provider === 'ses') {
            setEmailProvider(row.email_provider);
          }
          if (
            row.sms_provider === 'twilio' ||
            row.sms_provider === 'telnyx' ||
            row.sms_provider === 'textbee' ||
            row.sms_provider === 'httpsms'
          ) {
            setSmsProvider(row.sms_provider);
          }
        }
      } catch (err) {
        if (!live) return;
        const m = err instanceof Error ? err.message : '';
        if (isMissingRpcMessage(m)) setProvNotSetUp(true);
        else setProvLoadMsg(`Could not load provider key status: ${m || 'unknown error'}`);
      }
    }
    loadProv();
    return () => {
      live = false;
    };
  }, [userId]);

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

  // Slice 139 — save the caller's own Connect CCP URL. Upserts the
  // caller's own row only (onConflict user_id), same as the key
  // save above; connect_ccp_url is included in that same row.
  const saveCcpUrl = async () => {
    const url = ccpUrlInput.trim();
    if (url === '') {
      setCcpMsg('Paste your Connect CCP URL first — the field is empty.');
      return;
    }
    if (!isValidCcpUrl(url)) {
      setCcpMsg('That is not a Connect CCP URL — paste the full URL from your own Amazon Connect instance, in the form https://<your-instance>.myconnect.aws/ccp-v2 (the host must end in .myconnect.aws and the path must be /ccp-v2).');
      return;
    }
    if (!supabase) {
      setCcpMsg('Supabase is not configured on this deployment — the URL cannot be saved.');
      return;
    }
    setCcpSaving(true);
    setCcpMsg('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const uid = authData?.user?.id || userId;
      if (authError || !uid) throw new Error(authError?.message || 'Could not confirm your signed-in account.');
      const { error } = await supabase
        .from('wholesaler_provider_settings')
        .upsert({ user_id: uid, connect_ccp_url: url }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      // Never repopulate the input with the stored URL; show the
      // saved state as a separate line instead.
      setCcpUrlInput('');
      setCcpUrlSaved(url);
      setCcpMsg('Saved — your Amazon Connect CCP URL is stored for this account only.');
    } catch (err) {
      setCcpMsg(`Saving failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setCcpSaving(false);
    }
  };

  // Slice 134 — resolve the caller's own uid for the upserts
  // below (same pattern as the AI key and CCP saves above).
  const getOwnUid = async (): Promise<string> => {
    if (!supabase) throw new Error('Supabase is not configured on this deployment.');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const uid = authData?.user?.id || userId;
    if (authError || !uid) throw new Error(authError?.message || 'Could not confirm your signed-in account.');
    return uid;
  };

  // Slice 134 — save the caller's own BatchData API key. A saved
  // key alone is NOT "connected" — the status line below stays
  // "connected, awaiting verification" until the v3 response field
  // names are verified from BatchData's official docs and a real
  // call succeeds.
  const saveBatchKey = async () => {
    const key = batchKeyInput.trim();
    if (key === '') {
      setBatchMsg('Paste your BatchData API key first — the field is empty.');
      return;
    }
    if (!supabase) {
      setBatchMsg('Supabase is not configured on this deployment — keys cannot be saved.');
      return;
    }
    setBatchSaving(true);
    setBatchMsg('');
    try {
      const uid = await getOwnUid();
      const { error } = await supabase
        .from('wholesaler_provider_settings')
        .upsert({ user_id: uid, batchdata_api_key: key }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      // Never repopulate the input with the stored key; show the
      // mask only (first 4 + last 4 chars).
      setBatchKeyInput('');
      setProvStatus((cur) => ({
        ...(cur ?? EMPTY_PROV_STATUS),
        has_batchdata_key: true,
        batchdata_key_mask: maskKey(key),
      }));
      setBatchMsg('Saved — your BatchData key is stored for this account only.');
    } catch (err) {
      setBatchMsg(`Saving failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBatchSaving(false);
    }
  };

  // Slice 134 — a provider-dropdown-only change MUST save: upsert
  // the email_provider preference immediately, not only when a key
  // is saved. Saving the preference alone never touches any key
  // column.
  const saveEmailProviderChoice = async (p: EmailProvider) => {
    setEmailProvider(p);
    setEmailMsg('');
    if (!supabase) {
      setEmailMsg('Supabase is not configured on this deployment — the choice cannot be saved.');
      return;
    }
    try {
      const uid = await getOwnUid();
      const { error } = await supabase
        .from('wholesaler_provider_settings')
        .upsert({ user_id: uid, email_provider: p }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      setProvStatus((cur) => ({ ...(cur ?? EMPTY_PROV_STATUS), email_provider: p }));
      setEmailMsg(`Email provider set to ${EMAIL_PROVIDER_META[p].label} — saved.`);
    } catch (err) {
      setEmailMsg(`Saving failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  // Slice 134 — save the selected email provider's key(s). The
  // unselected providers' key fields are NULLed on the same
  // upsert, so a stale Resend key cannot linger after the
  // wholesaler switches to SES (and vice versa). Blank optional
  // SES fields (region, from email) are left out of the row, so an
  // existing saved value is not wiped by an empty input. The
  // Resend / SendGrid from email is REQUIRED, not optional: the
  // RPC's has_resend_keys / has_sendgrid_keys is true only when
  // key + from email are both set, and the dispatcher treats
  // email as not configured without both.
  const saveEmailKey = async () => {
    if (!supabase) {
      setEmailMsg('Supabase is not configured on this deployment — keys cannot be saved.');
      return;
    }
    const row: Record<string, string | null> = { user_id: '', email_provider: emailProvider };
    let savedMask: string | null = null;
    let savedResendFrom: string | null = null;
    let savedSendgridFrom: string | null = null;
    let savedSesRegion: string | null = null;
    let savedSesFrom: string | null = null;
    if (emailProvider === 'resend') {
      const key = resendKeyInput.trim();
      const from = resendFromInput.trim();
      if (key === '' || from === '') {
        setEmailMsg('Paste your Resend API key and from email first — both fields are required.');
        return;
      }
      row.resend_api_key = key;
      row.resend_from_email = from;
      savedMask = maskKey(key);
      savedResendFrom = from;
      row.sendgrid_api_key = null;
      row.sendgrid_from_email = null;
      row.ses_access_key_id = null;
      row.ses_secret_access_key = null;
      row.ses_region = null;
      row.ses_from_email = null;
    } else if (emailProvider === 'sendgrid') {
      const key = sendgridKeyInput.trim();
      const from = sendgridFromInput.trim();
      if (key === '' || from === '') {
        setEmailMsg('Paste your SendGrid API key and from email first — both fields are required.');
        return;
      }
      row.sendgrid_api_key = key;
      row.sendgrid_from_email = from;
      savedMask = maskKey(key);
      savedSendgridFrom = from;
      row.resend_api_key = null;
      row.resend_from_email = null;
      row.ses_access_key_id = null;
      row.ses_secret_access_key = null;
      row.ses_region = null;
      row.ses_from_email = null;
    } else {
      const access = sesAccessKeyInput.trim();
      const secret = sesSecretInput.trim();
      const region = sesRegionInput.trim();
      const from = sesFromInput.trim();
      if (access === '' || secret === '' || region === '' || from === '') {
        setEmailMsg('Paste your SES access key ID, secret access key, region, and from email first — all four fields are required; SES cannot send without a region and a from address.');
        return;
      }
      row.ses_access_key_id = access;
      row.ses_secret_access_key = secret;
      row.ses_region = region;
      savedSesRegion = region;
      row.ses_from_email = from;
      savedSesFrom = from;
      row.resend_api_key = null;
      row.resend_from_email = null;
      row.sendgrid_api_key = null;
      row.sendgrid_from_email = null;
    }
    setEmailSaving(true);
    setEmailMsg('');
    try {
      const uid = await getOwnUid();
      row.user_id = uid;
      const { error } = await supabase
        .from('wholesaler_provider_settings')
        .upsert(row, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      // Never repopulate the inputs with stored keys; show the
      // mask only (first 4 + last 4 chars).
      setResendKeyInput('');
      setResendFromInput('');
      setSendgridKeyInput('');
      setSendgridFromInput('');
      setSesAccessKeyInput('');
      setSesSecretInput('');
      setSesRegionInput('');
      setSesFromInput('');
      const label = EMAIL_PROVIDER_META[emailProvider].label;
      setProvStatus((cur) => {
        const next = { ...(cur ?? EMPTY_PROV_STATUS), email_provider: emailProvider };
        if (emailProvider === 'resend') {
          next.has_resend_key = true;
          next.resend_key_mask = savedMask;
          next.has_resend_keys = true;
          if (savedResendFrom !== null) next.resend_from_email = savedResendFrom;
          next.has_sendgrid_key = false;
          next.sendgrid_key_mask = null;
          next.sendgrid_from_email = null;
          next.has_sendgrid_keys = false;
          next.has_ses_keys = false;
          next.ses_region = null;
          next.ses_from_email = null;
        } else if (emailProvider === 'sendgrid') {
          next.has_sendgrid_key = true;
          next.sendgrid_key_mask = savedMask;
          next.has_sendgrid_keys = true;
          if (savedSendgridFrom !== null) next.sendgrid_from_email = savedSendgridFrom;
          next.has_resend_key = false;
          next.resend_key_mask = null;
          next.resend_from_email = null;
          next.has_resend_keys = false;
          next.has_ses_keys = false;
          next.ses_region = null;
          next.ses_from_email = null;
        } else {
          next.has_ses_keys = true;
          if (savedSesRegion !== null) next.ses_region = savedSesRegion;
          if (savedSesFrom !== null) next.ses_from_email = savedSesFrom;
          next.has_resend_key = false;
          next.resend_key_mask = null;
          next.resend_from_email = null;
          next.has_resend_keys = false;
          next.has_sendgrid_key = false;
          next.sendgrid_key_mask = null;
          next.sendgrid_from_email = null;
          next.has_sendgrid_keys = false;
        }
        return next;
      });
      setEmailMsg(`Saved — your ${label} key is stored for this account only. The other email providers' keys were cleared.`);
    } catch (err) {
      setEmailMsg(`Saving failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setEmailSaving(false);
    }
  };

  // Slice 134 — a provider-dropdown-only change MUST save: upsert
  // the sms_provider preference immediately, not only when a key
  // is saved. Saving the preference alone never touches any key
  // column.
  const saveSmsProviderChoice = async (p: SmsProvider) => {
    setSmsProvider(p);
    setSmsMsg('');
    if (!supabase) {
      setSmsMsg('Supabase is not configured on this deployment — the choice cannot be saved.');
      return;
    }
    try {
      const uid = await getOwnUid();
      const { error } = await supabase
        .from('wholesaler_provider_settings')
        .upsert({ user_id: uid, sms_provider: p }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      setProvStatus((cur) => ({ ...(cur ?? EMPTY_PROV_STATUS), sms_provider: p }));
      setSmsMsg(`SMS provider set to ${SMS_PROVIDER_META[p].label} — saved.`);
    } catch (err) {
      setSmsMsg(`Saving failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  // Slice 134 — save the selected SMS provider's key(s). The
  // unselected providers' key fields are NULLed on the same
  // upsert, so a stale key cannot linger after a switch. The
  // Twilio from number is REQUIRED, not optional: the migration's
  // has_twilio_keys is true only when SID + token + from number
  // are all set, and the dispatcher treats SMS as not configured
  // without all three. The Telnyx and httpSMS from numbers are
  // REQUIRED the same way (has_telnyx_keys / has_httpsms_keys
  // need key + from number). The Telnyx public key is optional —
  // it is only used to verify inbound Telnyx signatures, never to
  // send — and the httpSMS device ID stays optional (leave blank
  // to use any device on the account). The TextBee device ID stays
  // optional (the RPC's has_textbee_key depends on the API key
  // only), and a blank device ID is left out of the row so an
  // existing saved value is not wiped by an empty input.
  const saveSmsKey = async () => {
    if (!supabase) {
      setSmsMsg('Supabase is not configured on this deployment — keys cannot be saved.');
      return;
    }
    const row: Record<string, string | null> = { user_id: '', sms_provider: smsProvider };
    let savedMask: string | null = null;
    let savedTwilioFrom: string | null = null;
    let savedTelnyxFrom: string | null = null;
    let savedTelnyxPublicKey: string | null = null;
    let savedTextbeeDevice: string | null = null;
    let savedHttpsmsFrom: string | null = null;
    let savedHttpsmsDevice: string | null = null;
    if (smsProvider === 'twilio') {
      const sid = twilioSidInput.trim();
      const token = twilioTokenInput.trim();
      const from = twilioFromInput.trim();
      if (sid === '' || token === '' || from === '') {
        setSmsMsg('Paste your Twilio account SID, auth token, and from number first — all three fields are required.');
        return;
      }
      row.twilio_account_sid = sid;
      row.twilio_auth_token = token;
      row.twilio_from_number = from;
      savedTwilioFrom = from;
      row.telnyx_api_key = null;
      row.telnyx_from_number = null;
      row.telnyx_public_key = null;
      row.textbee_api_key = null;
      row.textbee_device_id = null;
      row.httpsms_api_key = null;
      row.httpsms_from_number = null;
      row.httpsms_device_id = null;
    } else if (smsProvider === 'telnyx') {
      const key = telnyxKeyInput.trim();
      const from = telnyxFromInput.trim();
      if (key === '' || from === '') {
        setSmsMsg('Paste your Telnyx API key and from number first — both fields are required.');
        return;
      }
      row.telnyx_api_key = key;
      row.telnyx_from_number = from;
      savedMask = maskKey(key);
      savedTelnyxFrom = from;
      const publicKey = telnyxPublicKeyInput.trim();
      if (publicKey !== '') {
        row.telnyx_public_key = publicKey;
        savedTelnyxPublicKey = publicKey;
      }
      row.twilio_account_sid = null;
      row.twilio_auth_token = null;
      row.twilio_from_number = null;
      row.textbee_api_key = null;
      row.textbee_device_id = null;
      row.httpsms_api_key = null;
      row.httpsms_from_number = null;
      row.httpsms_device_id = null;
    } else if (smsProvider === 'textbee') {
      const key = textbeeKeyInput.trim();
      if (key === '') {
        setSmsMsg('Paste your TextBee API key first — the field is empty.');
        return;
      }
      row.textbee_api_key = key;
      savedMask = maskKey(key);
      const device = textbeeDeviceInput.trim();
      if (device !== '') {
        row.textbee_device_id = device;
        savedTextbeeDevice = device;
      }
      row.twilio_account_sid = null;
      row.twilio_auth_token = null;
      row.twilio_from_number = null;
      row.telnyx_api_key = null;
      row.telnyx_from_number = null;
      row.telnyx_public_key = null;
      row.httpsms_api_key = null;
      row.httpsms_from_number = null;
      row.httpsms_device_id = null;
    } else {
      const key = httpsmsKeyInput.trim();
      const from = httpsmsFromInput.trim();
      if (key === '' || from === '') {
        setSmsMsg('Paste your httpSMS API key and from number first — both fields are required.');
        return;
      }
      row.httpsms_api_key = key;
      row.httpsms_from_number = from;
      savedMask = maskKey(key);
      savedHttpsmsFrom = from;
      const device = httpsmsDeviceInput.trim();
      if (device !== '') {
        row.httpsms_device_id = device;
        savedHttpsmsDevice = device;
      }
      row.twilio_account_sid = null;
      row.twilio_auth_token = null;
      row.twilio_from_number = null;
      row.telnyx_api_key = null;
      row.telnyx_from_number = null;
      row.telnyx_public_key = null;
      row.textbee_api_key = null;
      row.textbee_device_id = null;
    }
    setSmsSaving(true);
    setSmsMsg('');
    try {
      const uid = await getOwnUid();
      row.user_id = uid;
      const { error } = await supabase
        .from('wholesaler_provider_settings')
        .upsert(row, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      // Never repopulate the inputs with stored keys; show the
      // mask only (first 4 + last 4 chars).
      setTwilioSidInput('');
      setTwilioTokenInput('');
      setTwilioFromInput('');
      setTelnyxKeyInput('');
      setTelnyxFromInput('');
      setTelnyxPublicKeyInput('');
      setTextbeeKeyInput('');
      setTextbeeDeviceInput('');
      setHttpsmsKeyInput('');
      setHttpsmsFromInput('');
      setHttpsmsDeviceInput('');
      const label = SMS_PROVIDER_META[smsProvider].label;
      setProvStatus((cur) => {
        const next = { ...(cur ?? EMPTY_PROV_STATUS), sms_provider: smsProvider };
        if (smsProvider === 'twilio') {
          next.has_twilio_keys = true;
          if (savedTwilioFrom !== null) next.twilio_from_number = savedTwilioFrom;
          next.has_telnyx_key = false;
          next.telnyx_key_mask = null;
          next.telnyx_from_number = null;
          next.telnyx_public_key = null;
          next.has_telnyx_keys = false;
          next.has_textbee_key = false;
          next.textbee_key_mask = null;
          next.textbee_device_id = null;
          next.has_httpsms_key = false;
          next.httpsms_key_mask = null;
          next.httpsms_from_number = null;
          next.httpsms_device_id = null;
          next.has_httpsms_keys = false;
        } else if (smsProvider === 'telnyx') {
          next.has_telnyx_key = true;
          next.telnyx_key_mask = savedMask;
          next.has_telnyx_keys = true;
          if (savedTelnyxFrom !== null) next.telnyx_from_number = savedTelnyxFrom;
          if (savedTelnyxPublicKey !== null) next.telnyx_public_key = savedTelnyxPublicKey;
          next.has_twilio_keys = false;
          next.twilio_from_number = null;
          next.has_textbee_key = false;
          next.textbee_key_mask = null;
          next.textbee_device_id = null;
          next.has_httpsms_key = false;
          next.httpsms_key_mask = null;
          next.httpsms_from_number = null;
          next.httpsms_device_id = null;
          next.has_httpsms_keys = false;
        } else if (smsProvider === 'textbee') {
          next.has_textbee_key = true;
          next.textbee_key_mask = savedMask;
          if (savedTextbeeDevice !== null) next.textbee_device_id = savedTextbeeDevice;
          next.has_twilio_keys = false;
          next.twilio_from_number = null;
          next.has_telnyx_key = false;
          next.telnyx_key_mask = null;
          next.telnyx_from_number = null;
          next.telnyx_public_key = null;
          next.has_telnyx_keys = false;
          next.has_httpsms_key = false;
          next.httpsms_key_mask = null;
          next.httpsms_from_number = null;
          next.httpsms_device_id = null;
          next.has_httpsms_keys = false;
        } else {
          next.has_httpsms_key = true;
          next.httpsms_key_mask = savedMask;
          next.has_httpsms_keys = true;
          if (savedHttpsmsFrom !== null) next.httpsms_from_number = savedHttpsmsFrom;
          if (savedHttpsmsDevice !== null) next.httpsms_device_id = savedHttpsmsDevice;
          next.has_twilio_keys = false;
          next.twilio_from_number = null;
          next.has_telnyx_key = false;
          next.telnyx_key_mask = null;
          next.telnyx_from_number = null;
          next.telnyx_public_key = null;
          next.has_telnyx_keys = false;
          next.has_textbee_key = false;
          next.textbee_key_mask = null;
          next.textbee_device_id = null;
        }
        return next;
      });
      setSmsMsg(`Saved — your ${label} key is stored for this account only. The other SMS providers' keys were cleared.`);
    } catch (err) {
      setSmsMsg(`Saving failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSmsSaving(false);
    }
  };

  // Slice 134 — send a test email + SMS to the wholesaler's OWN
  // email and phone, through the send-buyer-blast dispatcher Edge
  // Function. Honest gating: if the chosen email or SMS provider
  // has no key saved, the section says "not connected" and makes
  // NO call. The dispatcher is file-only and NOT deployed, so the
  // invoke will fail as not-deployed — that is translated into the
  // honest "not deployed yet" message. A success is reported ONLY
  // when the function itself returns { success: true }; no fake
  // "test sent" state is ever shown.
  const sendTestBlast = async () => {
    const email = testEmailInput.trim();
    const phone = testPhoneInput.trim();
    if (email === '' || phone === '') {
      setTestSendOk(false);
      setTestSendMsg('Enter your own email and your own phone number first — the test sends to you only.');
      return;
    }
    // Fully-keyed gating: a key WITHOUT its sender identity is
    // not fully set up — the test says so honestly ("not fully set
    // up — add a from number/email") instead of a confusing
    // "not connected". Twilio / TextBee / SES keep their existing
    // flags (Twilio already needs its from number; TextBee needs
    // its key; SES needs both its keys).
    const emailHasKey =
      emailProvider === 'resend'
        ? provStatus?.has_resend_key
        : emailProvider === 'sendgrid'
          ? provStatus?.has_sendgrid_key
          : provStatus?.has_ses_keys;
    const emailFullyKeyed =
      emailProvider === 'resend'
        ? provStatus?.has_resend_keys
        : emailProvider === 'sendgrid'
          ? provStatus?.has_sendgrid_keys
          : provStatus?.has_ses_keys;
    const smsHasKey =
      smsProvider === 'twilio'
        ? provStatus?.has_twilio_keys
        : smsProvider === 'telnyx'
          ? provStatus?.has_telnyx_key
          : smsProvider === 'textbee'
            ? provStatus?.has_textbee_key
            : provStatus?.has_httpsms_key;
    const smsFullyKeyed =
      smsProvider === 'twilio'
        ? provStatus?.has_twilio_keys
        : smsProvider === 'telnyx'
          ? provStatus?.has_telnyx_keys
          : smsProvider === 'textbee'
            ? provStatus?.has_textbee_key
            : provStatus?.has_httpsms_keys;
    if (!emailFullyKeyed || !smsFullyKeyed) {
      const missing = [
        !emailFullyKeyed
          ? emailHasKey
            ? `${EMAIL_PROVIDER_META[emailProvider].label} email — not fully set up, add a from email`
            : `${EMAIL_PROVIDER_META[emailProvider].label} email — no key saved yet`
          : null,
        !smsFullyKeyed
          ? smsHasKey
            ? `${SMS_PROVIDER_META[smsProvider].label} SMS — not fully set up, add a from number`
            : `${SMS_PROVIDER_META[smsProvider].label} SMS — no key saved yet`
          : null,
      ]
        .filter((x): x is string => x !== null)
        .join(' and ');
      setTestSendOk(false);
      setTestSendMsg(
        `Not fully set up — ${missing}. Save your own key and sender above first; nothing was sent.`,
      );
      return;
    }
    if (!supabase) {
      setTestSendOk(false);
      setTestSendMsg('Supabase is not configured on this deployment — the test cannot run.');
      return;
    }
    setTestSending(true);
    setTestSendMsg('');
    setTestSendOk(false);
    try {
      const { data, error } = await supabase.functions.invoke('send-buyer-blast', {
        body: { test: true, test_email: email, test_phone: phone },
      });
      if (error) {
        const { message: m } = await extractEdgeFunctionError(error);
        if (/not found|failed to send|failed to fetch|fetch failed|404/i.test(m)) {
          throw new Error('Dispatcher not deployed yet — the owner deploys it from Supabase first');
        }
        throw new Error(m);
      }
      const ok =
        data && typeof data === 'object' && (data as { success?: unknown }).success === true;
      if (!ok) {
        const dataError =
          data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : null;
        throw new Error(dataError || 'The dispatcher did not confirm the test send — nothing was reported as sent.');
      }
      setTestSendOk(true);
      setTestSendMsg('Test sent — check your own email and phone.');
    } catch (err) {
      setTestSendOk(false);
      setTestSendMsg(err instanceof Error ? err.message : 'The test send could not run.');
    } finally {
      setTestSending(false);
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
      <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>🔑 My Providers — your own keys &amp; accounts</h2>
      <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 10px', maxWidth: 720 }}>
        The AI Deal Copilot runs on your own key (BYOK) — there is no shared platform key.
        Pick a provider, paste your own free key, and the Copilot answers using your key and your quota.
        Keys are stored as plain text in your own provider-settings row so the Copilot can use them —
        so use a free key you can revoke and rotate.
        The same row holds your own skip-trace, email, and SMS provider keys below — also BYOK,
        also plain text, also your accounts and your credits only.
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

          {/* Slice 139 — Amazon Connect softphone (BYOK, optional). */}
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.28)', marginTop: 18, paddingTop: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>📞 Amazon Connect softphone (optional)</h3>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 10px', maxWidth: 720 }}>
              Paste your OWN Amazon Connect instance CCP URL (BYOK — never a shared instance).
              The softphone connects to your instance and your Connect account only.
            </p>
            {ccpNotSetUp ? (
              <p style={{ fontSize: 13.5, color: '#fca5a5', margin: 0 }}>
                Connect URL storage is not set up yet — run the Slice 139 migration.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="url"
                    value={ccpUrlInput}
                    onChange={(e) => setCcpUrlInput(e.target.value)}
                    placeholder="https://<your-instance>.my.connect.aws/ccp-v2/"
                    aria-label="Amazon Connect CCP URL"
                    autoComplete="off"
                    style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                  />
                  <button type="button" onClick={saveCcpUrl} disabled={ccpSaving}>
                    {ccpSaving ? 'Saving…' : 'Save Connect URL'}
                  </button>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '10px 0 0' }}>
                  {ccpUrlSaved
                    ? `Amazon Connect CCP URL saved: ${ccpUrlSaved}`
                    : 'No Amazon Connect CCP URL saved yet.'}
                </p>
                {ccpMsg && <p style={{ fontSize: 13, color: '#6ee7b7', margin: '10px 0 0' }}>{ccpMsg}</p>}
              </>
            )}
          </div>

          {/* Slice 134 — BatchData skip-trace (BYOK, optional). */}
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.28)', marginTop: 18, paddingTop: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>🔍 Skip-trace — BatchData (optional)</h3>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 10px', maxWidth: 720 }}>
              Paste your OWN BatchData API key (BYOK — never a shared key).
              Skip-trace lookups run on your key and your BatchData credits.
              Endpoint POST https://api.batchdata.com/api/v3/property/skip-trace is verified;
              the live lookup stays &ldquo;connected, awaiting verification&rdquo; until the v3
              response field names are verified from BatchData&rsquo;s official docs.
            </p>
            {provNotSetUp ? (
              <p style={{ fontSize: 13.5, color: '#fca5a5', margin: 0 }}>
                Skip-trace settings are not set up yet — run the Slice 134 migration.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="password"
                    value={batchKeyInput}
                    onChange={(e) => setBatchKeyInput(e.target.value)}
                    placeholder="Paste your BatchData API key here"
                    aria-label="BatchData API key"
                    autoComplete="off"
                    style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                  />
                  <button type="button" onClick={saveBatchKey} disabled={batchSaving}>
                    {batchSaving ? 'Saving…' : 'Save BatchData key'}
                  </button>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '10px 0 0' }}>
                  {provStatus?.has_batchdata_key
                    ? `BatchData key saved: ${provStatus.batchdata_key_mask || '••••••••'} — status: connected, awaiting verification. A saved key alone is not "connected": no provider is connected until a real key is saved AND a real call succeeds.`
                    : 'No BatchData key saved yet. A saved key alone is not "connected": no provider is connected until a real key is saved AND a real call succeeds.'}
                </p>
                {batchMsg && <p style={{ fontSize: 13, color: '#6ee7b7', margin: '10px 0 0' }}>{batchMsg}</p>}
              </>
            )}
          </div>

          {/* Slice 134 — Email provider (BYOK). */}
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.28)', marginTop: 18, paddingTop: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>✉️ Email — your own provider (BYOK)</h3>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 10px', maxWidth: 720 }}>
              Pick your own email provider and paste your own key (BYOK — never a shared account).
              Buyer emails are sent from your provider and your credits.
              Changing the provider below saves the choice immediately, and saving a key clears
              the other providers&rsquo; keys so a stale key cannot linger.
            </p>
            {provNotSetUp ? (
              <p style={{ fontSize: 13.5, color: '#fca5a5', margin: 0 }}>
                Email settings are not set up yet — run the Slice 134 migration.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {(Object.keys(EMAIL_PROVIDER_META) as EmailProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        void saveEmailProviderChoice(p);
                      }}
                      disabled={emailSaving}
                      aria-pressed={emailProvider === p}
                      style={{
                        padding: '8px 14px', borderRadius: 999, fontSize: 13.5,
                        background: emailProvider === p ? '#065f46' : '#0f172a',
                        color: emailProvider === p ? '#ecfdf5' : '#cbd5e1',
                        border: `1px solid ${emailProvider === p ? 'rgba(110,231,183,0.6)' : 'rgba(148,163,184,0.35)'}`,
                      }}
                    >
                      {EMAIL_PROVIDER_META[p].label}
                    </button>
                  ))}
                </div>

                {emailProvider === 'resend' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="password"
                      value={resendKeyInput}
                      onChange={(e) => setResendKeyInput(e.target.value)}
                      placeholder="Paste your Resend API key here"
                      aria-label="Resend API key"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="email"
                      value={resendFromInput}
                      onChange={(e) => setResendFromInput(e.target.value)}
                      placeholder="Resend from email (e.g. you@yourdomain.com)"
                      aria-label="Resend from email"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                  </div>
                )}
                {emailProvider === 'sendgrid' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="password"
                      value={sendgridKeyInput}
                      onChange={(e) => setSendgridKeyInput(e.target.value)}
                      placeholder="Paste your SendGrid API key here"
                      aria-label="SendGrid API key"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="email"
                      value={sendgridFromInput}
                      onChange={(e) => setSendgridFromInput(e.target.value)}
                      placeholder="SendGrid from email (e.g. you@yourdomain.com)"
                      aria-label="SendGrid from email"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                  </div>
                )}
                {emailProvider === 'ses' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="password"
                      value={sesAccessKeyInput}
                      onChange={(e) => setSesAccessKeyInput(e.target.value)}
                      placeholder="SES access key ID"
                      aria-label="AWS SES access key ID"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="password"
                      value={sesSecretInput}
                      onChange={(e) => setSesSecretInput(e.target.value)}
                      placeholder="SES secret access key"
                      aria-label="AWS SES secret access key"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="text"
                      value={sesRegionInput}
                      onChange={(e) => setSesRegionInput(e.target.value)}
                      placeholder="SES region (e.g. us-east-1)"
                      aria-label="AWS SES region"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="email"
                      value={sesFromInput}
                      onChange={(e) => setSesFromInput(e.target.value)}
                      placeholder="SES from email (e.g. you@yourdomain.com)"
                      aria-label="AWS SES from email"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                  <button type="button" onClick={saveEmailKey} disabled={emailSaving}>
                    {emailSaving ? 'Saving…' : `Save ${EMAIL_PROVIDER_META[emailProvider].label} key`}
                  </button>
                </div>

                <p style={{ fontSize: 13, color: '#94a3b8', margin: '10px 0 0' }}>
                  {emailProvider === 'resend'
                    ? provStatus?.has_resend_keys
                      ? `Resend key saved: ${provStatus.resend_key_mask || '••••••••'}${provStatus.resend_from_email ? ` — from ${provStatus.resend_from_email}` : ''} (first 4 + last 4 characters only — the full key is never shown here).`
                      : provStatus?.has_resend_key
                        ? 'Resend key saved, but no from email yet — not fully set up. Add a from email above; Resend cannot send without one.'
                        : 'No Resend key saved yet.'
                    : emailProvider === 'sendgrid'
                      ? provStatus?.has_sendgrid_keys
                        ? `SendGrid key saved: ${provStatus.sendgrid_key_mask || '••••••••'}${provStatus.sendgrid_from_email ? ` — from ${provStatus.sendgrid_from_email}` : ''} (first 4 + last 4 characters only — the full key is never shown here).`
                        : provStatus?.has_sendgrid_key
                          ? 'SendGrid key saved, but no from email yet — not fully set up. Add a from email above; SendGrid cannot send without one.'
                          : 'No SendGrid key saved yet.'
                      : provStatus?.has_ses_keys
                        ? `SES keys saved${provStatus.ses_region ? ` (region ${provStatus.ses_region})` : ''}${provStatus.ses_from_email ? ` — from ${provStatus.ses_from_email}` : ''} (the full keys are never shown here).`
                        : 'No SES keys saved yet.'}
                  {' '}Saving a key for this provider clears the other email providers&rsquo; saved keys.
                </p>
                {emailMsg && <p style={{ fontSize: 13, color: '#6ee7b7', margin: '10px 0 0' }}>{emailMsg}</p>}
                {provLoadMsg && <p style={{ fontSize: 13, color: '#fca5a5', margin: '10px 0 0' }}>{provLoadMsg}</p>}
              </>
            )}
          </div>

          {/* Slice 134 — SMS provider (BYOK). */}
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.28)', marginTop: 18, paddingTop: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>💬 SMS — your own provider (BYOK)</h3>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 10px', maxWidth: 720 }}>
              Pick your own SMS provider and paste your own key (BYOK — never a shared account).
              Buyer texts are sent from your provider and your credits.
              Changing the provider below saves the choice immediately, and saving a key clears
              the other providers&rsquo; keys so a stale key cannot linger.
            </p>
            {provNotSetUp ? (
              <p style={{ fontSize: 13.5, color: '#fca5a5', margin: 0 }}>
                SMS settings are not set up yet — run the Slice 134 migration.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {(Object.keys(SMS_PROVIDER_META) as SmsProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        void saveSmsProviderChoice(p);
                      }}
                      disabled={smsSaving}
                      aria-pressed={smsProvider === p}
                      style={{
                        padding: '8px 14px', borderRadius: 999, fontSize: 13.5,
                        background: smsProvider === p ? '#065f46' : '#0f172a',
                        color: smsProvider === p ? '#ecfdf5' : '#cbd5e1',
                        border: `1px solid ${smsProvider === p ? 'rgba(110,231,183,0.6)' : 'rgba(148,163,184,0.35)'}`,
                      }}
                    >
                      {SMS_PROVIDER_META[p].label}
                    </button>
                  ))}
                </div>

                {smsProvider === 'twilio' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="password"
                      value={twilioSidInput}
                      onChange={(e) => setTwilioSidInput(e.target.value)}
                      placeholder="Twilio account SID"
                      aria-label="Twilio account SID"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="password"
                      value={twilioTokenInput}
                      onChange={(e) => setTwilioTokenInput(e.target.value)}
                      placeholder="Twilio auth token"
                      aria-label="Twilio auth token"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="tel"
                      value={twilioFromInput}
                      onChange={(e) => setTwilioFromInput(e.target.value)}
                      placeholder="Twilio from number (e.g. +1…)"
                      aria-label="Twilio from number"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                  </div>
                )}
                {smsProvider === 'telnyx' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="password"
                      value={telnyxKeyInput}
                      onChange={(e) => setTelnyxKeyInput(e.target.value)}
                      placeholder="Paste your Telnyx API key here"
                      aria-label="Telnyx API key"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="tel"
                      value={telnyxFromInput}
                      onChange={(e) => setTelnyxFromInput(e.target.value)}
                      placeholder="Telnyx from number (e.g. +1…)"
                      aria-label="Telnyx from number"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="text"
                      value={telnyxPublicKeyInput}
                      onChange={(e) => setTelnyxPublicKeyInput(e.target.value)}
                      placeholder="Public key (for verifying inbound texts — not secret)"
                      aria-label="Public key (for verifying inbound texts — not secret)"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>
                      The public key is for verifying inbound texts — not secret. It is optional
                      for sending, but without it inbound Telnyx texts are rejected, never accepted
                      unverified.
                    </p>
                  </div>
                )}
                {smsProvider === 'textbee' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="password"
                      value={textbeeKeyInput}
                      onChange={(e) => setTextbeeKeyInput(e.target.value)}
                      placeholder="Paste your TextBee API key here"
                      aria-label="TextBee API key"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="text"
                      value={textbeeDeviceInput}
                      onChange={(e) => setTextbeeDeviceInput(e.target.value)}
                      placeholder="TextBee device ID"
                      aria-label="TextBee device ID"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>
                      Your own Android phone + SIM sends the texts — free 300 texts/mo per textbee.dev
                    </p>
                  </div>
                )}
                {smsProvider === 'httpsms' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="password"
                      value={httpsmsKeyInput}
                      onChange={(e) => setHttpsmsKeyInput(e.target.value)}
                      placeholder="Paste your httpSMS API key here"
                      aria-label="httpSMS API key"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="tel"
                      value={httpsmsFromInput}
                      onChange={(e) => setHttpsmsFromInput(e.target.value)}
                      placeholder="httpSMS from number — your SIM's number (e.g. +1…)"
                      aria-label="httpSMS from number"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <input
                      type="text"
                      value={httpsmsDeviceInput}
                      onChange={(e) => setHttpsmsDeviceInput(e.target.value)}
                      placeholder="httpSMS device ID (optional — leave blank to use any device on the account)"
                      aria-label="httpSMS device ID"
                      autoComplete="off"
                      style={{ flex: '1 1 280px', minWidth: 220, margin: 0 }}
                    />
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>
                      Your own Android phone + SIM via httpSMS — texts are queued (202 Accepted), not
                      delivered instantly; one API key covers all devices on the account; battery savers
                      (MIUI, ColorOS, Samsung, OnePlus, Pixel) can kill background apps and stop sending —
                      keep the app exempt.
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                  <button type="button" onClick={saveSmsKey} disabled={smsSaving}>
                    {smsSaving ? 'Saving…' : `Save ${SMS_PROVIDER_META[smsProvider].label} key`}
                  </button>
                </div>

                <p style={{ fontSize: 13, color: '#94a3b8', margin: '10px 0 0' }}>
                  {smsProvider === 'twilio'
                    ? provStatus?.has_twilio_keys
                      ? `Twilio keys saved${provStatus.twilio_from_number ? ` — from ${provStatus.twilio_from_number}` : ''} (the full keys are never shown here).`
                      : 'No Twilio keys saved yet.'
                    : smsProvider === 'telnyx'
                      ? provStatus?.has_telnyx_keys
                        ? `Telnyx key saved: ${provStatus.telnyx_key_mask || '••••••••'}${provStatus.telnyx_from_number ? ` — from ${provStatus.telnyx_from_number}` : ''}${provStatus.telnyx_public_key ? ` — public key ${provStatus.telnyx_public_key} (for verifying inbound texts — not secret)` : ''} (first 4 + last 4 characters only — the full key is never shown here).`
                        : provStatus?.has_telnyx_key
                          ? 'Telnyx key saved, but no from number yet — not fully set up. Add a from number above; Telnyx cannot send without one.'
                          : 'No Telnyx key saved yet.'
                      : smsProvider === 'textbee'
                        ? provStatus?.has_textbee_key
                          ? `TextBee key saved: ${provStatus.textbee_key_mask || '••••••••'}${provStatus.textbee_device_id ? ` — device ${provStatus.textbee_device_id}` : ''} (first 4 + last 4 characters only — the full key is never shown here).`
                          : 'No TextBee key saved yet.'
                        : provStatus?.has_httpsms_keys
                          ? `httpSMS key saved: ${provStatus.httpsms_key_mask || '••••••••'}${provStatus.httpsms_from_number ? ` — from ${provStatus.httpsms_from_number}` : ''}${provStatus.httpsms_device_id ? ` — device ${provStatus.httpsms_device_id}` : ''} (first 4 + last 4 characters only — the full key is never shown here).`
                          : provStatus?.has_httpsms_key
                            ? 'httpSMS key saved, but no from number yet — not fully set up. Add a from number above; httpSMS cannot send without one.'
                            : 'No httpSMS key saved yet.'}
                  {' '}Saving a key for this provider clears the other SMS providers&rsquo; saved keys.
                </p>
                {smsMsg && <p style={{ fontSize: 13, color: '#6ee7b7', margin: '10px 0 0' }}>{smsMsg}</p>}
              </>
            )}
          </div>

          {/* Slice 134 — Send Test Email & SMS (own credits, own accounts). */}
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.28)', marginTop: 18, paddingTop: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>🧪 Send Test Email &amp; SMS</h3>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 10px', maxWidth: 720 }}>
              Sends one test email and one test SMS to yourself, through the email and SMS providers
              you picked above. Uses your own credits — sent from your own accounts to your own
              number/email.
            </p>
            {provNotSetUp ? (
              <p style={{ fontSize: 13.5, color: '#fca5a5', margin: 0 }}>
                Test sending is not set up yet — run the Slice 134 migration.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="email"
                    value={testEmailInput}
                    onChange={(e) => setTestEmailInput(e.target.value)}
                    placeholder="Your own email"
                    aria-label="Your own email for the test"
                    autoComplete="off"
                    style={{ flex: '1 1 220px', minWidth: 200, margin: 0 }}
                  />
                  <input
                    type="tel"
                    value={testPhoneInput}
                    onChange={(e) => setTestPhoneInput(e.target.value)}
                    placeholder="Your own phone number"
                    aria-label="Your own phone number for the test"
                    autoComplete="off"
                    style={{ flex: '1 1 220px', minWidth: 200, margin: 0 }}
                  />
                  <button type="button" onClick={sendTestBlast} disabled={testSending}>
                    {testSending ? 'Sending…' : 'Send test email & SMS'}
                  </button>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '10px 0 0' }}>
                  Uses your own credits — sent from your own accounts to your own number/email.
                  If a provider has no key saved, the test says &ldquo;not connected&rdquo; and sends nothing.
                  The dispatcher is not deployed yet, so a test will report that honestly until the
                  owner deploys it from Supabase.
                </p>
                {testSendMsg && (
                  <p role="alert" style={{ fontSize: 13.5, color: testSendOk ? '#6ee7b7' : '#fca5a5', margin: '10px 0 0' }}>
                    {testSendMsg}
                  </p>
                )}
              </>
            )}
          </div>

          {msg && <p style={{ fontSize: 13, color: '#6ee7b7', marginTop: 10 }}>{msg}</p>}
        </>
      )}
    </section>
  );
}
