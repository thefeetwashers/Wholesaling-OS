'use client';

import { useState } from 'react';
import { analyzeRental, type RentalInputs } from '../lib/rental';

// Slice 37 — rental & DSCR analyzer. A wholesaler's buyers are
// landlords and funds who underwrite cash flow, not just MAO. Every
// input is typed by the wholesaler; the panel computes NOI, cap rate,
// cash flow, cash-on-cash, and DSCR (the number a DSCR lender
// underwrites to) from those numbers only. Nothing is estimated,
// pulled, or prefilled by the platform.

const FIELDS: { key: keyof RentalInputs; label: string; step?: string }[] = [
  { key: 'purchasePrice', label: 'Purchase price ($)' },
  { key: 'monthlyRent', label: 'Monthly rent ($)' },
  { key: 'taxesYearly', label: 'Property taxes ($/yr)' },
  { key: 'insuranceYearly', label: 'Insurance ($/yr)' },
  { key: 'hoaMonthly', label: 'HOA ($/mo)' },
  { key: 'vacancyPct', label: 'Vacancy (%)', step: '0.5' },
  { key: 'maintenancePct', label: 'Maintenance (% of rent)', step: '0.5' },
  { key: 'managementPct', label: 'Management (% of rent)', step: '0.5' },
  { key: 'downPaymentPct', label: 'Down payment (%)', step: '1' },
  { key: 'interestRatePct', label: 'Loan rate (%/yr)', step: '0.125' },
  { key: 'termYears', label: 'Loan term (years)', step: '1' },
];

const START: RentalInputs = {
  purchasePrice: 0, monthlyRent: 0, taxesYearly: 0, insuranceYearly: 0,
  hoaMonthly: 0, vacancyPct: 5, maintenancePct: 5, managementPct: 0,
  downPaymentPct: 20, interestRatePct: 7, termYears: 30,
};

function money(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function money2(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)}%`;
}
function ratio(v: number | null): string {
  return v === null ? '—' : v.toFixed(2);
}

export default function RentalAnalyzer() {
  const [inp, setInp] = useState<RentalInputs>(START);
  const r = analyzeRental(inp);
  const ready = inp.purchasePrice > 0 && inp.monthlyRent > 0;

  return (
    <section style={{ background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h2>Rental &amp; DSCR analyzer — for buy-and-hold buyers</h2>
      <p style={{ fontSize: 13.5, marginTop: 0 }}>
        Your landlord and fund buyers underwrite cash flow, not just MAO. Type the deal's real numbers —
        every result below is computed from your numbers only; the platform supplies no rents, rates, or
        estimates. DSCR is the ratio a DSCR lender underwrites to (NOI ÷ yearly debt service; many lenders
        want 1.20 or better — that's their rule, shown here so you can speak their language).
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FIELDS.map((f) => (
          <label key={f.key} style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {f.label}
            <input
              type="number"
              min="0"
              step={f.step || '1'}
              style={{ width: 150 }}
              value={inp[f.key] || ''}
              onChange={(e) => setInp((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>
      {ready ? (
        <div style={{ fontSize: 13.5, marginTop: 12, display: 'grid', gap: 4 }}>
          <span>Loan: <strong>{money(r.loanAmount)}</strong> (down {money(r.downPayment)}) · Mortgage P&amp;I: <strong>{money2(r.monthlyPI)}/mo</strong></span>
          <span>Effective rent after vacancy: <strong>{money(r.effectiveRent)}/yr</strong> · Operating expenses: <strong>{money(r.operatingExpenses)}/yr</strong></span>
          <span>NOI: <strong>{money(r.noi)}/yr</strong> · Cap rate: <strong>{pct(r.capRatePct)}</strong> · Gross rent multiplier: <strong>{ratio(r.grossRentMultiplier)}</strong> · 1% rule: <strong>{pct(r.onePctRulePct)}</strong></span>
          <span>Cash flow: <strong>{money2(r.monthlyCashFlow)}/mo</strong> ({money(r.yearlyCashFlow)}/yr) · Cash-on-cash: <strong>{pct(r.cashOnCashPct)}</strong></span>
          <span>DSCR: <strong>{ratio(r.dscr)}</strong>{r.dscr !== null && (r.dscr >= 1.2 ? ' — at or above the common 1.20 lender threshold' : ' — below the common 1.20 lender threshold')}</span>
        </div>
      ) : (
        <p style={{ fontSize: 13.5 }}>Enter at least a purchase price and a monthly rent to see the analysis.</p>
      )}
    </section>
  );
}
