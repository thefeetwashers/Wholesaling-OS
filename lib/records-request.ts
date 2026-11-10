// Slice 107 — Records Request Desk library. The lawful channel for
// the distress categories that have no feed anywhere (probate, lis
// pendens, most code cases, delinquent tax): a public-records
// request. Every state has a public records law; the wholesaler
// asks the office that holds the list, the office answers, and the
// list comes back to the wholesaler — who imports it through the
// Import Inbox with a provenance stamp. The platform drafts the
// letter and keeps the log; it sends nothing, scrapes nothing, and
// stores the log on this device only (localStorage, the same
// pattern as the letter identity and the repair estimator).

import type { LetterIdentity } from './letter-identity';

export interface RequestTypeInfo {
  key: string;
  label: string;
  officeRole: string;
  asksFor: (county: string, period: string) => string;
  cadence: string;
  note: string;
  stampHint: string;
}

export const REQUEST_TYPES: RequestTypeInfo[] = [
  {
    key: 'probate',
    label: 'Probate — newly opened estates',
    officeRole: 'Clerk of Court — Probate Division',
    asksFor: (county, period) =>
      `a list of all probate cases opened in ${county} County during ${period}, including the case number, the decedent's name, the date the case was opened, and the property address or parcel identification number where the file states it`,
    cadence: 'Monthly',
    note: 'Probate opens at the clerk of court, and no feed exists for it anywhere. Some clerks answer a request like this by pointing to their online case index instead of sending a list — that is still a win: pull the new cases from the index by hand and import them with the same stamp.',
    stampHint: 'Public records request — probate',
  },
  {
    key: 'lis_pendens',
    label: 'Lis pendens — foreclosure filings (pre-foreclosure)',
    officeRole: 'Clerk of Court — Official Records',
    asksFor: (county, period) =>
      `a list of all lis pendens recorded in ${county} County during ${period}, including the recording date, case number, plaintiff and defendant names, and the property address or parcel identification number where the recorded document states it`,
    cadence: 'Monthly',
    note: 'A lis pendens is the recorded notice that a foreclosure suit has been filed — the earliest public pre-foreclosure signal there is. It is a public record at the clerk, not a data product; anyone selling a national lis pendens feed is scraping court sites or reselling a licensed database.',
    stampHint: 'Public records request — lis pendens',
  },
  {
    key: 'code',
    label: 'Code enforcement — open cases',
    officeRole: 'Code Enforcement Office',
    asksFor: (county, period) =>
      `a list of all open code enforcement cases in ${county} County (or in the city your office serves) as of today, including the case number, property address, violation type or description, date the case was opened, and current status. If your office tracks only cases opened during ${period}, that list is equally helpful`,
    cadence: 'Monthly',
    note: 'Check first whether this area is already covered: some cities publish their cases on an open-data portal, and the ones the platform has cleared are being built into the State Records panel and Deal Radar. Ask by request only where no cleared portal exists — and where code enforcement is a CITY office, address the request to the city, not the county.',
    stampHint: 'Public records request — code enforcement',
  },
  {
    key: 'fire',
    label: 'Fire incidents — fire-damaged houses',
    officeRole: 'Fire Department / Fire Marshal — Records',
    asksFor: (county, period) =>
      `a list of residential structure-fire incidents in ${county} County during ${period}, including the incident date, the property address, and the extent of damage where the incident report states it`,
    cadence: 'Monthly',
    note: 'A house that burned is a house that often sells as-is, and the incident report is a public record in most places — but these owners just lived through a fire. Mail only, never a cold call, and let some time pass; the platform’s School lesson on fire-damaged houses covers how to approach the conversation. Some departments answer by pointing to their incident log instead of sending a list — pull it by hand and import with the same stamp.',
    stampHint: 'Public records request — fire incidents',
  },
  {
    key: 'tax',
    label: 'Delinquent tax / tax certificate list',
    officeRole: 'Tax Collector',
    asksFor: (county) =>
      `the current delinquent real estate tax list for ${county} County — the list prepared for the annual tax certificate sale, or its current equivalent — including the parcel identification number, the owner of record, the property address, and the amount due where the list states it`,
    cadence: 'Twice a year — before the certificate sale, and mid-year',
    note: 'Many tax collectors publish this list on their own site ahead of the certificate sale — check your county doors above before sending. Where it is not published, it is still a public record and the collector answers requests for it.',
    stampHint: 'Public records request — delinquent tax',
  },
];

