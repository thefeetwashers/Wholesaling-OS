// Slice 127 — Probate Leads: Probate Lead Importer & Priority Database.
//
// Written fresh from the Slice 127 spec (NOT pasted from any founder
// paste — the pasted ProbatePriorityLeads.tsx files were truncated,
// carried hardcoded seed data, faked skip-trace results, built a
// broken thefeetwashers.com storefront link, invented a "Likely
// surviving spouse" flag, dropped CLOSED cases, and crashed on
// split(",")?.trim()). This component:
//
//   * reads from the probate_leads table for the signed-in user
//     (honest empty state when nothing is imported — no seeds);
//   * imports docket CSVs through lib/probate-import.ts (CLOSED
//     cases import as archived; the default view shows OPEN only);
//   * merges on re-import so saved skip-traced contacts survive;
//   * calls the real skip-trace Edge Function, and falls back to
//     honest manual entry when no provider is connected — it never
//     writes fake contact data;
//   * builds storefront links as
//     https://wholesalingos.thefeetwashers.com/sell/<own slug>?case=<case>
//     from the signed-in wholesaler's own public_slug.
//
// No fake leads, people, phones, emails, or outcomes anywhere.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  parseProbateCsv,
  importProbateLeads,
  lastNameOf,
  appraiserUrlForCounty,
  PROBATE_OUTREACH_STATUSES,
  type DecisionMaker,
  type ProbateLead,
  type ProbateOutreachStatus,
  type ProbateParsedLead,
} from '../lib/probate-import';
import {
  fetchProbateLeads,
  fetchProbateLastContacts,
  updateProbatePropertyAddress,
  updateProbateUserNotes,
  updateProbateOutreachStatus,
  updateDecisionMakerContact,
  type ProbateLeadRow,
  type ProbateLastContact,
} from '../lib/probate-leads-api';
import { readSpreadsheetRows, rowsToCsv, isSpreadsheetFile } from '../lib/spreadsheet';
import { loadMyStorefront, type StorefrontProfile } from '../lib/storefront';
import ProbateOutreachModal from './ProbateOutreachModal';
import ProbateDirectMailPrintModal from './ProbateDirectMailPrintModal';
import CountyPresetBar from './CountyPresetBar';
import { DEFAULT_FLORIDA_COUNTY_PRESET, type FloridaCountyPreset } from '../lib/floridaCountyPresets';
import GoogleSkipTraceModal from './GoogleSkipTraceModal';
import { formatPersonName } from '../lib/probate-import';
import type { ContractPrefill } from './WholesaleContractGenerator';

export type { ProbateLead, ProbateLeadRow, DecisionMaker, ProbateOutreachStatus };

const STOREFRONT_BASE = 'https://wholesalingos.thefeetwashers.com';

function storefrontLink(slug: string, caseNumber: string): string {
  return `${STOREFRONT_BASE}/sell/${slug}?case=${encodeURIComponent(caseNumber)}`;
}

// Slice 139 — Amazon Connect click-to-call (BYOK). The button below
// only DISPATCHES the 'ws:connect-call' event with the real number;
// the softphone (components/ConnectDialer.tsx) listens for it and
// dials. Human tap only — nothing here auto-dials, and the button
// renders only where a real phone number is actually shown.
function dispatchConnectCall(phone: string) {
  window.dispatchEvent(new CustomEvent('ws:connect-call', { detail: { phone } }));
}

type TabKey = 'proSe' | 'creditor' | 'all' | 'archived';

interface SkipTraceTarget {
  leadId: string;
  dmIndex: number;
}

interface ModalTarget {
  lead: ProbateLeadRow;
  dmIndex: number;
}

