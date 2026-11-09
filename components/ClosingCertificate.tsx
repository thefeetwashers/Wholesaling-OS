'use client';

import { certificateFacts, money, certificateHtml } from '../lib/certificates';
import { openPrintWindow } from '../lib/letter-identity';
import type { EscrowFileRow } from '../lib/escrow';
import type { DealRow } from '../lib/deals';

// Slice 100 — the per-file Closing Certificate. Renders ONLY on
// a closed escrow file (the same honest gating as the autopsy
// and reviews): the certificate is composed from the file and
// its deal, and prints through the house print window. No
// certificate exists for a deal the platform has not counted
// as closed — that is the point of it.

export default function ClosingCertificate({ file, deal }: { file: EscrowFileRow; deal: DealRow | null }) {
  const facts = certificateFacts(file, deal);
  if (!facts) return null;
  return (
    <div style={{ marginTop: 10, background: 'rgba(6,95,70,0.12)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>🏆 Closing Certificate {facts.certId}</div>
      <p style={{ fontSize: 12.5, color: '#cbd5e1', margin: '4px 0' }}>
        {facts.address}{facts.cityState ? ', ' + facts.cityState : ''} · closing recorded {facts.closedOn || 'date not recorded'} ·
        contract {money(facts.contractPrice)} · fee {money(facts.assignmentFee)} · sold {money(facts.actualSalePrice)}.
        Composed from the counted records themselves — print it for the file, the buyer, or the seller.
      </p>
      <button onClick={() => openPrintWindow('Closing Certificate ' + facts.certId, certificateHtml(facts))}>Print certificate</button>
    </div>
  );
}
