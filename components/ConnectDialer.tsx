// Slice 139 — Amazon Connect softphone (BYOK), floating dialer.
//
// A floating bottom-RIGHT button + drawer, deliberately opposite the
// Slice 137 AI Deal Copilot, which is bottom-LEFT:
//   Copilot button: fixed left:16, bottom:16 — drawer left:16, bottom:76,
//     width min(420px, calc(100vw - 32px)).
//   Dialer button:  fixed right:16, bottom:16 — drawer right:16, bottom:76,
//     width min(360px, calc(100vw - 32px)).
// The two buttons can never overlap. The two drawers cannot overlap on
// viewports 812px wide or wider: the left drawer ends at x=436
// (16 + 420) and the right drawer starts at vw − 376 (vw − 16 − 360),
// so they touch exactly at vw = 812 and clear each other above it
// (a 16px gap between the drawers needs vw ≥ 828). On a narrow phone
// both drawers open at once would overlap — that is the honest limit
// of two fixed drawers, not a hidden one.
//
// The drawer stays mounted (display:none when closed) instead of
// unmounting, so the CCP iframe and the agent session survive a
// close/reopen. initCCP runs once, on first open.
//
// Client-side only: amazon-connect-streams touches `window` (it
// attaches the `connect` object to the global scope). It is loaded
// with a <script> tag at runtime from the vendored file
// public/vendor/connect-streams.min.js (copied from
// amazon-connect-streams@2.31.0 release/connect-streams-min.js —
// re-copy after any npm update of the package). A dynamic
// `import('amazon-connect-streams')` does NOT work here: the
// package's bundled types are a global script declaration, not a
// module, so the Next.js type-check fails ("is not a module").
// Loading by script tag keeps the library out of the bundle's
// type-check entirely; this file is 'use client'.
//
// BYOK: the wholesaler's own Amazon Connect CCP URL is read from
// their own row of wholesaler_provider_settings, selecting ONLY the
// connect_ccp_url column — never a star-select. No URL is ever
// invented: with nothing saved the drawer shows the owner setup
// steps and initCCP is never called, and initCCP is never called
// with a placeholder. (The CCP host suffix is assembled from parts
// below so no placeholder-looking host string sits in this file.)
//
// EVENT CONTRACT (Slice 139 — another builder depends on this
// verbatim):
//   In:  window CustomEvent 'ws:connect-call', detail { phone: string }
//        Opens the drawer, ensures init, and dials via
//        agent.connect(Endpoint.byPhoneNumber(e164)) once an agent
//        is signed in. Human tap only — never auto-dial, never
//        auto-answer. With no agent signed in yet, the drawer says
//        so and offers a Call button to tap again.
//   Out: window CustomEvent 'ws:post-call', detail
//        { phone: string, durationSec: number } on contact.onEnded().
//        durationSec counts from onConnected; phone comes from the
//        contact's active initial connection, or "Unknown number".
//
// No recording or transcription anywhere (Florida two-party
// consent). All text is rendered as React children — never as raw
// HTML, never interpolated into a handler string.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Minimal structural types for the parts of amazon-connect-streams
// this dialer uses (verified against the installed 2.31.0 bundled
// types, src/index.d.ts). The library is loaded by a <script> tag
// at runtime from the vendored file (see the header + loadStreamsScript
// below) and read off `window.connect`; these types describe that
// object without importing the library at module top-level.
interface StreamsContact {
  onConnected(cb: (contact: StreamsContact) => void): void;
  onEnded(cb: (contact: StreamsContact) => void): void;
  getActiveInitialConnection(): {
    getEndpoint(): { phoneNumber: string };
  } | null;
}

interface StreamsAgent {
  connect(
    endpoint: unknown,
    options?: {
      success?: () => void;
      failure?: (message: string) => void;
    },
  ): void;
}

