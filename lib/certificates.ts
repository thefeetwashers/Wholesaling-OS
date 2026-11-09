import { escHtml } from './letter-identity';

// Slice 100 — Closing Certificates (Uncopyable Set, part 3).
// A certificate is a printable record of ONE closing, composed
// only from rows the platform already counts: the escrow file
// (outcome closed, with its recorded outcome date), its deal
// (address from the deal documents, contract price, assignment
// fee, actual sale price). The certificate ID derives from the
// escrow file's own id, so the paper always points back at the
// exact counted record. Nothing here creates or estimates a
// figure; a missing fact prints as "not recorded", never filled.

export interface CertificateFacts {
  certId: string;
  address: string;
  cityState: string;
  closedOn: string | null;
  contractPrice: number | null;
  assignmentFee: number | null;
  actualSalePrice: number | null;
}

interface DealLike {
  contract_price?: number | null;
  assignment_fee?: number | null;
  actual_sale_price?: number | null;
  documents?: Record<string, unknown> | null;
}

interface FileLike {
  id?: string;
  outcome?: string;
  outcome_at?: string | null;
}

export function certificateFacts(file: FileLike, deal: DealLike | null): CertificateFacts | null {
  if (!file.id || file.outcome !== 'closed') return null;
  const doc = (deal && deal.documents) || {};
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
  const city = str(doc.city);
  const state = str(doc.state);
  return {
    certId: 'WS-' + file.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
    address: str(doc.property_address) || 'Address not recorded',
    cityState: [city, state].filter(Boolean).join(', '),
    closedOn: file.outcome_at ? String(file.outcome_at).slice(0, 10) : null,
    contractPrice: num(deal && deal.contract_price),
    assignmentFee: num(deal && deal.assignment_fee),
    actualSalePrice: num(deal && deal.actual_sale_price),
  };
}

export function money(n: number | null): string {
  return n == null ? 'not recorded' : '$' + Math.round(n).toLocaleString('en-US');
}

export function certificateHtml(f: CertificateFacts): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#475569">${label}</td><td style="padding:6px 0;font-weight:600">${value}</td></tr>`;
  return `
  <div style="border:3px double #065f46;padding:28px;max-width:640px;margin:0 auto">
    <div style="text-align:center">
      <div style="font-size:26px;font-weight:800;color:#065f46">🏆 Closing Certificate</div>
      <div style="font-size:13px;color:#475569;margin-top:4px">WholesalingOS — counted from platform records</div>
      <div style="font-size:15px;font-weight:700;margin-top:10px">Certificate ${escHtml(f.certId)}</div>
    </div>
    <table style="margin:20px auto 6px;font-size:15px;border-collapse:collapse">
      ${row('Property', escHtml(f.address) + (f.cityState ? ', ' + escHtml(f.cityState) : ''))}
      ${row('Closing recorded', f.closedOn || 'not recorded')}
      ${row('Contract price', money(f.contractPrice))}
      ${row('Assignment fee', money(f.assignmentFee))}
      ${row('Actual sale price', money(f.actualSalePrice))}
    </table>
    <p style="font-size:12.5px;color:#475569;line-height:1.6;margin-top:16px">
      This certificate records a closing the platform counted from its own escrow and deal records —
      the same records behind the wholesaler&rsquo;s public trust signal and the buyer&rsquo;s earned tier.
      It is a record of those entries, not a closing statement, title document, or legal instrument.
      Confirm certificate ${escHtml(f.certId)} with the issuing wholesaler, whose office holds the underlying file.
    </p>
  </div>`;
}
