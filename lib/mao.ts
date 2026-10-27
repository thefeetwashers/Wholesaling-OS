// Pure deal math — verified against the Oct 24, 2026 prototype probe:
// ARV $300,000, contract $150,000, repairs $50,000
// fee $20,000 -> MAO $140,000 (over-MAO warning at $150,000 contract)
// fee $10,000 -> MAO $150,000 (warning cleared), Total $160,000

export function calculateMAO(arv: number, repairs: number, fee: number): number {
  return arv * 0.7 - repairs - fee;
}

export function totalMarketplaceCost(contractPrice: number, fee: number): number {
  return contractPrice + fee;
}

export function isOverMAO(contractPrice: number, mao: number): boolean {
  return contractPrice > mao;
}

export function jvSplit(netFee: number, splitPercent: number): { partnerA: number; partnerB: number } {
  const a = (netFee * splitPercent) / 100;
  return { partnerA: a, partnerB: netFee - a };
}

export function dealNet(fee: number, referral: number, expenses: number): number {
  return fee - referral - expenses;
}

// Example check (not a seeded deal): $10,000 - $500 - $300 = $9,200
export const EXAMPLE_NET = dealNet(10000, 500, 300);
