// Slice 129 — JV Co-Wholesaling Split Calculator.
//
// An interactive split calculator that feeds its numbers into the
// EXISTING buildJVSplitAgreement() template in lib/contracts.ts
// (24-month non-circumvention both ways, 0% platform fee, §3 net
// profit minus documented approved costs) — there is deliberately
// NO second JV agreement template in this repo.
//
// Partner A is the signed-in wholesaler (acquisitions, contract
// holder), loaded from THEIR OWN storefront profile — never
// hardcoded operator defaults. When no profile is saved, Partner A
// fields are blank with a note to fill in Storefront Settings.
// Partner B is the other wholesaler's own details, typed in —
// generic empty placeholders only, never a named placeholder.
//
// All money fields start EMPTY. No $135,000 / $155,000 pre-fills,
// no $15,000 default assignment fee, no pre-filled MAO. The
// calculator shows the math live (gross spread, shared costs, net
// profit, each partner's payout) and prints a deal summary above
// the agreement text, because the agreement template itself only
// carries contract_price / approved_expenses / the split percents
// — the A-to-B and B-to-C prices are the calculator's numbers, and
// the printed page must show them, not hide them.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildJVSplitAgreement, type JVSplitAgreementFields } from '../lib/contracts';
import { loadMyStorefront } from '../lib/storefront';
import { FLORIDA_COUNTY_PRESETS, DEFAULT_FLORIDA_COUNTY_PRESET } from '../lib/floridaCountyPresets';

function parseMoney(raw: string): number | null {
  const n = Number(raw.replace(/[^0-9.]/g, ''));
  return raw.trim() === '' || Number.isNaN(n) ? null : n;
}

function money(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 14,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
  marginBottom: 4,
};

