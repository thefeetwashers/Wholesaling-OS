// Slice 129 — Google Skip-Trace Results Modal (shared).
//
// One modal for both save targets: a probate decision-maker
// (saves into probate_leads via lib/probate-leads-api.ts) and a
// distressed/inbound lead (saves owner_phone/owner_email onto
// public.leads). The caller owns the save — this modal only searches
// and returns the chosen phone/email through onSave.
//
// Method 2 (in-app): calls the google-skip-trace Edge Function on
// open. It is file-only, NOT deployed, and has no keys — until a
// provider is connected it answers 'not_configured' and the modal
// shows that honestly, with the Method 1 link and manual inputs
// still usable. Method 1 (works now, no keys): the "Open in Google
// Search" link (lib/google-skip-trace.ts) opens the targeted query
// in a new tab. No scraping, no API call from the browser.
//
// Saving a found number is NOT a contact: the modal never writes a
// probate_lead_activity row and never marks the lead Contacted.
// The outreach_status advance (New → Skip Traced) happens in
// updateDecisionMakerContact, only when the lead is still 'New'.

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { googleLookupUrl } from '../lib/google-skip-trace';

export interface GoogleSkipTraceTarget {
  kind: 'probate' | 'lead';
  leadId: string;
  decisionMakerIndex?: number;
}

interface SearchSource {
  title: string;
  link: string;
  snippet: string;
}