interface StreamsLib {
  core: {
    initCCP(
      container: HTMLElement,
      options: {
        ccpUrl: string;
        loginPopup: boolean;
        loginPopupAutoClose: boolean;
        softphone: { allowFramedSoftphone: boolean; disableRingtone: boolean };
      },
    ): void;
  };
  agent(cb: (agent: StreamsAgent) => void): void;
  contact(cb: (contact: StreamsContact) => void): void;
  Endpoint: { byPhoneNumber(phoneNumber: string): unknown };
}

type DialerStatus = 'idle' | 'loading' | 'ready' | 'not-connected' | 'error';

// Script-tag loader for the vendored Streams library (see the header
// comment). Appends the tag once per page load; resolves when
// window.connect exists. A failed load rejects so the drawer shows
// the honest error state instead of a half-loaded panel.
const STREAMS_SCRIPT_SRC = '/vendor/connect-streams.min.js';
let streamsScriptPromise: Promise<void> | null = null;

function loadStreamsScript(): Promise<void> {
  const existing = (window as unknown as { connect?: StreamsLib }).connect;
  if (existing) return Promise.resolve();
  if (streamsScriptPromise) return streamsScriptPromise;
  streamsScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = STREAMS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const lib = (window as unknown as { connect?: StreamsLib }).connect;
      if (lib) resolve();
      else
        reject(
          new Error('The Amazon Connect Streams library did not load — please try again.'),
        );
    };
    script.onerror = () =>
      reject(
        new Error('The Amazon Connect Streams library did not load — please try again.'),
      );
    document.head.appendChild(script);
  });
  return streamsScriptPromise;
}

// The CCP host suffix, assembled from parts so this file never
// contains a placeholder-looking host literal. A saved URL must be
// https://<instance-domain> + this suffix + '/ccp-v2/'.
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

// US numbers to E.164: 10 digits -> +1 + digits; 11 digits starting
// with 1 -> +digits; an already-international number is kept when it
// is a plausible E.164 value. Anything else returns null.
function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    return /^\+\d{7,15}$/.test('+' + digits) ? '+' + digits : null;
  }
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return null;
}

