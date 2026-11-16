'use client';

import { useState } from 'react';
import { importLeads, loadLeads, type Lead } from '../lib/leads';
import { readSpreadsheetRows, isSpreadsheetFile } from '../lib/spreadsheet';

// Slice 123 — distress-list CSV importer. This is NOT the Import
// Inbox (components/ImportInbox.tsx, Slice 30): that one imports
// any list with per-field mapping. This one imports the lists a
// wholesaler pulls from the county — lis pendens, probate, tax
// delinquent, tax deed, code violations — and files them with the
// distress signal attached:
//   * a whole-file distress tag (the list's own signal), with an
//     optional per-row tag column that overrides it per row;
//   * an absentee flag set automatically when the owner's mailing
//     address differs from the property (situs) address;
//   * dedupe inside the file (same parcel ID, or same owner +
//     address) and against the leads already in the office.
// Inserts run in 250-row batches. The two columns this writes
// (distress_tag, is_absentee_owner) arrive with migration
// 20261115120000 — until the owner applies it, the import still
// works: the tag is stamped into each lead's notes instead, and
// the result says so plainly.

export type DistressTag =
  | 'tax_delinquent'
  | 'lis_pendens'
  | 'probate'
  | 'code_violation'
  | 'vacant_absentee'
  | 'fire_damage'
  | 'tax_deed';

export const DISTRESS_TAGS: { value: DistressTag; label: string }[] = [
  { value: 'tax_delinquent', label: 'Tax-delinquent' },
  { value: 'lis_pendens', label: 'Lis pendens (foreclosure filed)' },
  { value: 'probate', label: 'Probate / estate' },
  { value: 'code_violation', label: 'Code violation' },
  { value: 'vacant_absentee', label: 'Vacant / absentee owner' },
  { value: 'fire_damage', label: 'Fire damage' },
  { value: 'tax_deed', label: 'Tax deed / lands available' },
];

const TAG_VALUES = new Set<string>(DISTRESS_TAGS.map((t) => t.value));

type FieldKey = 'property_address' | 'city' | 'state' | 'zip' | 'county' | 'owner_name'
  | 'mailing_address' | 'mailing_city' | 'mailing_state' | 'mailing_zip' | 'parcel_id'
  | 'assessed_value' | 'year_built' | 'distress_tag' | 'case_number' | 'description';

const FIELDS: { key: FieldKey; label: string; aliases: string[] }[] = [
  { key: 'property_address', label: 'Property address', aliases: ['property_address', 'property address', 'address', 'street address', 'street', 'situs address', 'property', 'situs'] },
  { key: 'case_number', label: 'Case number (for case lists without addresses)', aliases: ['case number', 'case_number', 'caseid', 'case id', 'case no', 'case no.'] },
  { key: 'description', label: 'Description / parties', aliases: ['description', 'desc', 'case description', 'parties', 'plaintiff', 'case parties'] },
  { key: 'city', label: 'City', aliases: ['city'] },
  { key: 'state', label: 'State', aliases: ['state', 'st'] },
  { key: 'zip', label: 'ZIP', aliases: ['zip', 'zipcode', 'zip code', 'postal'] },
  { key: 'county', label: 'County', aliases: ['county'] },
  { key: 'owner_name', label: 'Owner name', aliases: ['owner_name', 'owner name', 'owner', 'name', 'owner 1', 'defendant'] },
  { key: 'mailing_address', label: 'Mailing address', aliases: ['mailing_address', 'mailing address', 'mailing', 'owner address', 'mail address'] },
  { key: 'mailing_city', label: 'Mailing city', aliases: ['mailing city', 'mailing_city', 'mail city'] },
  { key: 'mailing_state', label: 'Mailing state', aliases: ['mailing state', 'mailing_state', 'mail state'] },
  { key: 'mailing_zip', label: 'Mailing ZIP', aliases: ['mailing zip', 'mailing_zip', 'mailing zipcode', 'mail zip'] },
  { key: 'parcel_id', label: 'Parcel / APN', aliases: ['parcel', 'parcel_id', 'parcel id', 'apn', 'folio', 'account'] },
  { key: 'assessed_value', label: 'Assessed value (county)', aliases: ['assessed', 'assessed value', 'assessed_value', 'market value', 'just value'] },
  { key: 'year_built', label: 'Year built', aliases: ['year built', 'year_built', 'yr built', 'built'] },
  { key: 'distress_tag', label: 'Distress tag column (overrides the file tag per row)', aliases: ['distress_tag', 'distress tag', 'tag', 'signal', 'list type', 'distress'] },
];

const MAX_ROWS = 1000;
const BATCH_SIZE = 250;

// Quote-aware CSV parse — mirrors the ImportInbox parser (same
// file shape, same empty-row rule) so the two importers read a
// file identically.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function normAddr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normTag(raw: string): DistressTag | null {
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return TAG_VALUES.has(v) ? (v as DistressTag) : null;
}

