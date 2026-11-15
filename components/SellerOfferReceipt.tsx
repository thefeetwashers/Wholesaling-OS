'use client';

import type { OfferReceipt } from '../lib/tracker';
import type { StorefrontDict } from '../lib/storefront-i18n';

// Slice 125 — the Offer Receipt. The seller sees exactly how
// their offer was built, from numbers the wholesaler actually
// entered (their own comps, repair estimate, resale costs) or
// the county roll returned. A piece the wholesaler left blank
// reads "not provided" — it is never invented, and no figure is
// computed for the wholesaler. The receipt shows only when an
// offer amount exists.

const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

export default function SellerOfferReceipt({
  receipt,
  t,
}: {
  receipt: OfferReceipt;
  t: StorefrontDict;
}) {
  const lineFor = (label: string, value: string | null) => (
    <p key={label} style={{ fontSize: 14, margin: '6px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{label}</span>
      <strong>{value ?? t.receiptNotProvided}</strong>
    </p>
  );
  const comps = receipt.lines.find((l) => l.label === 'comps')?.value ?? null;
  const repairs = receipt.lines.find((l) => l.label === 'repairs')?.value ?? null;
  const resale = receipt.lines.find((l) => l.label === 'resale')?.value ?? null;
  return (
    <section style={{ background: '#16213a', padding: 20, borderRadius: 12, marginBottom: 16 }}>
      <h2>{t.receiptTitle}</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>{t.receiptIntro}</p>
      <p style={{ fontSize: 20, fontWeight: 800, margin: '8px 0' }}>
        {t.receiptOffer}: {money(receipt.amount)}
      </p>
      {lineFor(t.receiptComps, comps)}
      {lineFor(t.receiptRepairs, repairs)}
      {lineFor(t.receiptResale, resale)}
      {receipt.askingPrice != null && lineFor(t.receiptAsking, money(receipt.askingPrice))}
      {receipt.note && (
        <p style={{ fontSize: 14, margin: '10px 0 0' }}>
          <strong>{t.receiptNote}:</strong> {receipt.note}
        </p>
      )}
    </section>
  );
}