export default function GoogleSkipTraceModal({
  target,
  ownerName,
  propertyAddress,
  cityState,
  currentPhone,
  currentEmail,
  onSave,
  onClose,
  onSaved,
}: {
  target: GoogleSkipTraceTarget;
  ownerName: string;
  propertyAddress: string;
  cityState: string;
  currentPhone?: string | null;
  currentEmail?: string | null;
  onSave: (phone: string | null, email: string | null) => Promise<void>;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [isSearching, setIsSearching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [foundPhones, setFoundPhones] = useState<string[]>([]);
  const [foundEmails, setFoundEmails] = useState<string[]>([]);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [selectedPhone, setSelectedPhone] = useState(currentPhone || '');
  const [selectedEmail, setSelectedEmail] = useState(currentEmail || '');
  const [saveMessage, setSaveMessage] = useState('');

  const locationQuery = (propertyAddress || '').trim() || (cityState || '').trim();
  const externalGoogleUrl = googleLookupUrl(ownerName, locationQuery);

  useEffect(() => {
    let live = true;
    async function runGoogleLookup() {
      setIsSearching(true);
      setErrorMessage(null);
      try {
        if (!supabase) throw new Error('Supabase is not configured on this deployment.');
        const { data, error } = await supabase.functions.invoke('google-skip-trace', {
          body: {
            kind: target.kind,
            leadId: target.leadId,
            decisionMakerIndex: target.decisionMakerIndex,
            ownerName,
            propertyAddress: propertyAddress || '',
            cityState: cityState || '',
          },
        });
        if (!live) return;
        if (error) throw new Error(error.message || 'The Google lookup service could not be reached.');
        if (!data?.success) {
          // not_configured / unverified: the function says so
          // honestly, and the manual inputs + Google link below
          // still work. Nothing was written.
          throw new Error(
            (data as { error?: string } | null)?.error ||
              'Google lookup is not available — use the Open in Google Search link below.',
          );
        }
        const phones: string[] = Array.isArray(data.phones) ? data.phones : [];
        const emails: string[] = Array.isArray(data.emails) ? data.emails : [];
        setFoundPhones(phones);
        setFoundEmails(emails);
        setSources(Array.isArray(data.sources) ? data.sources : []);
        // Pre-select the FIRST detected phone/email only — never
        // the whole array (the pasted modal set the full array as
        // the value, which is a bug).
        if (!currentPhone && phones.length > 0) setSelectedPhone(phones[0]);
        if (!currentEmail && emails.length > 0) setSelectedEmail(emails[0]);
      } catch (err) {
        if (!live) return;
        const msg = err instanceof Error ? err.message : 'Google lookup encountered an error.';
        // A missing deployment is the expected state until the
        // owner deploys the function — say so plainly instead of
        // dressing it up as a search failure.
        setErrorMessage(
          /not found|Failed to send|fetch|404/i.test(msg)
            ? 'The Google lookup service is not deployed yet — use the Open in Google Search link below and enter the phone or email you find.'
            : msg,
        );
      } finally {
        if (live) setIsSearching(false);
      }
    }
    runGoogleLookup();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveContact() {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await onSave(selectedPhone.trim() || null, selectedEmail.trim() || null);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Could not save the contact details.');
    } finally {
      setIsSaving(false);
    }
  }

  const chip = (value: string, active: boolean, onClick: () => void, activeBg: string) => (
    <button
      key={value}
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${active ? activeBg : '#cbd5e1'}`,
        background: active ? activeBg : '#fff',
        color: active ? '#fff' : '#0f172a',
        cursor: 'pointer',
      }}
    >
      {active ? `✓ ${value}` : value}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', color: '#0f172a', borderRadius: 12, maxWidth: 640, width: '100%', margin: 'auto' }}>
        <div style={{ background: '#0f172a', color: '#fff', padding: '14px 20px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>🔎 Google Skip-Trace Lookup</div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
              Searching: <strong>{ownerName}</strong>
              {locationQuery ? ` • ${locationQuery}` : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 20, cursor: 'pointer', padding: 0 }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#1e3a8a', marginBottom: 16 }}>
            <span>Want to inspect additional public pages directly on Google?</span>
            <a href={externalGoogleUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: '#1d4ed8' }}>
              Open in Google Search ↗
            </a>
          </div>

          {isSearching ? (
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
              Scanning public search records for phone numbers &amp; emails…
            </p>
          ) : (
            <>
              {errorMessage && (
                <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>
                  <strong>API notice:</strong> {errorMessage}
                  <div style={{ marginTop: 4 }}>
                    You can still use the <strong>Open in Google Search</strong> link above and paste the phone or email below.
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', marginBottom: 8 }}>
                    📞 Detected phone numbers ({foundPhones.length})
                  </div>
                  {foundPhones.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {foundPhones.map((p) => chip(p, selectedPhone === p, () => setSelectedPhone(p), '#059669'))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No phone numbers extracted in top snippets.</div>
                  )}
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginTop: 10 }}>
                    Phone to save on lead:
                    <input
                      type="tel"
                      value={selectedPhone}
                      onChange={(e) => setSelectedPhone(e.target.value)}
                      placeholder="Phone number"
                      style={{ display: 'block', width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }}
                    />
                  </label>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', marginBottom: 8 }}>
                    ✉️ Detected email addresses ({foundEmails.length})
                  </div>
                  {foundEmails.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {foundEmails.map((e) => chip(e, selectedEmail === e, () => setSelectedEmail(e), '#7c3aed'))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No email addresses extracted in top snippets.</div>
                  )}
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginTop: 10 }}>
                    Email to save on lead:
                    <input
                      type="email"
                      value={selectedEmail}
                      onChange={(e) => setSelectedEmail(e.target.value)}
                      placeholder="Email address"
                      style={{ display: 'block', width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }}
                    />
                  </label>
                </div>
              </div>

              {sources.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    Top public verification sources (verify the address match)
                  </div>
                  {sources.map((src, i) => (
                    <div key={`${src.link}-${i}`} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                      <a href={src.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>
                        {src.title || src.link}
                      </a>
                      {src.snippet && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{src.snippet}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {saveMessage && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginTop: 16 }}>
              {saveMessage}
            </div>
          )}

          <p style={{ fontSize: 12, color: '#64748b', marginTop: 16 }}>
            Only save a phone or email you actually verified against the source — a wrong number on a lead
            is worse than none. Saving here is not a contact: it does not mark the lead Contacted and
            writes no contact-history row.
          </p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveContact}
              disabled={isSaving}
              style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1 }}
            >
              {isSaving ? 'Saving…' : 'Save Phone & Email to Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
