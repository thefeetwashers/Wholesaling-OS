'use client';

import { useState } from 'react';
import { importLeads, loadLeads, type Lead } from '../lib/leads';
import { checkPhone } from '../lib/phone';

// Slice 30 — import inbox, built to the feed-schema contract
// (production/feed-schema.md). The wholesaler uploads a CSV they
// lawfully obtained (a county list, their own spreadsheet), names the
// list source, maps the file's headers to lead fields with a preview,
// and imports. Provenance is stamped on every row (file name, source
// label, date); duplicates against their existing leads and inside the
// file are skipped and reported; rows without an address are skipped
// and reported. Feed-only fields the leads table has no column for
// (parcel, assessed value, opening bid, auction date) are recognized
// and written into the lead's notes — visible, never silently dropped.
// Phones/emails are imported ONLY when the file itself contains them
// and the wholesaler maps those columns. Consent starts 'unknown'.

type FieldKey = 'property_address' | 'city' | 'state' | 'zip' | 'county' | 'owner_name'
  | 'mailing_address' | 'phones' | 'emails' | 'parcel_id' | 'assessed_value' | 'opening_bid' | 'auction_date';

const FIELDS: { key: FieldKey; label: string; aliases: string[] }[] = [
  { key: 'property_address', label: 'Property address *', aliases: ['property_address', 'property address', 'address', 'street address', 'street', 'situs address', 'property'] },
  { key: 'city', label: 'City', aliases: ['city'] },
  { key: 'state', label: 'State', aliases: ['state', 'st'] },
  { key: 'zip', label: 'ZIP', aliases: ['zip', 'zipcode', 'zip code', 'postal'] },
  { key: 'county', label: 'County', aliases: ['county'] },
  { key: 'owner_name', label: 'Owner name', aliases: ['owner_name', 'owner name', 'owner', 'name', 'owner 1'] },
  { key: 'mailing_address', label: 'Mailing address', aliases: ['mailing_address', 'mailing address', 'mailing', 'owner address'] },
  { key: 'phones', label: 'Phone (only if the file has it)', aliases: ['phone', 'phones', 'phone number', 'mobile', 'cell', 'telephone'] },
  { key: 'emails', label: 'Email (only if the file has it)', aliases: ['email', 'emails', 'email address'] },
  { key: 'parcel_id', label: 'Parcel / APN (saved to notes)', aliases: ['parcel', 'parcel_id', 'parcel id', 'apn', 'folio', 'account'] },
  { key: 'assessed_value', label: 'Assessed value (saved to notes)', aliases: ['assessed', 'assessed value', 'assessed_value', 'market value', 'just value'] },
  { key: 'opening_bid', label: 'Opening bid / amount owed (saved to notes)', aliases: ['opening bid', 'opening_bid', 'bid', 'amount owed', 'total owed', 'liability', 'judgment'] },
  { key: 'auction_date', label: 'Auction / sale date (saved to notes)', aliases: ['auction', 'auction date', 'sale date', 'auction_date', 'sale_date'] },
];

const MAX_ROWS = 1000;

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