// Defendant (owner) from a case description like
// "PNC BANK NATIONAL ASSOCIATION -VS- COOPER, AMANDA" — the party
// after -VS-. Returns '' when there is no -VS- (never guesses).
export function defendantFromDescription(description: string): string {
  const parts = description.split(/\s+-VS-\s*/i);
  return parts.length > 1 ? (parts[parts.length - 1] || '').trim() : '';
}

export interface DistressBuildOutput {
  toInsert: Lead[];
  dupes: number;
  noAddress: number;
  addressNeeded: number;
  absentee: number;
  tagged: number;
}

// Pure row -> lead builder (exported so the address-less branch is
// testable without a browser). Same dedupe / tag / absentee rules
// the component always used, plus the address-optional rule:
// a row with NO property address but WITH a case number still
// becomes a lead — property_address stays '' (never invented),
// the case number + parties ride in the notes, and the row is
// flagged "address needed" with its next step. A row with neither
// an address nor a case number cannot be identified at all and is
// skipped. Address-less rows dedupe within the file by case number
// (leads carry no case-number column to match against the office).
export function buildDistressLeads(args: {
  rows: string[][];
  mapping: Partial<Record<FieldKey, number>>;
  fileTag: DistressTag | '';
  sourceLabel: string;
  fileName: string;
  existing: Lead[];
}): DistressBuildOutput {
  const { rows, mapping, fileTag, sourceLabel, fileName, existing } = args;
  const cell = (r: string[], key: FieldKey): string => {
    const idx = mapping[key];
    if (idx === undefined || idx < 0) return '';
    return (r[idx] || '').trim();
  };
  const seenParcel = new Set<string>();
  const seenAddr = new Set<string>();
  const seenCase = new Set<string>();
  for (const l of existing) {
    if (l.parcel_id) seenParcel.add(normAddr(l.parcel_id));
    seenAddr.add(`${normAddr(l.property_address)}|${normAddr(l.zip || l.city || '')}`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const stamp = `Imported ${today} from "${fileName}" — source: ${sourceLabel.trim()}`;
  const toInsert: Lead[] = [];
  let dupes = 0;
  let noAddress = 0;
  let addressNeeded = 0;
  let absentee = 0;
  let tagged = 0;
  for (const r of rows) {
    const address = cell(r, 'property_address');
    const caseNumber = cell(r, 'case_number');
    const description = cell(r, 'description');
    const rowTag = normTag(cell(r, 'distress_tag'));
    const tag = rowTag || (fileTag === '' ? null : fileTag);
    if (tag) tagged++;
    const money = (v: string): number | null => { const n = parseFloat((v || '').replace(/[$,]/g, '')); return Number.isFinite(n) && n >= 0 ? n : null; };
    if (!address) {
      // Address-less case row (e.g. the founder's foreclosure file:
      // caseid, Case Number, Description, Case Type, Entered Date,
      // TotalFee — no address column at all). Keep it, flagged.
      if (!caseNumber) { noAddress++; continue; }
      const caseKey = normAddr(caseNumber);
      if (seenCase.has(caseKey)) { dupes++; continue; }
      seenCase.add(caseKey);
      const owner = cell(r, 'owner_name') || defendantFromDescription(description);
      addressNeeded++;
      toInsert.push({
        property_address: '',
        city: cell(r, 'city') || null,
        state: cell(r, 'state') || null,
        zip: cell(r, 'zip') || null,
        county: cell(r, 'county') || null,
        owner_name: owner || null,
        mailing_address: cell(r, 'mailing_address') || null,
        mailing_city: cell(r, 'mailing_city') || null,
        mailing_state: cell(r, 'mailing_state') || null,
        mailing_zip: cell(r, 'mailing_zip') || null,
        parcel_id: cell(r, 'parcel_id') || null,
        assessed_value: money(cell(r, 'assessed_value')),
        year_built: (() => { const y = parseInt(cell(r, 'year_built'), 10); return Number.isFinite(y) && y > 1600 && y < 2100 ? y : null; })(),
        status: 'new',
        list_source: `Distress import: ${sourceLabel.trim()}`.slice(0, 120),
        notes: `${stamp} · Case ${caseNumber}${description ? ` — ${description}` : ''} · Address needed — next step: Clerk case lookup → appraiser mailing address`,
        consent_status: 'unknown',
        distress_tag: tag,
        is_absentee_owner: false,
      } as unknown as Lead);
      continue;
    }
    const parcel = cell(r, 'parcel_id');
    const owner = cell(r, 'owner_name');
    const parcelKey = parcel ? normAddr(parcel) : '';
    const addrKey = `${normAddr(address)}|${normAddr(cell(r, 'zip') || cell(r, 'city'))}`;
    // In-file dedupe first (same parcel, or same owner + address),
    // then dedupe against the leads already in the office.
    if ((parcelKey && seenParcel.has(parcelKey)) || seenAddr.has(addrKey)) { dupes++; continue; }
    if (parcelKey) seenParcel.add(parcelKey);
    seenAddr.add(addrKey);
    const mailing = cell(r, 'mailing_address');
    // Absentee: the owner's mail goes somewhere other than the
    // property itself. Compared on the normalized street lines;
    // a missing mailing address is not a flag.
    const isAbsentee = !!mailing && normAddr(mailing) !== normAddr(address);
    if (isAbsentee) absentee++;
    const notes = tag ? `${stamp} · Distress: ${tag}` : stamp;
    toInsert.push({
      property_address: address,
      city: cell(r, 'city') || null,
      state: cell(r, 'state') || null,
      zip: cell(r, 'zip') || null,
      county: cell(r, 'county') || null,
      owner_name: owner || null,
      mailing_address: mailing || null,
      mailing_city: cell(r, 'mailing_city') || null,
      mailing_state: cell(r, 'mailing_state') || null,
      mailing_zip: cell(r, 'mailing_zip') || null,
      parcel_id: parcel || null,
      assessed_value: money(cell(r, 'assessed_value')),
      year_built: (() => { const y = parseInt(cell(r, 'year_built'), 10); return Number.isFinite(y) && y > 1600 && y < 2100 ? y : null; })(),
      status: 'new',
      list_source: `Distress import: ${sourceLabel.trim()}`.slice(0, 120),
      notes,
      consent_status: 'unknown',
      distress_tag: tag,
      is_absentee_owner: isAbsentee,
    } as unknown as Lead);
  }
  return { toInsert, dupes, noAddress, addressNeeded, absentee, tagged };
}

export default function CsvLeadImporter({ userId, onAdded }: { userId: string | null; onAdded?: () => void }) {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [fileTag, setFileTag] = useState<DistressTag | ''>('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  if (!userId) return null;

  function onFile(files: FileList | null) {
    const f = files && files[0];
    if (!f) return;
    setResult('');
    const applyParsed = (parsed: string[][]) => {
      if (parsed.length < 2) { setResult('That file has no data rows under its header row — nothing to import.'); return; }
      const hdrs = parsed[0].map((h) => h.trim());
      const data = parsed.slice(1, MAX_ROWS + 1);
      const m: Partial<Record<FieldKey, number>> = {};
      for (const field of FIELDS) {
        const idx = hdrs.findIndex((h) => field.aliases.indexOf(h.toLowerCase()) >= 0);
        if (idx >= 0) m[field.key] = idx;
      }
      setFileName(f.name);
      setHeaders(hdrs);
      setRows(data);
      setMapping(m);
      if (parsed.length - 1 > MAX_ROWS) {
        setResult(`This importer takes up to ${MAX_ROWS} rows at a time — the first ${MAX_ROWS} are loaded.`);
      }
    };
    // Excel (.xlsx/.xls) reads the FIRST sheet only and feeds the
    // SAME pipeline as CSV — header auto-mapping, dedupe, and the
    // tag logic are identical. Never invents columns or rows.
    if (isSpreadsheetFile(f.name)) {
      readSpreadsheetRows(f).then(applyParsed).catch((e) => {
        setResult(`Could not read that spreadsheet: ${e instanceof Error ? e.message : 'unknown error.'}`);
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      applyParsed(parseCsv(String(reader.result || '')));
    };
    reader.readAsText(f);
  }

  function cell(r: string[], key: FieldKey): string {
    const idx = mapping[key];
    if (idx === undefined || idx < 0) return '';
    return (r[idx] || '').trim();
  }

  async function runImport() {
    if (!sourceLabel.trim()) { setResult('Name the list source first — every imported lead carries where it came from (for example: "St. Lucie County lis pendens, Nov 2026").'); return; }
    if (mapping.property_address === undefined && mapping.case_number === undefined) { setResult('Map the Property address column, or the Case Number column for a case list without addresses — rows with neither an address nor a case number cannot become leads.'); return; }
    setBusy(true);
    setResult('');
    try {
      const existing = (await loadLeads(userId as string)) || [];
      const { toInsert, dupes, noAddress, addressNeeded, absentee, tagged } = buildDistressLeads({
        rows,
        mapping,
        fileTag,
        sourceLabel,
        fileName,
        existing,
      });
      let outcome = await importLeads(userId as string, toInsert, BATCH_SIZE);
      let columnsMissing = false;
      // The distress columns arrive with migration 20261115120000.
      // If the owner has not applied it yet, PostgREST rejects the
      // unknown columns — retry without them (the tag already rides
      // in each lead's notes) instead of failing the whole import.
      if (outcome.error && /distress_tag|is_absentee_owner/.test(outcome.error)) {
        columnsMissing = true;
        const stripped = toInsert.map((l) => {
          const copy = { ...l } as unknown as Record<string, unknown>;
          delete copy.distress_tag;
          delete copy.is_absentee_owner;
          return copy as unknown as Lead;
        });
        outcome = await importLeads(userId as string, stripped, BATCH_SIZE);
      }
      const inserted = outcome.inserted;
      setResult(`Import complete: ${inserted} lead${inserted === 1 ? '' : 's'} added` +
        `${tagged ? `, ${tagged} tagged with a distress signal` : ''}` +
        `${absentee ? `, ${absentee} flagged absentee-owner (mailing address differs from the property)` : ''}` +
        `${dupes ? `, ${dupes} duplicate${dupes === 1 ? '' : 's'} skipped (already in your pipeline or repeated in the file)` : ''}` +
        `${noAddress ? `, ${noAddress} row${noAddress === 1 ? '' : 's'} skipped (no address and no case number)` : ''}` +
        `${addressNeeded ? `, ${addressNeeded} flagged address needed (case number + parties only — next step: clerk case lookup → appraiser mailing address)` : ''}.` +
        `${columnsMissing ? ' Note: the Slice 123 migration (distress_tag / is_absentee_owner columns) has not been applied to the database yet, so the tags are stamped in each lead’s notes for now and will land in their own columns once it is applied.' : ''}` +
        `${outcome.error ? ` Some rows were rejected by the database: ${outcome.error}` : ''}`);
      if (inserted > 0 && onAdded) onAdded();
    } catch (e) {
      const m = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      setResult(`Import stopped: ${m || 'unknown error — check the file and try again.'}`);
    } finally {
      setBusy(false);
    }
  }

  const preview = rows.slice(0, 5);

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Distress-list importer — lis pendens, probate, tax lists</h2>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        Upload a CSV or Excel file you lawfully obtained from the county (lis pendens, probate, tax-delinquent,
        tax deed, code violations). A case list with no address column still imports — each row becomes a
        lead with its case number + parties, flagged &ldquo;address needed&rdquo; with the next step (clerk case
        lookup → appraiser mailing address); no address is ever invented. Pick the distress signal for the whole file — or map a tag column
        and let each row carry its own. Absentee owners are flagged automatically when the mailing
        address differs from the property address. Duplicates are skipped, the list source is
        stamped on every lead, and nothing is invented: phones and emails are never added by this
        importer — they come from the county record or your own skip trace, not from a list.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={(e) => onFile(e.target.files)} />
        <input style={{ flex: '1 1 260px' }} placeholder="List source — e.g. St. Lucie County lis pendens, Nov 2026" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
        <label style={{ fontSize: 13 }}>
          Distress signal for this file{' '}
          <select value={fileTag} onChange={(e) => setFileTag(e.target.value as DistressTag | '')}>
            <option value="">— no file tag (tag column only) —</option>
            {DISTRESS_TAGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>
      {headers.length > 0 && (
        <>
          <p style={{ fontSize: 13.5 }}>
            <strong>{fileName}</strong> — {rows.length} data rows. Match each lead field to a column in your file:
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FIELDS.map((f) => (
              <label key={f.key} style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {f.label}
                <select
                  value={mapping[f.key] === undefined ? -1 : mapping[f.key]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMapping((prev) => {
                      const next = { ...prev };
                      if (v < 0) delete next[f.key]; else next[f.key] = v;
                      return next;
                    });
                  }}
                >
                  <option value={-1}>— not in file —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          {preview.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ fontSize: 12.5, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingRight: 12 }}>Address</th>
                    <th style={{ textAlign: 'left', paddingRight: 12 }}>Owner</th>
                    <th style={{ textAlign: 'left', paddingRight: 12 }}>Parcel</th>
                    <th style={{ textAlign: 'left' }}>Mailing address</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td style={{ paddingRight: 12 }}>{cell(r, 'property_address') || '—'}</td>
                      <td style={{ paddingRight: 12 }}>{cell(r, 'owner_name') || '—'}</td>
                      <td style={{ paddingRight: 12 }}>{cell(r, 'parcel_id') || '—'}</td>
                      <td>{cell(r, 'mailing_address') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>Preview of the first {preview.length} rows with the mapping above. Rows whose mailing address differs from the property address import flagged absentee-owner; rows whose parcel ID or owner + address already sits in your pipeline are skipped as duplicates.</p>
            </div>
          )}
          <button style={{ marginTop: 10 }} disabled={busy} onClick={runImport}>
            {busy ? 'Importing…' : `Import ${rows.length} rows`}
          </button>
        </>
      )}
      {result && <p style={{ fontSize: 13.5 }}>{result}</p>}
    </section>
  );
}
