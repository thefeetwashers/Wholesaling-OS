import { supabase, supabaseConfigured } from './supabase';
import { escHtml } from './letter-identity';
import type { ContactEntryRow } from './distress';
import type { Lead } from './leads';

// Slice 101 — the Consent Passport (Uncopyable Set, part 4).
// One contact's defense file, assembled from records the
// platform already keeps: the lead's consent fields (status,
// when, source — schema v4.1), the provenance-stamped contact
// entries (v4.4: every phone/email carries the source it came
// from), and the outreach log (every prepared/sent touch). The
// passport's most important output is its GAPS: a consent or a
// provenance that is not on record prints as missing, in the
// open — that absence is exactly what a wholesaler needs to see
// before they dial, and exactly what defends them if they can
// show it was present.

export interface TouchRow {
  channel: string;
  template: string | null;
  status: string;
  created_at: string;
}

export async function loadPassportTouches(userId: string, leadId: string): Promise<TouchRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('outreach')
    .select('channel, template, status, created_at')
    .eq('owner_id', userId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data || []) as TouchRow[];
}

export const CONSENT_WORDS: Record<string, string> = {
  express_consent: 'Express consent recorded',
  requested_contact: 'Contact requested by them',
  opted_out: 'Opted out — do not contact',
  unknown: 'No consent recorded',
};

export function consentWord(status?: string | null): string {
  return CONSENT_WORDS[status || 'unknown'] || 'No consent recorded';
}

export interface Passport {
  lead: Lead;
  entries: ContactEntryRow[];
  touches: TouchRow[];
  gaps: string[];
}

export function passportGaps(lead: Lead, entries: ContactEntryRow[]): string[] {
  const gaps: string[] = [];
  if (!lead.consent_status || lead.consent_status === 'unknown') {
    gaps.push('No consent on record — the sending gates treat this contact as not consented.');
  }
  if (entries.length === 0) {
    gaps.push('No contact entries on file — where this contact’s phone or email came from is not recorded.');
  }
  return gaps;
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function passportCsv(p: Passport): string {
  const l = p.lead;
  const lines: string[] = [];
  lines.push('Consent Passport — WholesalingOS');
  lines.push(['Property', [l.property_address, l.city, l.state, l.zip].filter(Boolean).join(', ')].map(csvCell).join(','));
  lines.push(['Lead source', l.list_source || ''].map(csvCell).join(','));
  lines.push(['Consent', consentWord(l.consent_status)].map(csvCell).join(','));
  lines.push(['Consent recorded at', l.consent_at || ''].map(csvCell).join(','));
  lines.push(['Consent source', l.consent_source || ''].map(csvCell).join(','));
  lines.push(['Do not contact', l.do_not_contact ? 'YES' : 'no'].map(csvCell).join(','));
  lines.push('');
  lines.push('Contact entries (provenance)');
  lines.push('kind,value,source,entered_on');
  for (const e of p.entries) lines.push([e.kind, e.value, e.source, e.entered_on].map(csvCell).join(','));
  lines.push('');
  lines.push('Logged touches');
  lines.push('when,channel,template,status');
  for (const t of p.touches) lines.push([t.created_at, t.channel, t.template || '', t.status].map(csvCell).join(','));
  lines.push('');
  lines.push('Gaps on this record');
  for (const g of p.gaps) lines.push(csvCell(g));
  if (p.gaps.length === 0) lines.push('None — consent and provenance are on record.');
  return lines.join('\n');
}

export function passportHtml(p: Passport): string {
  const l = p.lead;
  const addr = [l.property_address, l.city, l.state, l.zip].filter(Boolean).join(', ');
  const entryRows = p.entries.length
    ? p.entries.map((e) => `<tr><td style="padding:4px 10px 4px 0">${escHtml(e.kind)}</td><td style="padding:4px 10px 4px 0">${escHtml(e.value)}</td><td style="padding:4px 10px 4px 0">${escHtml(e.source)}</td><td style="padding:4px 0">${escHtml(e.entered_on)}</td></tr>`).join('')
    : '<tr><td colspan="4" style="padding:4px 0">No contact entries on file.</td></tr>';
  const touchRows = p.touches.length
    ? p.touches.map((t) => `<tr><td style="padding:4px 10px 4px 0">${escHtml(String(t.created_at).slice(0, 10))}</td><td style="padding:4px 10px 4px 0">${escHtml(t.channel)}</td><td style="padding:4px 10px 4px 0">${escHtml(t.template || '')}</td><td style="padding:4px 0">${escHtml(t.status)}</td></tr>`).join('')
    : '<tr><td colspan="4" style="padding:4px 0">No touches logged.</td></tr>';
  const gaps = p.gaps.length
    ? p.gaps.map((g) => `<li>${escHtml(g)}</li>`).join('')
    : '<li>None — consent and provenance are on record.</li>';
  return `
  <div style="max-width:680px;margin:0 auto;font-size:14px;line-height:1.55">
    <div style="font-size:22px;font-weight:800">🛂 Consent Passport</div>
    <p style="color:#475569">Assembled from the platform&rsquo;s own records for this contact — the provenance and consent
    trail behind every call, text, email, and letter. Keep it with the deal file.</p>
    <table style="border-collapse:collapse;margin:10px 0">
      <tr><td style="padding:4px 12px 4px 0;color:#475569">Property</td><td style="font-weight:600">${escHtml(addr || 'Address not recorded')}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#475569">Lead source</td><td>${escHtml(l.list_source || 'not recorded')}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#475569">Consent</td><td style="font-weight:600">${escHtml(consentWord(l.consent_status))}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#475569">Consent recorded</td><td>${escHtml(l.consent_at ? String(l.consent_at).slice(0, 10) : 'not recorded')}${l.consent_source ? ' · via ' + escHtml(l.consent_source) : ''}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#475569">Do not contact</td><td>${l.do_not_contact ? '<strong>YES — do not contact</strong>' : 'No'}</td></tr>
    </table>
    <div style="font-weight:700;margin-top:12px">Contact entries — where each came from</div>
    <table style="border-collapse:collapse">${entryRows}</table>
    <div style="font-weight:700;margin-top:12px">Logged touches</div>
    <table style="border-collapse:collapse">${touchRows}</table>
    <div style="font-weight:700;margin-top:12px">Gaps on this record</div>
    <ul style="margin:4px 0;padding-left:18px">${gaps}</ul>
    <p style="font-size:12px;color:#475569">Generated by WholesalingOS from the account&rsquo;s own sealed records. A passport shows what is
    recorded; it does not create consent where none exists.</p>
  </div>`;
}