export function requestType(key: string): RequestTypeInfo {
  return REQUEST_TYPES.filter((t) => t.key === key)[0] || REQUEST_TYPES[0];
}

// The states whose public-records citations are stated here were
// checked against the statutes themselves. Any other state falls
// back to a generic — and accurate — reference to its public
// records law rather than an invented citation.
const STATE_LAW: Record<string, string> = {
  FL: 'Chapter 119, Florida Statutes (the Florida Public Records Act)',
  TX: 'the Texas Public Information Act (Texas Government Code, Chapter 552)',
  CA: 'the California Public Records Act (California Government Code, section 7920 et seq.)',
  NY: 'the New York Freedom of Information Law (Public Officers Law, sections 84-90)',
  GA: 'the Georgia Open Records Act (O.C.G.A. section 50-18-70 et seq.)',
  NC: 'the North Carolina Public Records Law (N.C. General Statutes, Chapter 132)',
  OH: 'the Ohio Public Records Act (Ohio Revised Code, section 149.43)',
  PA: 'the Pennsylvania Right-to-Know Law (65 P.S. section 67.101 et seq.)',
  IL: 'the Illinois Freedom of Information Act (5 ILCS 140)',
  WA: 'the Washington Public Records Act (RCW 42.56)',
  AZ: 'the Arizona Public Records Law (A.R.S. section 39-121 et seq.)',
  CO: 'the Colorado Open Records Act (C.R.S. section 24-72-201 et seq.)',
  VA: 'the Virginia Freedom of Information Act (Virginia Code, section 2.2-3700 et seq.)',
};

export function lawFor(stateCode: string, stateName: string): string {
  return STATE_LAW[stateCode] || `the public records law of the State of ${stateName}`;
}

export interface LetterArgs {
  identity: LetterIdentity;
  type: RequestTypeInfo;
  county: string;
  stateCode: string;
  stateName: string;
  period: string;
  feeCap: string;
  officeName: string;
}

export function buildRequestLetter(a: LetterArgs): { subject: string; body: string } {
  const id = a.identity;
  const you = id.you || '[Your name]';
  const biz = id.biz ? ` of ${id.biz}` : '';
  const contact = [id.phone, id.email].filter(Boolean).join(' · ') || '[Your phone · your email]';
  const replyTo = id.email || '[your email]';
  const subject = `Public records request — ${a.type.label.split(' — ')[0]} list, ${a.county} County, ${a.stateCode}`;
  const body = [
    `Dear ${a.officeName || a.type.officeRole}:`,
    '',
    `I am writing to request public records under ${lawFor(a.stateCode, a.stateName)}.`,
    '',
    `Please provide ${a.type.asksFor(a.county, a.period)}.`,
    '',
    `If these records are available in electronic form (a spreadsheet, CSV, or PDF), I ask for them in that form, sent to ${replyTo}. If any portion is exempt or must be redacted, please provide the remainder and cite the specific exemption relied on for anything withheld.`,
    '',
    `If the fees for searching, reviewing, and duplicating will exceed $${a.feeCap || '25'}, please contact me with an estimate before proceeding; otherwise I agree to pay the reasonable fees authorized by law.`,
    '',
    `I am a real estate wholesaler, and I use lists like this to contact property owners about selling. I can be reached at ${contact}.`,
    '',
    'Thank you for your time and for the work your office does.',
    '',
    'Sincerely,',
    `${you}${biz}`,
  ].join('\n');
  return { subject, body };
}

// --- the log (this device only) -------------------------------------------

export interface RequestLogEntry {
  id: string;
  at: string; // ISO date
  state: string;
  county: string;
  type: string;
  office: string;
  status: 'drafted' | 'sent' | 'received';
}

const LOG_KEY = 'ws_records_requests_v1';

export function loadRequestLog(): RequestLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as RequestLogEntry[];
      if (Array.isArray(arr)) return arr;
    }
  } catch { /* ignore */ }
  return [];
}

export function saveRequestLog(entries: RequestLogEntry[]): void {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(entries)); } catch { /* ignore */ }
}

export function newLogId(): string {
  return `rr-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function importStamp(e: RequestLogEntry): string {
  return `${requestType(e.type).stampHint} — ${e.county} County, ${e.state} (${e.at.slice(0, 10)})`;
}
