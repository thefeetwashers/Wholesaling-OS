'use client';

import { useMemo, useState } from 'react';
import { calculateMAO, totalMarketplaceCost, jvSplit, dealNet } from '../lib/mao';
import { suggestAssignmentFee, feeRoom } from '../lib/fee-guide';
import { analyzeRental } from '../lib/rental';

// Slice 60 — the public deal-math suite. The same pure libraries
// the in-app analyzers run on (lib/mao, lib/fee-guide, lib/rental),
// exposed on the homepage so a visiting wholesaler can run real
// numbers before ever creating an account. No inputs leave the
// browser; nothing is stored, tracked, or estimated by us — the
// visitor's numbers in, textbook wholesaling math out.

const money = (v: number) => `$${Math.round(v).toLocaleString()}`;
const num = (v: string) => { const n = parseFloat(v.replace(/[$,]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0; };

const field = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 14, width: '100%' } as const;
const label = { fontSize: 12.5, color: '#94a3b8', display: 'block', marginBottom: 4 } as const;
const panel = { background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 14, padding: '16px 18px' } as const;

export default function PublicCalculator() {
  const [arv, setArv] = useState('300000');
  const [repairs, setRepairs] = useState('50000');
  const [contract, setContract] = useState('150000');
  const [land, setLand] = useState(false);
  const [partnerPct, setPartnerPct] = useState('50');
  const [referral, setReferral] = useState('500');
  const [expenses, setExpenses] = useState('300');
  const [price, setPrice] = useState('240000');
  const [rent, setRent] = useState('2100');

  const calc = useMemo(() => {
    const a = num(arv), r = num(repairs), c = num(contract);
    const fee = suggestAssignmentFee(land ? 'land' : 'house', a, r, c);
    const room = feeRoom(a, r, c);
    const mao = calculateMAO(a, r, fee.suggested);
    const total = totalMarketplaceCost(c, fee.suggested);
    const split = jvSplit(fee.suggested, num(partnerPct) || 50);
    const net = dealNet(fee.suggested, num(referral), num(expenses));
    const rental = analyzeRental({
      purchasePrice: num(price), monthlyRent: num(rent),
      taxesYearly: 0, insuranceYearly: 0, hoaMonthly: 0,
      vacancyPct: 5, maintenancePct: 5, managementPct: 0,
      downPaymentPct: 20, interestRatePct: 7, termYears: 30,
    });
    return { fee, room, mao, total, split, net, rental, feePctOfArv: a > 0 ? Math.round((fee.suggested / a) * 1000) / 10 : 0 };
  }, [arv, repairs, contract, land, partnerPct, referral, expenses, price, rent]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
      <div style={panel}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>The 70% rule — your Maximum Allowable Offer</h3>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px' }}>
          MAO = (ARV × 70%) − repairs − your fee. Offer above it and the deal stops working for everyone.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={label}>After-repair value (ARV)</span><input style={field} value={arv} onChange={(e) => setArv(e.target.value)} inputMode="numeric" /></div>
          <div><span style={label}>Repairs</span><input style={field} value={repairs} onChange={(e) => setRepairs(e.target.value)} inputMode="numeric" /></div>
          <div><span style={label}>Your contract price with the seller</span><input style={field} value={contract} onChange={(e) => setContract(e.target.value)} inputMode="numeric" /></div>
          <div>
            <span style={label}>Property type</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setLand(false)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(148,163,184,0.35)', background: !land ? '#065f46' : '#0f172a', color: '#fff', fontSize: 13.5 }}>🏠 House</button>
              <button type="button" onClick={() => setLand(true)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(148,163,184,0.35)', background: land ? '#065f46' : '#0f172a', color: '#fff', fontSize: 13.5 }}>🌳 Land</button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.65 }}>
          <div>Room in this deal (ARV × 70% − repairs − contract): <strong>{money(calc.room)}</strong></div>
          <div>Suggested assignment fee: <strong style={{ color: '#6ee7b7' }}>{money(calc.fee.suggested)}</strong> <span style={{ color: '#94a3b8', fontSize: 13 }}>({calc.feePctOfArv}% of ARV — many wholesalers sanity-check a fee around 5–10% of ARV; the platform&rsquo;s floor is $10,000 on a house, $5,000 on land, always capped by the room actually in the deal)</span></div>
          <div>Your MAO at that fee: <strong>{money(calc.mao)}</strong> · Buyer&rsquo;s all-in at your contract price: <strong>{money(calc.total)}</strong></div>
          {calc.fee.note && <div style={{ color: '#fbbf24', fontSize: 13.5 }}>{calc.fee.note}</div>}
        </div>
      </div>

      <div style={panel}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Split it, then net it — what you actually keep</h3>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px' }}>
          JV deals split the fee; every deal loses a little to referrals and costs. Run both before you celebrate either.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={label}>JV partner share %</span><input style={field} value={partnerPct} onChange={(e) => setPartnerPct(e.target.value)} inputMode="numeric" /></div>
          <div><span style={label}>Referral paid</span><input style={field} value={referral} onChange={(e) => setReferral(e.target.value)} inputMode="numeric" /></div>
          <div><span style={label}>Deal expenses (mail, gas, photos)</span><input style={field} value={expenses} onChange={(e) => setExpenses(e.target.value)} inputMode="numeric" /></div>
        </div>
        <div style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.65 }}>
          <div>JV split of {money(calc.fee.suggested)}: you <strong>{money(calc.split.partnerA)}</strong> · partner <strong>{money(calc.split.partnerB)}</strong></div>
          <div>Net if you run it solo: <strong style={{ color: '#6ee7b7' }}>{money(calc.net)}</strong> <span style={{ color: '#94a3b8', fontSize: 13 }}>(fee − referral − expenses — before taxes; assignment income is ordinary income, set your share aside)</span></div>
        </div>
        <h3 style={{ margin: '18px 0 4px', fontSize: 16 }}>Selling to a landlord? The 1% rule + DSCR</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={label}>Price your buyer pays</span><input style={field} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" /></div>
          <div><span style={label}>Monthly rent</span><input style={field} value={rent} onChange={(e) => setRent(e.target.value)} inputMode="numeric" /></div>
        </div>
        <div style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.65 }}>
          <div>Rent-to-price: <strong>{calc.rental.onePctRulePct.toFixed(2)}%</strong> <span style={{ color: '#94a3b8', fontSize: 13 }}>(1.00% or better is the classic landlord screen)</span></div>
          <div>NOI ≈ <strong>{money(calc.rental.noi)}</strong>/yr · DSCR ≈ <strong>{calc.rental.dscr != null ? calc.rental.dscr.toFixed(2) : '—'}</strong> <span style={{ color: '#94a3b8', fontSize: 13 }}>(at 20% down, 7%, 30 yrs, before taxes/insurance — lenders want 1.20+; the full analyzer inside runs it with every cost)</span></div>
        </div>
      </div>
    </div>
  );
}