export default function JVCoWholesalingCalculator({ userId }: { userId: string }) {
  const [countyId, setCountyId] = useState(DEFAULT_FLORIDA_COUNTY_PRESET.id);
  const [propertyAddress, setPropertyAddress] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [aToB, setAToB] = useState('');
  const [bToC, setBToC] = useState('');
  const [sharedCosts, setSharedCosts] = useState('');
  const [splitA, setSplitA] = useState(50);
  // Partner A — from the signed-in wholesaler's own storefront
  // profile. Blank until loaded, and blank when no profile exists.
  const [partnerA, setPartnerA] = useState({ entity: '', address: '', email: '', phone: '', signer: '' });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  // Partner B — typed in, empty by default.
  const [partnerB, setPartnerB] = useState({ entity: '', address: '', email: '', phone: '', signer: '' });
  const [titleCompany, setTitleCompany] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);

  useEffect(() => {
    let live = true;
    loadMyStorefront(userId)
      .then((profile) => {
        if (!live) return;
        setProfileLoaded(true);
        if (profile) {
          setHasProfile(true);
          setPartnerA({
            entity: profile.company_name || profile.display_name || '',
            address: '',
            email: profile.public_email || '',
            phone: profile.public_phone || '',
            signer: profile.display_name || '',
          });
          setTitleCompany(profile.title_company || '');
        }
      })
      .catch(() => {
        if (live) setProfileLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const county = FLORIDA_COUNTY_PRESETS.find((c) => c.id === countyId) || DEFAULT_FLORIDA_COUNTY_PRESET;
  const countyLabel = county.label;

  const aToBNum = parseMoney(aToB);
  const bToCNum = parseMoney(bToC);
  const costsNum = parseMoney(sharedCosts);
  const calc = useMemo(() => {
    const gross = aToBNum != null && bToCNum != null ? bToCNum - aToBNum : null;
    const costs = costsNum ?? 0;
    const net = gross != null ? gross - costs : null;
    const payoutA = net != null ? (net * splitA) / 100 : null;
    const payoutB = net != null ? (net * (100 - splitA)) / 100 : null;
    return { gross, costs, net, payoutA, payoutB };
  }, [aToBNum, bToCNum, costsNum, splitA]);

  const readyToPrint =
    propertyAddress.trim() !== '' && aToBNum != null && bToCNum != null && partnerA.entity.trim() !== '' && partnerB.entity.trim() !== '';

  const agreementText = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const fields: JVSplitAgreementFields = {
      effective_date: today,
      party_a_entity: partnerA.entity,
      party_a_state: 'Florida',
      party_a_address: partnerA.address,
      party_a_email: partnerA.email,
      party_a_phone: partnerA.phone,
      party_b_entity: partnerB.entity,
      party_b_state: 'Florida',
      party_b_address: partnerB.address,
      party_b_email: partnerB.email,
      party_b_phone: partnerB.phone,
      contract_date: today,
      property_address: propertyAddress,
      contract_price: aToBNum,
      title_company: titleCompany,
      title_officer_email: '',
      closing_date: closingDate,
      party_a_split_percent: splitA,
      party_b_split_percent: 100 - splitA,
      approved_expenses: costsNum,
      property_state: 'Florida',
      party_a_signer: partnerA.signer || partnerA.entity,
      party_a_title: 'Partner A — Acquisitions / Contract Holder',
      party_b_signer: partnerB.signer || partnerB.entity,
      party_b_title: 'Partner B — Dispositions / Buyer Side',
    };
    return buildJVSplitAgreement(fields);
  }, [partnerA, partnerB, propertyAddress, aToBNum, costsNum, splitA, titleCompany, closingDate]);

  const dealSummary = [
    ['Property', propertyAddress || '—'],
    ['County', countyLabel],
    ['A-to-B contract price (Party A buys)', money(aToBNum)],
    ['B-to-C resale price (Party B sells)', money(bToCNum)],
    ['Gross spread (B-to-C minus A-to-B)', money(calc.gross)],
    ['Shared costs', money(costsNum)],
    ['Net JV profit', money(calc.net)],
    [`Partner A payout (${splitA}%)`, money(calc.payoutA)],
    [`Partner B payout (${100 - splitA}%)`, money(calc.payoutB)],
  ];

  return (
    <div>
      <style>{`@media print { .jvcalc-no-print { display: none !important; } .jvcalc-print { display: block !important; } body { background: #fff !important; } }`}</style>

      <div className="jvcalc-no-print">
        <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>
          Work out the split before you print the agreement. The numbers below are live — change a price or
          the slider and both payouts update. The agreement itself is the existing JV Co-Wholesaling Split
          Agreement template (0% platform fee, 24-month non-circumvention both ways) — it must be reviewed
          by an attorney before either party signs it.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle} htmlFor="jv-address">Property address</label>
            <input id="jv-address" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} placeholder="Property address" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="jv-county">County</label>
            <select id="jv-county" value={countyId} onChange={(e) => setCountyId(e.target.value)} style={inputStyle}>
              {FLORIDA_COUNTY_PRESETS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="jv-atob">A-to-B price — what Party A pays under contract ($)</label>
            <input id="jv-atob" value={aToB} onChange={(e) => setAToB(e.target.value)} placeholder="" inputMode="decimal" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="jv-btoc">B-to-C price — what Party B sells it for ($)</label>
            <input id="jv-btoc" value={bToC} onChange={(e) => setBToC(e.target.value)} placeholder="" inputMode="decimal" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="jv-costs">Shared costs — documented, approved by both partners ($)</label>
            <input id="jv-costs" value={sharedCosts} onChange={(e) => setSharedCosts(e.target.value)} placeholder="" inputMode="decimal" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="jv-closing">Closing date</label>
            <input id="jv-closing" type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <label style={{ ...labelStyle, marginBottom: 8 }} htmlFor="jv-split">
            Split — Partner A {splitA}% / Partner B {100 - splitA}%
          </label>
          <input
            id="jv-split"
            type="range"
            min={10}
            max={90}
            value={splitA}
            onChange={(e) => setSplitA(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
            <span>10% A / 90% B</span>
            <span>50 / 50</span>
            <span>90% A / 10% B</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
            <div><div style={{ fontSize: 11, color: '#64748b' }}>Gross spread</div><div style={{ fontSize: 18, fontWeight: 700 }}>{money(calc.gross)}</div></div>
            <div><div style={{ fontSize: 11, color: '#64748b' }}>Net JV profit</div><div style={{ fontSize: 18, fontWeight: 700 }}>{money(calc.net)}</div></div>
            <div><div style={{ fontSize: 11, color: '#64748b' }}>Partner A gets ({splitA}%)</div><div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>{money(calc.payoutA)}</div></div>
            <div><div style={{ fontSize: 11, color: '#64748b' }}>Partner B gets ({100 - splitA}%)</div><div style={{ fontSize: 18, fontWeight: 700, color: '#7c3aed' }}>{money(calc.payoutB)}</div></div>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 0 }}>
            Net profit = gross spread minus shared costs. Each payout is the net profit times that partner&apos;s
            split. Nothing here is a guaranteed return — the numbers only work if the resale actually closes at
            the B-to-C price.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Partner A — Acquisitions (contract holder)</div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 0 }}>
              {profileLoaded
                ? hasProfile
                  ? 'Loaded from your own storefront profile — edit it in Storefront Settings if it is wrong.'
                  : 'No storefront profile saved yet — fill these in, or save a profile in Storefront Settings first.'
                : 'Loading your storefront profile…'}
            </p>
            <label style={labelStyle}>Company / entity</label>
            <input value={partnerA.entity} onChange={(e) => setPartnerA({ ...partnerA, entity: e.target.value })} placeholder="Company or entity name" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Signer name</label>
            <input value={partnerA.signer} onChange={(e) => setPartnerA({ ...partnerA, signer: e.target.value })} placeholder="Signer name" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Address</label>
            <input value={partnerA.address} onChange={(e) => setPartnerA({ ...partnerA, address: e.target.value })} placeholder="Mailing address" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Email</label>
            <input value={partnerA.email} onChange={(e) => setPartnerA({ ...partnerA, email: e.target.value })} placeholder="Email address" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Phone</label>
            <input value={partnerA.phone} onChange={(e) => setPartnerA({ ...partnerA, phone: e.target.value })} placeholder="Phone number" style={inputStyle} />
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Partner B — Dispositions (buyer side)</div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 0 }}>
              The other wholesaler&apos;s own details — type them in. Nothing is pre-filled.
            </p>
            <label style={labelStyle}>Company / entity</label>
            <input value={partnerB.entity} onChange={(e) => setPartnerB({ ...partnerB, entity: e.target.value })} placeholder="Company or entity name" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Signer name</label>
            <input value={partnerB.signer} onChange={(e) => setPartnerB({ ...partnerB, signer: e.target.value })} placeholder="Signer name" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Address</label>
            <input value={partnerB.address} onChange={(e) => setPartnerB({ ...partnerB, address: e.target.value })} placeholder="Mailing address" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Email</label>
            <input value={partnerB.email} onChange={(e) => setPartnerB({ ...partnerB, email: e.target.value })} placeholder="Email address" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Phone</label>
            <input value={partnerB.phone} onChange={(e) => setPartnerB({ ...partnerB, phone: e.target.value })} placeholder="Phone number" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle} htmlFor="jv-title">Title company</label>
          <input id="jv-title" value={titleCompany} onChange={(e) => setTitleCompany(e.target.value)} placeholder="Title company (from your storefront profile, if set)" style={{ ...inputStyle, maxWidth: 480 }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowAgreement(true)}
            disabled={!readyToPrint}
            style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: readyToPrint ? '#0f172a' : '#94a3b8', color: '#fff', cursor: readyToPrint ? 'pointer' : 'not-allowed', fontWeight: 600 }}
          >
            Preview the JV agreement
          </button>
          {!readyToPrint && (
            <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
              Fill in the property address, both prices, and both partner companies to preview the agreement.
            </span>
          )}
        </div>
      </div>

      {showAgreement && (
        <div className="jvcalc-print" style={{ marginTop: 24 }}>
          <div className="jvcalc-no-print" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
            >
              🖨️ Print agreement
            </button>
            <button
              type="button"
              onClick={() => setShowAgreement(false)}
              style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              Back to the calculator
            </button>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, background: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>Deal summary — the numbers this agreement is built on</h3>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                {dealSummary.map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 0', color: '#475569' }}>{k}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              The agreement below is the standard JV Co-Wholesaling Split Agreement template. The B-to-C price
              and the payouts above are the calculator&apos;s numbers for this deal — the agreement itself
              carries the contract price, the approved shared costs, and the split percents.
            </p>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}>{agreementText}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
