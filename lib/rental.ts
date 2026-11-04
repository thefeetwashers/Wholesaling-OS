// Slice 37 — rental & DSCR math for buy-and-hold buyers. Pure
// arithmetic on numbers the WHOLESALER types in — the platform
// supplies no rents, no rates, and no estimates of its own. Every
// output is labeled "from your numbers" in the UI, and any result
// whose inputs are missing comes back null (rendered as a blank),
// never a dressed-up guess.

export interface RentalInputs {
  purchasePrice: number;
  monthlyRent: number;
  taxesYearly: number;
  insuranceYearly: number;
  hoaMonthly: number;
  vacancyPct: number;      // % of gross rent, e.g. 5
  maintenancePct: number;  // % of gross rent
  managementPct: number;   // % of gross rent
  downPaymentPct: number;  // % of price, e.g. 20
  interestRatePct: number; // annual, e.g. 7
  termYears: number;       // e.g. 30
}

export interface RentalResults {
  loanAmount: number;
  downPayment: number;
  monthlyPI: number;          // principal + interest only
  grossYearlyRent: number;
  effectiveRent: number;      // after vacancy
  operatingExpenses: number;  // taxes + insurance + HOA + maintenance + management (no debt)
  noi: number;                // yearly, before debt service
  capRatePct: number | null;
  grossRentMultiplier: number | null;
  onePctRulePct: number;      // monthly rent / price, as %
  monthlyCashFlow: number;
  yearlyCashFlow: number;
  cashOnCashPct: number | null;
  dscr: number | null;        // NOI / yearly debt service; null when no loan
}

function n(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function analyzeRental(inp: RentalInputs): RentalResults {
  const price = n(inp.purchasePrice);
  const rent = n(inp.monthlyRent);
  const grossYearlyRent = rent * 12;
  const vacancyLoss = grossYearlyRent * (n(inp.vacancyPct) / 100);
  const effectiveRent = grossYearlyRent - vacancyLoss;
  const maintenance = grossYearlyRent * (n(inp.maintenancePct) / 100);
  const management = grossYearlyRent * (n(inp.managementPct) / 100);
  const operatingExpenses =
    n(inp.taxesYearly) + n(inp.insuranceYearly) + n(inp.hoaMonthly) * 12 + maintenance + management;
  const noi = effectiveRent - operatingExpenses;

  const downPayment = price * (n(inp.downPaymentPct) / 100);
  const loanAmount = Math.max(0, price - downPayment);
  const r = n(inp.interestRatePct) / 100 / 12;
  const payments = Math.round(n(inp.termYears) * 12);
  let monthlyPI = 0;
  if (loanAmount > 0 && payments > 0) {
    monthlyPI = r > 0
      ? (loanAmount * r) / (1 - Math.pow(1 + r, -payments))
      : loanAmount / payments;
  }
  const yearlyDebtService = monthlyPI * 12;
  const yearlyCashFlow = noi - yearlyDebtService;

  return {
    loanAmount,
    downPayment,
    monthlyPI,
    grossYearlyRent,
    effectiveRent,
    operatingExpenses,
    noi,
    capRatePct: price > 0 ? (noi / price) * 100 : null,
    grossRentMultiplier: grossYearlyRent > 0 ? price / grossYearlyRent : null,
    onePctRulePct: price > 0 ? (rent / price) * 100 : 0,
    monthlyCashFlow: yearlyCashFlow / 12,
    yearlyCashFlow,
    cashOnCashPct: downPayment > 0 ? (yearlyCashFlow / downPayment) * 100 : null,
    dscr: yearlyDebtService > 0 ? noi / yearlyDebtService : null,
  };
}