// Debounced inline text field (property address, user notes). Saves
// 600ms after the user stops typing; shows a small saved/failed note.
function DebouncedField(props: {
  initial: string;
  placeholder: string;
  label: string;
  onSave: (value: string) => Promise<void>;
  onError: (message: string) => void;
  multiline?: boolean;
}) {
  const [value, setValue] = useState(props.initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setState('saving');
    timer.current = setTimeout(async () => {
      try {
        await props.onSave(value);
        setState('saved');
      } catch (e) {
        setState('failed');
        props.onError(e instanceof Error ? e.message : 'Could not save.');
      }
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const shared = {
    value,
    placeholder: props.placeholder,
    onChange: (e: { target: { value: string } }) => {
      setValue(e.target.value);
      setState('saving');
    },
    style: {
      width: '100%',
      fontSize: 13,
      padding: '6px 8px',
      border: '1px solid #cbd5e1',
      borderRadius: 6,
      boxSizing: 'border-box' as const,
    },
    'aria-label': props.label,
  };
  return (
    <div>
      {props.multiline ? (
        <textarea {...shared} rows={2} />
      ) : (
        <input {...shared} type="text" />
      )}
      <div style={{ fontSize: 11, color: state === 'failed' ? '#fca5a5' : '#cbd5e1', marginTop: 2 }}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved.' : state === 'failed' ? 'Save failed — try again.' : ''}
      </div>
    </div>
  );
}

export default function ProbateLeads({ userId, onDraftContract }: { userId: string; onDraftContract?: (prefill: ContractPrefill) => void }) {
  const [leads, setLeads] = useState<ProbateLeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<TabKey>('proSe');
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [banner, setBanner] = useState('');
  const [profile, setProfile] = useState<StorefrontProfile | null>(null);
  // Gap fix (Nov 16): the ?case= flow links a seller submission in
  // leads to a probate case — from the probate side the row now
  // shows whether that petitioner already submitted (read-only
  // lookup, no new table). lastContact is the append-only history
  // (probate_lead_activity): date + channel of the last real
  // contact, nothing invented.
  const [linkedByCase, setLinkedByCase] = useState<Record<string, { seller_status: string | null; property_address: string }>>({});
  const [linkedLoaded, setLinkedLoaded] = useState(false);
  const [lastContactByLead, setLastContactByLead] = useState<Record<string, ProbateLastContact>>({});
  const [skipTraceTarget, setSkipTraceTarget] = useState<SkipTraceTarget | null>(null);
  const [skipTraceNote, setSkipTraceNote] = useState('');
  const [skipTraceBusy, setSkipTraceBusy] = useState(false);
  const [manual, setManual] = useState<{
    leadId: string;
    dmIndex: number;
    phone: string;
    email: string;
    mailingAddress: string;
    found: boolean;
  } | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [outreachTarget, setOutreachTarget] = useState<ModalTarget | null>(null);
  const [printTarget, setPrintTarget] = useState<ModalTarget | null>(null);
  const [copied, setCopied] = useState('');
  // Slice 129 — the active county preset (default St. Lucie) sets
  // the county for new imports, the appraiser link for rows, and
  // the default city/state for the Google lookup modal.
  const [selectedCounty, setSelectedCounty] = useState<FloridaCountyPreset>(DEFAULT_FLORIDA_COUNTY_PRESET);
  const [googleTarget, setGoogleTarget] = useState<{ lead: ProbateLeadRow; dmIndex: number } | null>(null);

  async function loadLinked() {
    if (!supabase) {
      setLinkedByCase({});
      setLinkedLoaded(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('probate_case_number, seller_status, property_address')
        .eq('user_id', userId)
        .not('probate_case_number', 'is', null);
      if (error) throw error;
      const map: Record<string, { seller_status: string | null; property_address: string }> = {};
      for (const r of (data || []) as { probate_case_number: string | null; seller_status: string | null; property_address: string }[]) {
        if (r.probate_case_number && !map[r.probate_case_number]) {
          map[r.probate_case_number] = { seller_status: r.seller_status, property_address: r.property_address || '' };
        }
      }
      setLinkedByCase(map);
      setLinkedLoaded(true);
    } catch {
      setLinkedByCase({});
      setLinkedLoaded(false);
    }
    try {
      setLastContactByLead(await fetchProbateLastContacts(userId));
    } catch {
      setLastContactByLead({});
    }
  }

  async function load() {
    setIsLoading(true);
    setLoadError('');
    try {
      const rows = await fetchProbateLeads(userId, { includeClosed: true });
      if (rows === null) {
        setLoadError('Supabase is not configured on this deployment — probate leads cannot load.');
        setLeads([]);
      } else {
        setLeads(rows);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load probate leads.');
    } finally {
      setIsLoading(false);
    }
    await loadLinked();
  }

  useEffect(() => {
    load();
    loadMyStorefront(userId).then(setProfile).catch(() => setProfile(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const slug = profile?.public_slug?.trim() || '';

  async function runImport(text: string) {
    setImportBusy(true);
    setImportResult('');
    setBanner('');
    try {
      const parsed = parseProbateCsv(text, selectedCounty.label);
      if (parsed.error) {
        setImportResult(`Import failed: ${parsed.error}`);
        return;
      }
      if (parsed.leads.length === 0) {
        setImportResult('Import failed: no probate cases found in that file — check it is a court docket CSV with Name, PartyType, Case Number, and Status columns.');
        return;
      }
      const outcome = await importProbateLeads(userId, parsed.leads as ProbateParsedLead[]);
      const parts = [
        `Imported ${parsed.leads.length} case${parsed.leads.length === 1 ? '' : 's'} (${parsed.openCases} open, ${parsed.closedCases} closed).`,
        `${outcome.inserted} new, ${outcome.updated} updated, ${outcome.skipped} skipped.`,
      ];
      if (outcome.attorneyRetained.length > 0) {
        parts.push(`Attorney Retained: ${outcome.attorneyRetained.join(', ')} — an attorney now appears on a case that had none.`);
      }
      if (outcome.error) parts.push(`Note: ${outcome.error}`);
      setImportResult(parts.join(' '));
      await load();
    } catch (e) {
      setImportResult(`Import failed: ${e instanceof Error ? e.message : 'Unknown error.'}`);
    } finally {
      setImportBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    try {
      // Excel (.xlsx/.xls) reads the FIRST sheet only and feeds the
      // SAME parser as CSV — header auto-mapping, dedupe, and the
      // counts are identical. Never invents columns or rows.
      if (isSpreadsheetFile(file.name)) {
        const rows = await readSpreadsheetRows(file);
        if (rows.length < 2) {
          setImportResult('That spreadsheet has no data rows under its header row — nothing to import.');
          return;
        }
        await runImport(rowsToCsv(rows));
        return;
      }
      const text = await file.text();
      await runImport(text);
    } catch (e) {
      setImportResult(`Import failed: ${e instanceof Error ? e.message : 'Could not read that file.'}`);
    }
  }

  // Export the CURRENT filtered view as CSV (opens in Excel as-is).
  // Same columns as the parsed record file. Nothing the filter
  // hides is exported.
  function downloadCsv() {
    const q = (v: string | null | undefined) => {
      const s = v || '';
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Case Number', 'Status', 'Decedent', 'Aliases', 'Decision-Makers', 'Has Attorney', 'Attorney Names', 'Creditor Claims', 'Notes / Flags', 'Your Notes', 'Property Address', 'Outreach Status', 'County'];
    const lines = [header.join(',')];
    for (const l of visible) {
      lines.push([
        l.case_number,
        l.case_status,
        l.decedent_name || '',
        l.decedent_aliases.join('; '),
        l.decision_makers.map((d) => `${d.name} (${d.role})`).join('; '),
        l.has_attorney ? 'Yes' : 'No',
        l.attorney_names.join('; '),
        l.creditor_claims.join('; '),
        l.notes_flags,
        l.user_notes || '',
        l.property_address || '',
        l.outreach_status,
        l.county,
      ].map(q).join(','));
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `probate-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyText(text: string, label: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setCopied(label),
        () => setCopied('Copy failed — select the text manually.'),
      );
    } else {
      setCopied('Copy is not available in this browser — select the text manually.');
    }
    setTimeout(() => setCopied(''), 3000);
  }

  // Skip trace: call the real Edge Function. There is no provider
  // connected today, so the function answers 'not_configured' and
  // this opens honest manual entry instead — never fake data.
  async function handleSkipTrace(lead: ProbateLeadRow, dmIndex: number) {
    if (!supabase) {
      setBanner('Supabase is not configured on this deployment.');
      return;
    }
    setSkipTraceBusy(true);
    setBanner('');
    setSkipTraceNote('');
    try {
      const { data, error } = await supabase.functions.invoke('skip-trace-decision-maker', {
        body: {
          leadId: lead.id,
          decisionMakerIndex: dmIndex,
          propertyAddress: lead.property_address || undefined,
        },
      });
      if (error) throw new Error(error.message || 'The skip-trace function could not be reached.');
      const mode = (data as { mode?: string } | null)?.mode;
      if (mode === 'live') {
        setBanner('Skip trace complete — contact details were added to this lead from the provider.');
        await load();
      } else if (mode === 'not_configured' || mode === 'unverified') {
        const dm = lead.decision_makers[dmIndex];
        setManual({
          leadId: lead.id,
          dmIndex,
          phone: dm?.phone || '',
          email: dm?.email || '',
          mailingAddress: dm?.mailing_address || '',
          found: false,
        });
        setSkipTraceNote('No skip-trace provider connected yet — enter contact details manually.');
      } else {
        setBanner((data as { error?: string } | null)?.error || 'Skip trace failed — no details were changed.');
      }
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Skip trace failed — no details were changed.');
    } finally {
      setSkipTraceBusy(false);
    }
  }

  async function saveManual() {
    if (!manual) return;
    setManualBusy(true);
    try {
      const updated = await updateDecisionMakerContact(userId, manual.leadId, manual.dmIndex, {
        phone: manual.phone.trim() || null,
        email: manual.email.trim() || null,
        mailing_address: manual.mailingAddress.trim() || null,
        skip_trace_status: manual.found ? 'found' : 'not_found',
      });
      setLeads((prev) => prev.map((l) => (l.id === manual.leadId ? updated : l)));
      setManual(null);
      setSkipTraceNote('');
      setBanner(manual.found ? 'Contact details saved — this decision-maker is now marked Skip Traced.' : 'Marked as not found — no contact details were invented.');
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not save the contact details.');
    } finally {
      setManualBusy(false);
    }
  }

  async function changeOutreach(lead: ProbateLeadRow, status: ProbateOutreachStatus) {
    try {
      await updateProbateOutreachStatus(userId, lead.id, status);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, outreach_status: status } : l)));
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not save the outreach status.');
    }
  }

  function markContactedInRow(leadId: string) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, outreach_status: 'Contacted' as ProbateOutreachStatus } : l)));
    // The modal just wrote a contact-history row; refresh the
    // "Last contact" line so it shows immediately.
    loadLinked();
  }

  const openLeads = leads.filter((l) => l.case_status === 'OPEN');
  const counts = {
    proSe: openLeads.filter((l) => l.is_pro_se).length,
    creditor: openLeads.filter((l) => l.creditor_claims.length > 0).length,
    all: openLeads.length,
    archived: leads.filter((l) => l.case_status === 'CLOSED').length,
  };

  const q = search.trim().toLowerCase();
  const tabbed = leads.filter((l) => {
    if (tab === 'proSe') return l.case_status === 'OPEN' && l.is_pro_se;
    if (tab === 'creditor') return l.case_status === 'OPEN' && l.creditor_claims.length > 0;
    if (tab === 'all') return l.case_status === 'OPEN';
    return l.case_status === 'CLOSED';
  });
  const visible = q
    ? tabbed.filter((l) => {
        const hay = [
          l.case_number,
          l.decedent_name || '',
          ...l.decision_makers.map((d) => d.name),
          ...l.attorney_names,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
    : tabbed;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'proSe', label: 'Top Priority: Pro Se (No Attorney)', count: counts.proSe },
    { key: 'creditor', label: 'Hospital / Creditor Claims', count: counts.creditor },
    { key: 'all', label: 'All Open Probate Leads', count: counts.all },
    { key: 'archived', label: 'Archived (Closed)', count: counts.archived },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>⚖️ Probate Leads</h2>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 16px' }}>
        Import a court docket CSV from any of the seven Florida county presets below and work the
        priority list: pro se cases first — no attorney on the other side. CLOSED cases import as
        archived; they stay callable, they just never appear in the priority tabs. No skip-trace
        provider is connected yet — contact details are entered manually until one is.
      </p>

      {banner && (
        <div style={{ background: '#fef3c7', color: '#0f172a', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
          {banner}
        </div>
      )}
      {importResult && (
        <div style={{ background: '#ecfdf5', color: '#0f172a', border: '1px solid #10b981', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
          {importResult}
        </div>
      )}
      {copied && (
        <div style={{ background: '#eff6ff', color: '#0f172a', border: '1px solid #3b82f6', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
          {copied}
        </div>
      )}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Import a docket CSV or Excel file</div>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,text/plain"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={importBusy}
        />
        {fileName && <span style={{ fontSize: 12, color: '#cbd5e1', marginLeft: 8 }}>{fileName}</span>}
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={4}
          placeholder={'Or paste docket rows here — same columns as the CSV: Name, PartyType, Case Number, Status, Citation Number, Booking Number'}
          style={{ width: '100%', fontSize: 13, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 10, boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={() => runImport(pasteText)}
          disabled={importBusy || !pasteText.trim()}
          style={{ marginTop: 8, padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: importBusy || !pasteText.trim() ? 'not-allowed' : 'pointer', opacity: importBusy || !pasteText.trim() ? 0.5 : 1 }}
        >
          {importBusy ? 'Importing…' : 'Import'}
        </button>
      </div>

      <CountyPresetBar selectedCounty={selectedCounty} onSelectCounty={setSelectedCounty} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: 999,
              border: tab === t.key ? '2px solid #0f172a' : '1px solid #cbd5e1',
              background: tab === t.key ? '#0f172a' : '#fff',
              color: tab === t.key ? '#fff' : '#0f172a',
              cursor: 'pointer',
            }}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by case #, decedent, or decision-maker…"
          style={{ flex: '1 1 260px', fontSize: 13, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={downloadCsv}
          disabled={visible.length === 0}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: visible.length === 0 ? 'not-allowed' : 'pointer', fontSize: 13, opacity: visible.length === 0 ? 0.5 : 1 }}
        >
          Download CSV ({visible.length})
        </button>
      </div>

      {isLoading ? (
        <p style={{ fontSize: 14, color: '#cbd5e1' }}>Loading probate leads…</p>
      ) : loadError ? (
        <p style={{ fontSize: 14, color: '#fca5a5' }}>{loadError}</p>
      ) : visible.length === 0 ? (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 24, textAlign: 'center', fontSize: 14, color: '#cbd5e1' }}>
          {tab === 'proSe' && 'No pro se leads yet — import a docket CSV.'}
          {tab === 'creditor' && 'No leads with hospital or creditor claims yet — import a docket CSV.'}
          {tab === 'all' && (q ? 'No matching open probate leads found.' : 'No open probate leads yet — import a docket CSV.')}
          {tab === 'archived' && 'No closed cases archived yet — CLOSED cases from an import appear here.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 8 }}>Case Number</th>
                <th style={{ padding: 8 }}>Decedent</th>
                <th style={{ padding: 8 }}>Decision-Maker</th>
                <th style={{ padding: 8 }}>Notes / Flags</th>
                <th style={{ padding: 8 }}>Outreach</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => {
                const flags = lead.notes_flags ? lead.notes_flags.split(' • ').filter(Boolean) : [];
                const lastName = lastNameOf(lead.decedent_name);
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>{lead.case_number}</div>
                      <span
                        title={lead.has_attorney ? `Attorney: ${lead.attorney_names.join('; ')}` : 'No attorney listed on the docket'}
                        style={{
                          display: 'inline-block',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          marginTop: 4,
                          background: lead.is_pro_se ? '#dcfce7' : '#fee2e2',
                          color: lead.is_pro_se ? '#166534' : '#991b1b',
                        }}
                      >
                        {lead.is_pro_se ? 'PRO SE • NO ATTORNEY' : 'ATTORNEY REPRESENTED'}
                      </span>
                      <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>{lead.case_status} • {lead.county}</div>
                      {linkedLoaded && (
                        <div style={{ fontSize: 12, marginTop: 6, color: linkedByCase[lead.case_number] ? '#86efac' : '#cbd5e1' }}>
                          {linkedByCase[lead.case_number]
                            ? `✓ Seller submitted — ${linkedByCase[lead.case_number].seller_status || 'received'}`
                            : 'No submission yet'}
                        </div>
                      )}
                      {onDraftContract && (
                        <button
                          type="button"
                          onClick={() => onDraftContract({
                            // First decision-maker + estate. decision_makers
                            // is an array — [0], never a chained ?.?.name.
                            sellerName: lead.decision_makers[0]
                              ? `${formatPersonName(lead.decision_makers[0].name)} (Estate of ${formatPersonName(lead.decedent_name) || 'the decedent'})`
                              : formatPersonName(lead.decedent_name),
                            propertyAddress: lead.property_address || '',
                            county: lead.county,
                            probateCaseNumber: lead.case_number,
                            isProbate: true,
                            // No price from a probate row — the
                            // wholesaler enters the agreed price in
                            // the generator. MAO is never prefilled.
                          })}
                          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer', marginTop: 6 }}
                        >
                          Draft Contract
                        </button>
                      )}
                    </td>
                    <td style={{ padding: 8, minWidth: 220 }}>
                      <div style={{ fontWeight: 600 }}>{lead.decedent_name || 'No decedent listed'}</div>
                      {lead.decedent_aliases.length > 0 && (
                        <div style={{ fontSize: 12, color: '#cbd5e1' }}>Also listed as: {lead.decedent_aliases.join('; ')}</div>
                      )}
                      <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {(() => {
                          // Appraiser link is county-derived: paslc.gov
                          // is St. Lucie ONLY. Any other county shows
                          // no link until the per-county appraiser
                          // directory (follow-up slice) exists. There
                          // is no county_links table in the repo yet,
                          // so no lookup is attempted against one.
                          const appraiserUrl = appraiserUrlForCounty(lead.county);
                          return appraiserUrl ? (
                            <a href={appraiserUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                              Search Property Appraiser ↗
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: '#cbd5e1' }}>No appraiser link for this county yet.</span>
                          );
                        })()}
                        {lastName && (
                          <button type="button" onClick={() => copyText(lastName, `Last name “${lastName}” copied — paste it into the appraiser search.`)} style={{ fontSize: 12, background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0 }}>
                            Copy last name
                          </button>
                        )}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <DebouncedField
                          initial={lead.property_address || ''}
                          placeholder="Property address (from the appraiser)…"
                          label={`Property address for ${lead.case_number}`}
                          onSave={(v) => updateProbatePropertyAddress(userId, lead.id, v)}
                          onError={(m) => setBanner(m)}
                        />
                      </div>
                    </td>
                    <td style={{ padding: 8, minWidth: 260 }}>
                      {lead.decision_makers.length === 0 && (
                        <div style={{ fontSize: 12, color: '#fca5a5' }}>No decision-maker listed — open the docket / petition.</div>
                      )}
                      {lead.decision_makers.map((dm, i) => (
                        <div key={`${dm.name}-${dm.role}`} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                          <div style={{ fontWeight: 600 }}>{dm.name}</div>
                          <div style={{ fontSize: 12, color: '#cbd5e1' }}>{dm.role}</div>
                          {dm.skip_trace_status !== 'pending' && (
                            <div style={{ fontSize: 11, marginTop: 2, color: dm.skip_trace_status === 'found' ? '#86efac' : '#fca5a5' }}>
                              {dm.skip_trace_status === 'found' ? '✓ Contact found' : '✕ Contact not found'}
                            </div>
                          )}
                          <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
                            {dm.phone && (
                              <>
                                <a href={`tel:${dm.phone}`}>📞 {dm.phone}</a>
                                <a href={`sms:${dm.phone}`}>💬 Text</a>
                                <button
                                  type="button"
                                  onClick={() => dispatchConnectCall(dm.phone)}
                                  style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
                                >
                                  Call
                                </button>
                              </>
                            )}
                            {dm.email && <a href={`mailto:${dm.email}`}>✉️ {dm.email}</a>}
                            {!dm.phone && !dm.email && <span style={{ color: '#cbd5e1' }}>No contact info yet.</span>}
                          </div>
                          {dm.mailing_address && <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>{dm.mailing_address}</div>}
                          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleSkipTrace(lead, i)}
                              disabled={skipTraceBusy}
                              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
                            >
                              Skip Trace / Find Contact
                            </button>
                            <button
                              type="button"
                              onClick={() => setGoogleTarget({ lead, dmIndex: i })}
                              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#0f172a', cursor: 'pointer' }}
                            >
                              🔎 Google Lookup
                            </button>
                            <button
                              type="button"
                              onClick={() => setOutreachTarget({ lead, dmIndex: i })}
                              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
                            >
                              Draft Outreach
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintTarget({ lead, dmIndex: i })}
                              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
                            >
                              Print Letter
                            </button>
                          </div>
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: 8, minWidth: 220 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                        {flags.map((f) => (
                          <span key={f} style={{ fontSize: 11, background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 999, padding: '2px 8px' }}>
                            {f}
                          </span>
                        ))}
                      </div>
                      <DebouncedField
                        initial={lead.user_notes || ''}
                        placeholder="Your notes on this lead…"
                        label={`Notes for ${lead.case_number}`}
                        multiline
                        onSave={(v) => updateProbateUserNotes(userId, lead.id, v)}
                        onError={(m) => setBanner(m)}
                      />
                      <div style={{ marginTop: 8 }}>
                        {slug ? (
                          <button
                            type="button"
                            onClick={() => copyText(storefrontLink(slug, lead.case_number), `Storefront link copied: ${storefrontLink(slug, lead.case_number)}`)}
                            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}
                          >
                            Copy Storefront Link
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#cbd5e1' }}>Save Storefront Settings first to copy your storefront link.</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 8 }}>
                      <select
                        value={lead.outreach_status}
                        onChange={(e) => changeOutreach(lead, e.target.value as ProbateOutreachStatus)}
                        style={{ fontSize: 13, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }}
                        aria-label={`Outreach status for ${lead.case_number}`}
                      >
                        {PROBATE_OUTREACH_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {lastContactByLead[lead.id] && (
                        <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 6 }}>
                          Last contact: {new Date(lastContactByLead[lead.id].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} via {lastContactByLead[lead.id].activity_type}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {skipTraceNote && (
        <div style={{ background: '#eff6ff', color: '#0f172a', border: '1px solid #3b82f6', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginTop: 12 }}>
          {skipTraceNote}
        </div>
      )}

      {manual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', color: '#0f172a', borderRadius: 12, padding: 20, maxWidth: 480, width: '100%' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Enter contact details manually</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
              No skip-trace provider connected yet — enter contact details manually. Only enter details
              you actually found; nothing here is guessed or generated.
            </p>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Phone
              <input type="tel" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }} />
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Email
              <input type="email" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }} />
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 12 }}>
              Mailing address
              <input type="text" value={manual.mailingAddress} onChange={(e) => setManual({ ...manual, mailingAddress: e.target.value })} style={{ display: 'block', width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 4, boxSizing: 'border-box' }} />
            </label>
            <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 16, alignItems: 'center' }}>
              <input type="checkbox" checked={manual.found} onChange={(e) => setManual({ ...manual, found: e.target.checked })} />
              I found contact details (uncheck if you looked and found nothing)
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setManual(null); setSkipTraceNote(''); }} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={saveManual} disabled={manualBusy} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>
                {manualBusy ? 'Saving…' : 'Save contact details'}
              </button>
            </div>
          </div>
        </div>
      )}

      {outreachTarget && (
        <ProbateOutreachModal
          lead={outreachTarget.lead}
          decisionMaker={outreachTarget.lead.decision_makers[outreachTarget.dmIndex]}
          userId={userId}
          profile={profile}
          onClose={() => setOutreachTarget(null)}
          onMarkedContacted={() => markContactedInRow(outreachTarget.lead.id)}
        />
      )}

      {printTarget && (
        <ProbateDirectMailPrintModal
          lead={printTarget.lead}
          decisionMaker={printTarget.lead.decision_makers[printTarget.dmIndex]}
          userId={userId}
          profile={profile}
          onClose={() => setPrintTarget(null)}
          onMarkedContacted={() => markContactedInRow(printTarget.lead.id)}
        />
      )}

      {googleTarget && (
        <GoogleSkipTraceModal
          target={{ kind: 'probate', leadId: googleTarget.lead.id, decisionMakerIndex: googleTarget.dmIndex }}
          ownerName={googleTarget.lead.decision_makers[googleTarget.dmIndex]?.name || ''}
          propertyAddress={googleTarget.lead.property_address || ''}
          cityState={selectedCounty.defaultCityState}
          currentPhone={googleTarget.lead.decision_makers[googleTarget.dmIndex]?.phone || null}
          currentEmail={googleTarget.lead.decision_makers[googleTarget.dmIndex]?.email || null}
          onSave={async (phone, email) => {
            // Same verified write as the manual skip-trace save:
            // phone/email + the found/not_found status; the API
            // advances outreach_status to 'Skip Traced' only when
            // the lead is still 'New'. No activity row, no Contacted.
            await updateDecisionMakerContact(userId, googleTarget.lead.id, googleTarget.dmIndex, {
              phone,
              email,
              skip_trace_status: phone || email ? 'found' : 'not_found',
            });
            setBanner(
              phone || email
                ? 'Google lookup contact details saved — this decision-maker is now marked Skip Traced.'
                : 'Marked as not found — no contact details were invented.',
            );
          }}
          onClose={() => setGoogleTarget(null)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}