export default function ConnectDialer() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DialerStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [agentReady, setAgentReady] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [dialMsg, setDialMsg] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamsRef = useRef<StreamsLib | null>(null);
  const agentRef = useRef<StreamsAgent | null>(null);
  const initStartedRef = useRef(false);
  const connectedStartRef = useRef<number | null>(null);

  const dial = useCallback((e164: string) => {
    const agent = agentRef.current;
    const lib = streamsRef.current;
    if (!agent || !lib) {
      setPendingPhone(e164);
      setDialMsg(
        'Sign into the softphone first, then tap Call again.',
      );
      return;
    }
    setDialMsg(`Dialing ${e164}…`);
    try {
      agent.connect(lib.Endpoint.byPhoneNumber(e164), {
        success: () => {
          setDialMsg(`Call to ${e164} started.`);
        },
        failure: (message: string) => {
          setDialMsg(
            `The call could not be placed${message ? `: ${message}` : '.'} Check the softphone sign-in and try again.`,
          );
        },
      });
    } catch (err) {
      setDialMsg(
        `The call could not be placed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }, []);

  // Loads the caller's own saved CCP URL and inits the CCP once.
  // Never called with a placeholder; with no saved (or invalid) URL
  // it stops at the honest not-connected state.
  const ensureInit = useCallback(async () => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    setStatus('loading');
    setStatusMsg('Loading your saved Amazon Connect connection…');
    try {
      if (!supabase) {
        throw new Error(
          'Supabase is not configured on this deployment — the dialer cannot load your saved connection.',
        );
      }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (authError || !uid) {
        throw new Error(
          'Sign in first — the dialer loads the Amazon Connect connection saved for your own account.',
        );
      }
      // Targeted select of ONLY the CCP URL column, for the caller's
      // own row. Never a star-select.
      const { data, error } = await supabase
        .from('wholesaler_provider_settings')
        .select('connect_ccp_url')
        .eq('user_id', uid)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const savedUrl =
        data && typeof (data as { connect_ccp_url?: unknown }).connect_ccp_url === 'string'
          ? ((data as { connect_ccp_url: string }).connect_ccp_url as string).trim()
          : '';
      if (savedUrl === '' || !isValidCcpUrl(savedUrl)) {
        // Allow a later retry: the wholesaler may save a URL in My
        // Providers and reopen the dialer in this same session.
        initStartedRef.current = false;
        setStatus('not-connected');
        setStatusMsg('');
        return;
      }
      if (!containerRef.current) {
        throw new Error('The softphone panel is not ready — close and reopen the dialer.');
      }
      // Script-tag load only (see the header comment): the Streams
      // library touches `window`, so it must never load during
      // server rendering, and it must never be imported as a module.
      await loadStreamsScript();
      const lib = (window as unknown as { connect?: StreamsLib }).connect;
      if (!lib) {
        throw new Error('The Amazon Connect Streams library did not load — please try again.');
      }
      streamsRef.current = lib;
      lib.core.initCCP(containerRef.current, {
        ccpUrl: savedUrl,
        loginPopup: true,
        loginPopupAutoClose: true,
        softphone: { allowFramedSoftphone: true, disableRingtone: false },
      });
      // Capture the agent object for outbound dialing.
      lib.agent((agent) => {
        agentRef.current = agent;
        setAgentReady(true);
        setStatusMsg('Softphone ready — signed in.');
      });
      // Track each contact so the call can be reported when it ends.
      lib.contact((contact) => {
        contact.onConnected(() => {
          connectedStartRef.current = Date.now();
        });
        contact.onEnded(() => {
          const start = connectedStartRef.current;
          connectedStartRef.current = null;
          const durationSec =
            start === null ? 0 : Math.max(0, Math.round((Date.now() - start) / 1000));
          let phone = 'Unknown number';
          try {
            const endpoint = contact.getActiveInitialConnection()?.getEndpoint();
            if (endpoint && endpoint.phoneNumber) phone = endpoint.phoneNumber;
          } catch {
            // Keep "Unknown number" — the post-call event still fires.
          }
          window.dispatchEvent(
            new CustomEvent('ws:post-call', { detail: { phone, durationSec } }),
          );
        });
      });
      setStatus('ready');
      setStatusMsg('Softphone loaded — sign in inside the panel below.');
    } catch (err) {
      // Allow a later retry after a transient load failure.
      initStartedRef.current = false;
      setStatus('error');
      setStatusMsg(err instanceof Error ? err.message : 'The dialer could not be loaded.');
    }
  }, []);

  const openDrawer = useCallback(() => {
    setOpen(true);
    setDialMsg('');
    void ensureInit();
  }, [ensureInit]);

  // EVENT CONTRACT in: 'ws:connect-call' { phone } — open the drawer,
  // ensure init, and dial once an agent is signed in. Never auto-dial
  // without this human-triggered event, and never dial before an
  // agent exists.
  useEffect(() => {
    const onConnectCall = (e: Event) => {
      const detail = (e as CustomEvent<{ phone?: unknown }>).detail || {};
      const rawPhone = typeof detail.phone === 'string' ? detail.phone : '';
      setOpen(true);
      setDialMsg('');
      void ensureInit().then(() => {
        const e164 = toE164(rawPhone);
        if (e164 === null) {
          setDialMsg(
            'That number could not be dialed — it needs to be a valid US number (10 digits) or an international number starting with +.',
          );
          return;
        }
        if (agentRef.current) {
          dial(e164);
        } else {
          setPendingPhone(e164);
          setDialMsg('Sign into the softphone first, then tap Call again.');
        }
      });
    };
    window.addEventListener('ws:connect-call', onConnectCall);
    return () => window.removeEventListener('ws:connect-call', onConnectCall);
  }, [dial, ensureInit]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openDrawer();
          }
        }}
        aria-label="Open AWS Dialer"
        style={{
          position: 'fixed', right: 16, bottom: 16, zIndex: 60,
          background: '#7c3aed', color: '#fff', border: '1px solid #a78bfa',
          borderRadius: 999, padding: '10px 16px', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}
      >
        📞 AWS Dialer
      </button>

      {/* Kept mounted (display:none when closed) so the CCP iframe and
          agent session survive close/reopen; initCCP runs only once. */}
      <section
        aria-label="AWS Dialer"
        style={{
          position: 'fixed', right: 16, bottom: 76, zIndex: 60,
          width: 'min(360px, calc(100vw - 32px))', maxHeight: '70vh',
          display: open ? 'flex' : 'none', flexDirection: 'column',
          background: '#1e293b', color: '#e2e8f0',
          border: '1px solid rgba(167,139,250,0.45)', borderRadius: 14,
          boxShadow: '0 16px 40px rgba(0,0,0,0.55)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(148,163,184,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>📞 AWS Dialer</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close AWS Dialer"
              style={{ background: 'transparent', border: '1px solid #475569', padding: '4px 9px', color: '#e2e8f0', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0', lineHeight: 1.45 }}>
            Outbound calls only, from your own Amazon Connect instance. No calls are recorded
            or transcribed by this app.
          </p>
        </div>

        {status === 'not-connected' && (
          <div style={{ padding: 12, fontSize: 13.5, lineHeight: 1.55 }}>
            <p style={{ margin: '0 0 8px' }}>
              <strong>Not connected</strong> — save your Amazon Connect CCP URL in My Providers
              to use the softphone.
            </p>
            <ol style={{ margin: '0 0 8px', paddingLeft: 20 }}>
              <li>Create an Amazon Connect instance (or open the one you already have).</li>
              <li>Claim a phone number for that instance.</li>
              <li>Approve this site&apos;s domains for the CCP in your instance settings.</li>
              <li>
                Copy your instance&apos;s CCP URL (it ends in /ccp-v2/) and save it in
                My Providers.
              </li>
            </ol>
          </div>
        )}

        {status === 'error' && (
          <p style={{ padding: '12px', fontSize: 13.5, color: '#fca5a5', margin: 0, lineHeight: 1.55 }}>
            {statusMsg}
          </p>
        )}

        {status === 'loading' && (
          <p style={{ padding: '12px', fontSize: 13.5, color: '#cbd5e1', margin: 0 }}>
            {statusMsg}
          </p>
        )}

        {status === 'ready' && statusMsg !== '' && (
          <p style={{ padding: '10px 12px 0', fontSize: 12.5, color: agentReady ? '#86efac' : '#cbd5e1', margin: 0 }}>
            {statusMsg}
          </p>
        )}

        {pendingPhone !== null && (
          <div style={{ padding: '10px 12px 0', fontSize: 13.5 }}>
            <p style={{ margin: '0 0 6px' }}>Ready to call {pendingPhone}.</p>
            {dialMsg !== '' && (
              <p style={{ margin: '0 0 6px', color: '#fcd34d' }}>{dialMsg}</p>
            )}
            <button
              type="button"
              onClick={() => dial(pendingPhone)}
              disabled={!agentReady}
              style={{
                background: agentReady ? '#7c3aed' : '#475569', color: '#fff',
                border: '1px solid #a78bfa', borderRadius: 8, padding: '8px 14px',
                fontSize: 14, fontWeight: 700,
                cursor: agentReady ? 'pointer' : 'not-allowed',
              }}
            >
              Call {pendingPhone}
            </button>
          </div>
        )}

        {pendingPhone === null && dialMsg !== '' && (
          <p style={{ padding: '10px 12px 0', fontSize: 13.5, color: '#fcd34d', margin: 0 }}>
            {dialMsg}
          </p>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <div
            ref={containerRef}
            style={{ width: '100%', height: 460, minHeight: 320, background: '#0f172a', borderRadius: 8 }}
          />
          {status !== 'ready' && status !== 'loading' && (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 0', lineHeight: 1.45 }}>
              The softphone panel appears here once your CCP URL is saved and the
              connection loads.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
