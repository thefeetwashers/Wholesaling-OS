import { supabase, supabaseConfigured } from './supabase';
import { appraiserUrlForCounty } from './floridaCountyPresets';

export { appraiserUrlForCounty } from './floridaCountyPresets';

// Slice 127 — Probate Lead Importer & Priority Database.
//
// The parser reads a court docket CSV (columns Name, PartyType,
// Case Number, Status, Citation Number, Booking Number) — the exact
// shape the clerk's case index exports — or the same rows pasted as
// text, and groups them by Case Number into one probate lead per
// case. Nothing here is seeded, scraped, or invented: every fact
// on a lead comes from a row in the file the wholesaler uploaded.
// Phone numbers and emails start null and are filled ONLY by the
// wholesaler's own manual entry or a real skip-trace result.
//
// Standing rules this parser follows:
//   * CLOSED cases are imported as archived rows (the founder's
//     rule: CLOSED Summary Administration cases are still
//     callable). The default view shows OPEN only; CLOSED lives
//     under "Archived (Closed)".
//   * is_pro_se is a GENERATED column in the database (NOT
//     has_attorney) — it is NEVER in an insert/upsert payload.
//   * Re-uploads MERGE, they never overwrite: saved decision-
//     maker contact fields survive when the new file has nulls
//     for them, and saved decision-makers the new file omits are
//     kept (this batch is a SUBSET of an earlier 57-case export,
//     so a later import can list fewer names for a case).

export type DecisionMakerRole = 'PETITIONER' | 'PERSONAL REPRESENTATIVE' | 'TRUSTEE';

export type SkipTraceStatus = 'pending' | 'found' | 'not_found';

export interface DecisionMaker {
  name: string;
  role: DecisionMakerRole;
  phone: string | null;
  email: string | null;
  mailing_address: string | null;
  skip_trace_status: SkipTraceStatus;
  /** The name exactly as the docket printed it (birth year kept). */
  raw_name?: string;
  /** Extra phones found by a real skip trace (first is `phone`). */
  alt_phones?: string[];
  /** Extra emails found by a real skip trace (first is `email`). */
  alt_emails?: string[];
  /** When a real skip trace last ran for this decision-maker. */
  skip_traced_at?: string | null;
}

export type ProbateOutreachStatus =
  | 'New'
  | 'Skip Traced'
  | 'Contacted'
  | 'Offer Sent'
  | 'Under Contract'
  | 'Dead';

export const PROBATE_OUTREACH_STATUSES: ProbateOutreachStatus[] = [
  'New',
  'Skip Traced',
  'Contacted',
  'Offer Sent',
  'Under Contract',
  'Dead',
];

export interface ProbateLead {
  id?: string;
  user_id?: string;
  county: string;
  case_number: string;
  case_status: 'OPEN' | 'CLOSED';
  decedent_name: string | null;
  decedent_aliases: string[];
  decision_makers: DecisionMaker[];
  has_attorney: boolean;
  attorney_names: string[];
  /** Generated in the database (NOT has_attorney); read-only here. */
  is_pro_se?: boolean;
  creditor_claims: string[];
  notes_flags: string;
  /** The wholesaler's own editable notes. Never rebuilt by the parser. */
  user_notes?: string;
  property_address: string | null;
  paslc_search_url: string | null;
  outreach_status: ProbateOutreachStatus;
  created_at?: string;
  updated_at?: string;
  /** The decedent name exactly as the docket printed it. Parser-only; not stored. */
  rawDecedentName?: string | null;
}

export interface ProbateParsedLead extends ProbateLead {
  rawDecedentName: string | null;
}

export const PASLC_SEARCH_URL = 'https://paslc.gov';
export const DEFAULT_PROBATE_COUNTY = 'St. Lucie County, FL';

// Appraiser URLs live in lib/floridaCountyPresets.ts (verified per
// county, Nov 16, 2026): paslc.gov is the ST. LUCIE COUNTY
// Property Appraiser ONLY — never show it for another county.
// National scope (founder, Nov 16, 2026): the platform aims at all
// 50 states + territories, but a county with no preset yet gets null
// (honest empty state, no link shown).

// Strip a trailing birth year in parentheses — "BROWN, JACORY
// THEODORE (2011)" -> "BROWN, JACORY THEODORE". The raw name is
// kept separately (rawDecedentName / raw_name) so nothing is lost.
export function cleanPersonName(raw: string): string {
  return raw.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}

