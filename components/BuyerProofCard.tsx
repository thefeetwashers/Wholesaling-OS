'use client';

import { useEffect, useState } from 'react';
import { loadBuyerRecord, loadMyProofOfFunds, type BuyerRecord } from '../lib/portals';
import { buyerTier, completionRatePct } from '../lib/buyer-tiers';
import { escHtml, openPrintWindow } from '../lib/letter-identity';

// Slice 87 — the buyer's Proof Card (buyer portal). Everything on
// it is either counted by the database from real platform events
// (accepted offers, B-C signings, escrow outcomes wholesalers
// marked) or labeled for exactly what it is: proof of funds is
// the buyer's own attestation and prints as SELF-REPORTED. The
// card is the buyer's to print and hand to a wholesaler or lender
// — the numbers cannot be edited, bought, or inflated here.

const ZERO_RECORD: BuyerRecord = { accepted_deals: 0, bc_signed: 0, closed_deals: 0, fell_through: 0, pof_status: 'none' };

export default function BuyerProofCard({ userId, userEmail }: { userId: string; userEmail?: string }) {
  const [record, setRecord] = useState<BuyerRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pof, setPof] = useState<{ status: string; note: string } | null>(null);

  useEffect(() => {
    let live = true;
    // A buyer with no platform events yet has a true record of
    // zeros — the RPC may return no row for them, which this card
    // renders as the zero record it is, never as a blank.
    loadBuyerRecord(userId)
      .then((r) => { if (live) { setRecord(r ?? ZERO_RECORD); setLoaded(true); } })
      .catch(() => { if (live) { setRecord(ZERO_RECORD); setLoaded(true); } });
    loadMyProofOfFunds(userId).then((p) => { if (live) setPof(p); }).catch(() => { if (live) setPof({ status: 'none', note: '' }); });
    return () => { live = false; };
  }, [userId]);

  if (!loaded || !record || !pof) return null;

  const tier = buyerTier(record);
  const completion = completionRatePct(record);
  const pofLine = pof.status === 'none' ? 'Not provided' : pof.status;
  const today = new Date().toLocaleDateString('en-US');

  const print = () => {
    const rows = [
      ['Accepted offers', record.accepted_deals],
      ['B–C contracts signed', record.bc_signed],
      ['Deals closed (counted)', record.closed_deals],
      ['Deals that fell through', record.fell_through],
      ...(completion !== null ? [['Completion rate', `${completion}%`]] : []),
    ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0">${escHtml(String(k))}</td><td><strong>${escHtml(String(v))}</strong></td></tr>`).join('');
    openPrintWindow('Buyer proof card', `
      <div style="font-family: Georgia, serif; max-width: 640px; margin: 24px auto; color: #111">
        <h1 style="font-size: 22px">Buyer Proof Card — WholesalingOS</h1>
        <p>Buyer: ${escHtml(userEmail || 'Signed-in buyer')} · Printed ${escHtml(today)}</p>
        <p><strong>${escHtml(tier.label)}</strong></p>
        <table style="border-collapse: collapse; font-size: 15px">${rows}</table>
        <p>Proof of funds: <strong>${escHtml(pofLine)}</strong> (self-reported by the buyer${pof.note ? ` — ${escHtml(pof.note)}` : ''})</p>
        <p style="font-size: 13px">The record above is counted by the platform from closing records — accepted offers,
        signed B–C contracts, and escrow outcomes. It is not claimed by the buyer and cannot be bought.
        Proof of funds is the buyer's own statement and is labeled self-reported. Verify current figures
        in the buyer's WholesalingOS portal.</p>
      </div>`);
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 24 }}>
      <h2>🏅 Your proof card</h2>
      <p style={{ fontSize: 14.5 }}><strong>{tier.label}</strong></p>
      <p style={{ fontSize: 13.5, color: '#cbd5e1' }}>
        Accepted offers: {record.accepted_deals} · B–C signed: {record.bc_signed} ·{' '}
        Closed (counted): {record.closed_deals} · Fell through: {record.fell_through}
        {completion !== null ? ` · Completion rate: ${completion}%` : ''}
      </p>
      <p style={{ fontSize: 13.5, color: '#cbd5e1' }}>
        Proof of funds: <strong>{pofLine}</strong> — self-reported{pof.note ? ` · ${pof.note}` : ''}
      </p>
      <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
        Counted by the platform from closing records — not claimed, not bought. Print the card to hand
        to a wholesaler or lender; the figures on paper match this screen because both come from the
        same counted record.
      </p>
      <button type="button" onClick={print} style={{ cursor: 'pointer' }}>Print my proof card</button>
    </section>
  );
}