export default function ImportInbox({ userId, onAdded }: { userId: string | null; onAdded?: () => void }) {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [sourceLabel, setSourceLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  if (!userId) return null;

  function onFile(files: FileList | null) {
    const f = files && files[0];
    if (!f) return;
    setResult('');
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result || ''));
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
        setResult(`This inbox takes up to ${MAX_ROWS} rows at a time — the first ${MAX_ROWS} are loaded.`);
      }
    };
    reader.readAsText(f);
  }

  function cell(r: string[], key: FieldKey): string {
    const idx = mapping[key];
    if (idx === undefined || idx < 0) return '';
    return (r[idx] || '').trim();
  }

  async function runImport() {
    if (!sourceLabel.trim()) { setResult('Name the list source first — every imported lead carries where it came from (for example: "St. Lucie County tax list, Oct 2026").'); return; }
    if (mapping.property_address === undefined) { setResult('Map the Property address column before importing — rows without an address cannot become leads.'); return; }
    setBusy(true);
    setResult('');
    try {
      const existing = (await loadLeads(userId as string)) || [];
      const seen = new Set<string>();
      for (const l of existing) seen.add(`${normAddr(l.property_address)}|${normAddr(l.zip || l.city || '')}`);
      const today = new Date().toISOString().slice(0, 10);
      const stamp = `Imported ${today} from "${fileName}" — source: ${sourceLabel.trim()}`;
      const toInsert: Lead[] = [];
      let dupes = 0;
      let noAddress = 0;
      let badPhones = 0;
      for (const r of rows) {
        const address = cell(r, 'property_address');
        if (!address) { noAddress++; continue; }
        const key = `${normAddr(address)}|${normAddr(cell(r, 'zip') || cell(r, 'city'))}`;
        if (seen.has(key)) { dupes++; continue; }
        seen.add(key);
        const extra: string[] = [];
        const parcel = cell(r, 'parcel_id'); if (parcel) extra.push(`Parcel: ${parcel}`);
        const assessed = cell(r, 'assessed_value'); if (assessed) extra.push(`Assessed: ${assessed}`);
        const bid = cell(r, 'opening_bid'); if (bid) extra.push(`Opening bid / owed: ${bid}`);
        const auction = cell(r, 'auction_date'); if (auction) extra.push(`Auction: ${auction}`);
        const phone = cell(r, 'phones');
        const email = cell(r, 'emails');
        // Slice 32 — format-check a phone the file itself contains:
        // valid numbers are stored in standard +1 (E.164) form;
        // numbers that fail are kept exactly as entered and counted.
        // A format check cannot say whether a line is active or whose
        // it is — and the result message below says so.
        let phoneOut: string[] = [];
        if (phone) {
          const c = checkPhone(phone);
          if (c.valid && c.e164) phoneOut = [c.e164];
          else { phoneOut = [phone]; badPhones++; }
        }
        // Uniform key set on EVERY row: PostgREST bulk inserts reject
        // payloads whose objects carry different keys (first failure).
        // But explicit null is wrong for the array columns: leads.phones
        // and leads.emails are NOT NULL with a '[]' default, so an
        // explicit null violates the constraint (second failure, caught
        // once the real error message was surfaced). Empty array it is.
        toInsert.push({
          property_address: address,
          city: cell(r, 'city') || null,
          state: cell(r, 'state') || null,
          zip: cell(r, 'zip') || null,
          county: cell(r, 'county') || null,
          owner_name: cell(r, 'owner_name') || null,
          mailing_address: cell(r, 'mailing_address') || null,
          phones: phoneOut,
          emails: email ? [email] : [],
          status: 'new',
          list_source: `Import: ${sourceLabel.trim()}`.slice(0, 120),
          notes: extra.length ? `${stamp} · ${extra.join(' · ')}` : stamp,
          consent_status: 'unknown',
        } as unknown as Lead);
      }
      const outcome = await importLeads(userId as string, toInsert);
      const inserted = outcome.inserted;
      setResult(`Import complete: ${inserted} lead${inserted === 1 ? '' : 's'} added` +
        `${dupes ? `, ${dupes} duplicate${dupes === 1 ? '' : 's'} skipped (already in your pipeline or repeated in the file)` : ''}` +
        `${noAddress ? `, ${noAddress} row${noAddress === 1 ? '' : 's'} skipped (no address)` : ''}` +
        `${badPhones ? `. ${badPhones} phone number${badPhones === 1 ? '' : 's'} failed the format check and ${badPhones === 1 ? 'was' : 'were'} kept exactly as entered — a format check only; it cannot confirm a line is active or who owns it` : ''}. Every added lead is stamped with this file and source.` +
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
      <h2>Import inbox — bring a list in</h2>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        Upload a CSV you lawfully obtained (a county list, your own spreadsheet). Map its columns, preview,
        and import — duplicates are skipped, the list source is stamped on every lead, and nothing is
        invented: phones and emails import only when the file itself contains them. Phone numbers are
        format-checked on the way in: valid US numbers are stored in standard +1 form, and numbers that
        fail the format check are kept as entered and counted in the result.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files)} />
        <input style={{ flex: '1 1 260px' }} placeholder="List source — e.g. St. Lucie County tax list, Oct 2026" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
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
                    <th style={{ textAlign: 'left', paddingRight: 12 }}>City</th>
                    <th style={{ textAlign: 'left', paddingRight: 12 }}>Owner</th>
                    <th style={{ textAlign: 'left' }}>Phone / Email in file</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td style={{ paddingRight: 12 }}>{cell(r, 'property_address') || '—'}</td>
                      <td style={{ paddingRight: 12 }}>{cell(r, 'city') || '—'}</td>
                      <td style={{ paddingRight: 12 }}>{cell(r, 'owner_name') || '—'}</td>
                      <td>{cell(r, 'phones') || cell(r, 'emails') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>Preview of the first {preview.length} rows with the mapping above. Columns that map to no lead field are not stored, except parcel / assessed / bid / auction, which are saved into the lead's notes.</p>
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