// Last name for the appraiser copy button. "SCHOEPP, BARBARA SUE"
// -> "SCHOEPP". Never split().trim() on an array — split returns
// an array; take [0] first.
export function lastNameOf(name: string | null | undefined): string {
  if (!name) return '';
  return (name.split(',')[0] || '').trim();
}

// Title-case one word, keeping initials ("J" stays "J").
function titleWord(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function titleCaseWords(text: string): string {
  return text.split(/\s+/).filter(Boolean).map(titleWord).join(' ');
}

// First name for outreach ("SCHOEPP, BARBARA SUE" -> "Barbara").
// Guards: no comma means the whole name is used, first word taken.
export function firstNameOf(name: string | null | undefined): string {
  if (!name) return '';
  const cleaned = cleanPersonName(name);
  const afterComma = cleaned.split(',')[1]?.trim() || '';
  const first = (afterComma || cleaned).split(' ')[0] || '';
  return titleWord(first);
}

// Full name in natural order ("SCHOEPP, BARBARA SUE" ->
// "Barbara Sue Schoepp"). A name with no comma is title-cased
// as-is — never "undefined SCHOEPP".
export function formatPersonName(name: string | null | undefined): string {
  if (!name) return '';
  const cleaned = cleanPersonName(name);
  if (!cleaned.includes(',')) return titleCaseWords(cleaned);
  const last = titleWord((cleaned.split(',')[0] || '').trim());
  const firstPart = titleCaseWords(cleaned.split(',')[1]?.trim() || '');
  return [firstPart, last].filter(Boolean).join(' ');
}

const DM_ROLES = new Set<string>(['PETITIONER', 'PERSONAL REPRESENTATIVE', 'TRUSTEE']);

// Quote-aware CSV parse — same shape as the distress-list importer
// (lib CsvLeadImporter) so docket files read identically. Handles
// quoted fields, a BOM, and CRLF; drops fully-empty rows. The
// delimiter is ',' by default; Slice 129 passes '\t' when the header
// line carries more tabs than commas (some clerk exports are
// tab-delimited). Quoted commas stay inside their field either way.
export function parseCsvRows(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const t = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Slice 129 — header-alias mapping. Different county clerk portals
// export different column names and orders (St. Lucie: "Name",
// "PartyType", "Case Number", "Status"; Broward/Palm Beach/Charlotte
// may use "Party Name", "Role", "Case #", "Case Status"). Headers
// are normalized (lowercase, non-alphanumerics stripped) and matched
// against the alias lists — exact first, then partial (the header
// contains the alias). A column with no alias match falls back to
// its usual position (name 0, party type 1, case number 2, status
// 3); the parse still errors when the name or case-number column
// cannot be found at all.
function mapHeaderIndices(headers: string[]): {
  nameIdx: number;
  partyTypeIdx: number;
  caseNumberIdx: number;
  statusIdx: number;
  detected: { nameHeader: string; partyTypeHeader: string; caseNumberHeader: string; statusHeader: string };
} {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (aliases: string[], fallbackIndex: number): number => {
    const exact = normalized.findIndex((h) => aliases.includes(h));
    if (exact !== -1) return exact;
    const partial = normalized.findIndex((h) => aliases.some((alias) => h.includes(alias)));
    return partial !== -1 ? partial : fallbackIndex;
  };
  const nameIdx = findCol(['name', 'partyname', 'fullname', 'litigant', 'party'], 0);
  const partyTypeIdx = findCol(['partytype', 'role', 'partyrole', 'type', 'capacity', 'relation'], 1);
  const caseNumberIdx = findCol(['casenumber', 'caseno', 'case', 'caseid', 'docketnumber', 'ucn'], 2);
  const statusIdx = findCol(['status', 'casestatus', 'disposition', 'state'], 3);
  const headerName = (i: number) => headers[i] || `Column ${i + 1}`;
  return {
    nameIdx,
    partyTypeIdx,
    caseNumberIdx,
    statusIdx,
    detected: {
      nameHeader: headerName(nameIdx),
      partyTypeHeader: headerName(partyTypeIdx),
      caseNumberHeader: headerName(caseNumberIdx),
      statusHeader: headerName(statusIdx),
    },
  };
}

// Slice 129 — role normalization. County exports label the same
// party different ways ("Administrator", "Executor", "Counsel",
// "Applicant", "Creditor"); they all map to the canonical roles
// the parser and the database use. Anything unrecognized passes
// through uppercased, so JUDGE still reads JUDGE and is ignored.
function normalizePartyRole(rawRole: string): string {
  const r = rawRole.toUpperCase().trim();
  if (r.includes('DECEDENT') || r.includes('DECEASED')) return 'DECEDENT';
  if (r.includes('ATTORNEY') || r.includes('COUNSEL') || r.includes('ESQ') || r.includes('LAWYER')) return 'ATTORNEY';
  if (r.includes('PERSONAL REP') || r.includes('ADMINISTRATOR') || r.includes('EXECUTOR')) return 'PERSONAL REPRESENTATIVE';
  if (r.includes('PETITIONER') || r.includes('APPLICANT')) return 'PETITIONER';
  if (r.includes('TRUSTEE')) return 'TRUSTEE';
  if (r.includes('CLAIMANT') || r.includes('CREDITOR')) return 'CLAIMANT';
  return r;
}

export interface ProbateParseError {
  message: string;
}

export interface ProbateParseResult {
  leads: ProbateParsedLead[];
  totalCases: number;
  openCases: number;
  closedCases: number;
  proSeCases: number;
  casesWithoutDecisionMaker: number;
  error?: string;
  /** Slice 129 — the header the parser actually mapped, so the
      importer can say which columns it read (Broward's "Party
      Name" is not St. Lucie's "Name"). */
  detectedColumns?: {
    nameHeader: string;
    partyTypeHeader: string;
    caseNumberHeader: string;
    statusHeader: string;
  };
}

function buildNotesFlags(lead: ProbateParsedLead): string {
  const flags: string[] = [];
  if (!lead.has_attorney) flags.push('Pro Se - No attorney listed');
  for (const c of lead.creditor_claims) {
    const upper = c.toUpperCase();
    if (upper.includes('HOSPITAL') || upper.includes('HCA')) flags.push(`Hospital Claim: ${c}`);
    else flags.push(`Creditor Claim: ${c}`);
  }
  if (lead.decision_makers.length > 1) flags.push(`Multiple Decision-Makers (${lead.decision_makers.length})`);
  if (lead.decision_makers.length === 0) flags.push('NO DECISION-MAKER LISTED - open docket/petition');
  if (lead.decedent_aliases.length > 0) flags.push(`Alias${lead.decedent_aliases.length > 1 ? 'es' : ''}: ${lead.decedent_aliases.join('; ')}`);
  return flags.join(' • ');
}

// Parse a docket CSV (or pasted rows in the same shape) into one
// lead per Case Number. Returns an error string instead of throwing
// on a bad header or an empty file, so the UI can say so honestly.
// Slice 129: the county comes from the selected county preset
// (default St. Lucie County, FL) — it sets the lead's county and
// the appraiser URL; the header is alias-mapped and the delimiter
// is detected, so Broward/Palm Beach/Charlotte exports parse too.
export function parseProbateCsv(text: string, county: string = DEFAULT_PROBATE_COUNTY): ProbateParseResult {
  const empty: ProbateParseResult = {
    leads: [], totalCases: 0, openCases: 0, closedCases: 0,
    proSeCases: 0, casesWithoutDecisionMaker: 0,
  };
  if (!text || !text.trim()) return { ...empty, error: 'Nothing to parse — the file or pasted text is empty.' };
  // Delimiter detection: more tabs than commas in the header line
  // means a tab-delimited export.
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/).find((l) => l.trim() !== '') || '';
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const delimiter = tabs > commas ? '\t' : ',';
  const rows = parseCsvRows(text, delimiter);
  if (rows.length < 2) return { ...empty, error: 'No data rows found under the header row.' };
  const { nameIdx, partyTypeIdx, caseNumberIdx, statusIdx, detected } = mapHeaderIndices(rows[0]);
  if (nameIdx >= rows[0].length || caseNumberIdx >= rows[0].length) {
    return { ...empty, error: 'Header not recognized — expected columns "Name", "PartyType", "Case Number", "Status" (Citation Number and Booking Number are optional).' };
  }

  // Group rows by Case Number, keeping first-seen order.
  const byCase = new Map<string, { status: string; rows: { name: string; type: string }[] }>();
  for (const r of rows.slice(1)) {
    const caseNumber = (r[caseNumberIdx] || '').trim();
    if (!caseNumber) continue;
    const name = (r[nameIdx] || '').trim();
    // Slice 129 — normalize the county's role label to the
    // canonical role before grouping (ADMINISTRATOR/EXECUTOR are
    // the personal representative; COUNSEL is the attorney).
    const type = normalizePartyRole((r[partyTypeIdx] || '').trim());
    const status = (r[statusIdx] || '').trim().toUpperCase();
    if (!name && !type) continue;
    let group = byCase.get(caseNumber);
    if (!group) { group = { status: status || 'OPEN', rows: [] }; byCase.set(caseNumber, group); }
    group.rows.push({ name, type });
  }

  const leads: ProbateParsedLead[] = [];
  for (const [caseNumber, group] of byCase) {
    const caseStatus: 'OPEN' | 'CLOSED' = group.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
    const decedentRows = group.rows.filter((r) => r.type === 'DECEDENT' && r.name);
    const rawDecedentName = decedentRows.length > 0 ? decedentRows[0].name : null;
    const decedentName = rawDecedentName ? cleanPersonName(rawDecedentName) : null;
    const seenAlias = new Set<string>();
    const aliases: string[] = [];
    for (const d of decedentRows.slice(1)) {
      const cleaned = cleanPersonName(d.name);
      const key = cleaned.toUpperCase();
      if (cleaned && key !== (decedentName || '').toUpperCase() && !seenAlias.has(key)) {
        seenAlias.add(key); aliases.push(cleaned);
      }
    }
    // Decision-makers, deduped by name + role (birth year stripped
    // for matching — "SMALLEY, LINDA (1948)" is one person).
    const seenDm = new Set<string>();
    const decisionMakers: DecisionMaker[] = [];
    for (const r of group.rows) {
      if (!DM_ROLES.has(r.type) || !r.name) continue;
      const cleaned = cleanPersonName(r.name);
      const key = `${cleaned.toUpperCase()}|${r.type}`;
      if (seenDm.has(key)) continue;
      seenDm.add(key);
      decisionMakers.push({
        name: cleaned,
        role: r.type as DecisionMakerRole,
        phone: null,
        email: null,
        mailing_address: null,
        skip_trace_status: 'pending',
        raw_name: r.name,
      });
    }
    const seenAtt = new Set<string>();
    const attorneyNames: string[] = [];
    for (const r of group.rows) {
      if (r.type !== 'ATTORNEY' || !r.name) continue;
      const cleaned = cleanPersonName(r.name);
      const key = cleaned.toUpperCase();
      if (!cleaned || seenAtt.has(key)) continue;
      seenAtt.add(key); attorneyNames.push(cleaned);
    }
    const seenClaim = new Set<string>();
    const creditorClaims: string[] = [];
    for (const r of group.rows) {
      if (r.type !== 'CLAIMANT' || !r.name) continue;
      const cleaned = cleanPersonName(r.name);
      const key = cleaned.toUpperCase();
      if (!cleaned || seenClaim.has(key)) continue;
      seenClaim.add(key); creditorClaims.push(cleaned);
    }
    const lead: ProbateParsedLead = {
      county,
      case_number: caseNumber,
      case_status: caseStatus,
      decedent_name: decedentName,
      decedent_aliases: aliases,
      decision_makers: decisionMakers,
      has_attorney: attorneyNames.length > 0,
      attorney_names: attorneyNames,
      creditor_claims: creditorClaims,
      notes_flags: '',
      property_address: null,
      // Appraiser URL comes from the selected county preset —
      // paslc.gov for St. Lucie, the preset's verified appraiser
      // page for other counties, null for a county with no preset.
      // Never a name concatenated onto the domain.
      paslc_search_url: appraiserUrlForCounty(county),
      outreach_status: 'New',
      rawDecedentName,
    };
    lead.notes_flags = buildNotesFlags(lead);
    leads.push(lead);
  }

  return {
    leads,
    totalCases: leads.length,
    openCases: leads.filter((l) => l.case_status === 'OPEN').length,
    closedCases: leads.filter((l) => l.case_status === 'CLOSED').length,
    proSeCases: leads.filter((l) => !l.has_attorney).length,
    casesWithoutDecisionMaker: leads.filter((l) => l.decision_makers.length === 0).length,
    detectedColumns: detected,
  };
}

// Merge an incoming parsed lead into a saved row on re-upload.
// Saved contact fields win over incoming nulls; saved
// decision-makers the new file omits are KEPT (union by name +
// role); only new names are appended. property_address and
// outreach_status keep the saved values. is_pro_se is generated
// in the database and is never in the payload.
export function mergeProbateLead(
  existing: ProbateLead,
  incoming: ProbateParsedLead,
): { row: Record<string, unknown>; attorneyRetained: boolean } {
  const attorneyRetained = !existing.has_attorney && incoming.has_attorney;
  const mergedDms: DecisionMaker[] = (existing.decision_makers || []).map((d) => ({ ...d }));
  const dmIndex = new Map<string, number>();
  mergedDms.forEach((d, i) => dmIndex.set(`${d.name.toUpperCase()}|${d.role}`, i));
  for (const inc of incoming.decision_makers) {
    const key = `${inc.name.toUpperCase()}|${inc.role}`;
    const idx = dmIndex.get(key);
    if (idx === undefined) {
      mergedDms.push({ ...inc });
      dmIndex.set(key, mergedDms.length - 1);
    } else {
      // Same person, possibly a new raw spelling — keep the saved
      // contact fields; only the name/role refresh from the file.
      mergedDms[idx] = { ...mergedDms[idx], name: inc.name, role: inc.role, raw_name: inc.raw_name || mergedDms[idx].raw_name };
    }
  }
  const row: Record<string, unknown> = {
    county: incoming.county,
    case_status: incoming.case_status,
    decedent_name: incoming.decedent_name,
    decedent_aliases: incoming.decedent_aliases,
    decision_makers: mergedDms,
    has_attorney: incoming.has_attorney,
    attorney_names: incoming.attorney_names,
    creditor_claims: incoming.creditor_claims,
    notes_flags: incoming.notes_flags,
    property_address: existing.property_address || incoming.property_address || null,
    paslc_search_url: incoming.paslc_search_url,
    outreach_status: existing.outreach_status,
  };
  return { row, attorneyRetained };
}

export interface ProbateImportOutcome {
  inserted: number;
  updated: number;
  skipped: number;
  attorneyRetained: string[];
  error?: string;
}

// Import parsed leads into probate_leads for one wholesaler.
// New cases insert; existing cases merge (see mergeProbateLead).
// Never writes is_pro_se (generated column). Returns counts plus
// the "Attorney Retained" alerts for the UI banner.
export async function importProbateLeads(
  userId: string,
  parsed: ProbateParsedLead[],
): Promise<ProbateImportOutcome> {
  if (!supabaseConfigured || !supabase) {
    return { inserted: 0, updated: 0, skipped: 0, attorneyRetained: [], error: 'Supabase is not configured on this deployment — nothing was imported.' };
  }
  const outcome: ProbateImportOutcome = { inserted: 0, updated: 0, skipped: 0, attorneyRetained: [] };
  try {
    const { data: existingRows, error: loadError } = await supabase
      .from('probate_leads')
      .select('*')
      .eq('user_id', userId);
    if (loadError) throw new Error(loadError.message || 'Could not read your existing probate leads.');
    const byCase = new Map<string, ProbateLead>();
    for (const r of (existingRows || []) as ProbateLead[]) byCase.set(r.case_number, r);

    for (const incoming of parsed) {
      const existing = byCase.get(incoming.case_number);
      if (!existing) {
        const insertRow: Record<string, unknown> = {
          user_id: userId,
          county: incoming.county,
          case_number: incoming.case_number,
          case_status: incoming.case_status,
          decedent_name: incoming.decedent_name,
          decedent_aliases: incoming.decedent_aliases,
          decision_makers: incoming.decision_makers,
          has_attorney: incoming.has_attorney,
          attorney_names: incoming.attorney_names,
          creditor_claims: incoming.creditor_claims,
          notes_flags: incoming.notes_flags,
          property_address: incoming.property_address,
          paslc_search_url: incoming.paslc_search_url,
          outreach_status: 'New',
        };
        const { error } = await supabase.from('probate_leads').insert(insertRow);
        if (error) {
          if (!outcome.error) outcome.error = error.message || 'A row was rejected by the database.';
          outcome.skipped += 1;
          continue;
        }
        outcome.inserted += 1;
      } else {
        const { row, attorneyRetained } = mergeProbateLead(existing, incoming);
        const { error } = await supabase
          .from('probate_leads')
          .update(row)
          .eq('id', existing.id)
          .eq('user_id', userId);
        if (error) {
          if (!outcome.error) outcome.error = error.message || 'A row was rejected by the database.';
          outcome.skipped += 1;
          continue;
        }
        outcome.updated += 1;
        if (attorneyRetained) outcome.attorneyRetained.push(incoming.case_number);
      }
    }
    return outcome;
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Import stopped — check the file and try again.';
    return { ...outcome, error: m };
  }
}
