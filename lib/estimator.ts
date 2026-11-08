// Slice 79 — repair estimator math. The rates are the wholesaler's
// OWN numbers: the defaults below are labeled starting points to
// replace with their contractor's real prices, never market data
// and never a quote. Rates and add-on prices persist on this device
// only (localStorage), the same honest pattern as the letter
// identity — stated on the panel itself.

export type RehabLevel = 'light' | 'medium' | 'heavy' | 'gut';

export const LEVELS: { key: RehabLevel; label: string; blurb: string }[] = [
  { key: 'light', label: 'Light cosmetic', blurb: 'Paint, fixtures, clean-up, minor fixes' },
  { key: 'medium', label: 'Medium rehab', blurb: 'Kitchen/bath refresh, flooring, systems service' },
  { key: 'heavy', label: 'Heavy rehab', blurb: 'Major systems, layout work, full kitchen/baths' },
  { key: 'gut', label: 'Full gut', blurb: 'Down to the studs and back' },
];

export interface AddonDef { key: string; label: string; unit: string; defaultPrice: number }

export const ADDONS: AddonDef[] = [
  { key: 'roof', label: 'Roof replacement', unit: 'each', defaultPrice: 8500 },
  { key: 'hvac', label: 'HVAC system', unit: 'each', defaultPrice: 7500 },
  { key: 'kitchen', label: 'Kitchen remodel', unit: 'each', defaultPrice: 15000 },
  { key: 'bath', label: 'Bathroom remodel', unit: 'per bath', defaultPrice: 6500 },
  { key: 'electrical', label: 'Electrical rewire', unit: 'each', defaultPrice: 6000 },
  { key: 'plumbing', label: 'Plumbing re-plumb', unit: 'each', defaultPrice: 5500 },
];

export interface EstimatorState {
  sqft: number;
  level: RehabLevel;
  rates: Record<RehabLevel, number>;
  prices: Record<string, number>;
  qty: Record<string, number>;
}

export const DEFAULT_STATE: EstimatorState = {
  sqft: 1200,
  level: 'medium',
  rates: { light: 15, medium: 35, heavy: 60, gut: 85 },
  prices: Object.fromEntries(ADDONS.map((a) => [a.key, a.defaultPrice])),
  qty: Object.fromEntries(ADDONS.map((a) => [a.key, 0])),
};

const KEY = 'ws_estimator_v1';
export const ESTIMATE_TOTAL_KEY = 'ws_repair_estimate_total';

export function loadEstimatorState(): EstimatorState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<EstimatorState>;
    return {
      sqft: typeof parsed.sqft === 'number' ? parsed.sqft : DEFAULT_STATE.sqft,
      level: LEVELS.some((l) => l.key === parsed.level) ? (parsed.level as RehabLevel) : 'medium',
      rates: { ...DEFAULT_STATE.rates, ...(parsed.rates || {}) },
      prices: { ...DEFAULT_STATE.prices, ...(parsed.prices || {}) },
      qty: { ...DEFAULT_STATE.qty, ...(parsed.qty || {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveEstimatorState(s: EstimatorState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* device storage unavailable */ }
}

export interface EstimateBreakdown {
  base: number;
  addonLines: { key: string; label: string; amount: number }[];
  total: number;
}

export function estimate(s: EstimatorState): EstimateBreakdown {
  const base = Math.max(0, s.sqft) * Math.max(0, s.rates[s.level] || 0);
  const addonLines = ADDONS.map((a) => ({
    key: a.key,
    label: a.label,
    amount: Math.max(0, s.qty[a.key] || 0) * Math.max(0, s.prices[a.key] || 0),
  })).filter((l) => l.amount > 0);
  const total = base + addonLines.reduce((sum, l) => sum + l.amount, 0);
  return { base, addonLines, total };
}
