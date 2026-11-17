'use client';

import { useEffect, useState } from 'react';
import {
  acceptPartnerAgreement,
  loadAllLenderBoxesForOperator,
  loadMatchedFundingRequests,
  loadMyLenderBox,
  OPERATOR_EMAIL,
  saveLenderBox,
  setFundingRequestStatus,
  setLenderVerified,
  US_STATES,
  FUNDING_STATUSES,
  type FundingRequest,
  type FundingStatus,
  type FundingType,
  type LenderBox,
  type LenderBoxWithEmail,
} from '../lib/funding';
import { FundingHistoryList } from './Contracts';

// Lender desk. Two tabs: the opt-in deal packets this lender is
// matched to (RLS decides the match — a packet that is not listed
// was not shown because the database refused it, and this panel
// never invents a match), and the lender's own lending box.
// Nothing here is a live funding commitment: a packet is a request
// a wholesaler chose to share, and a status is a status word.

const money = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.round(Number(n)).toLocaleString('en-US');

// Slice 136 — the database error arrives as a plain PostgREST object
// ({ message, code, ... }), not an Error, so `e instanceof Error`
// is false for it and every catch in this file used to fall through
// to a generic string. Read the message off whatever was thrown so
// the desk shows the database's own words instead of a generic line.
function readableError(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return fallback;
}

const LENDING_PROGRAMS: { value: FundingType; label: string }[] = [
  { value: 'transactional', label: 'Transactional' },
  { value: 'fix_and_flip', label: 'Fix-and-Flip' },
  { value: 'dscr', label: 'DSCR' },
  { value: 'bridge', label: 'Bridge' },
];

function impliedLtv(r: FundingRequest): string {
  if (r.loan_amount_requested == null || r.purchase_price == null || Number(r.purchase_price) <= 0) return '—';
  return ((Number(r.loan_amount_requested) / Number(r.purchase_price)) * 100).toFixed(1) + '% of purchase price';
}

function impliedLtc(r: FundingRequest): string {
  const cost =
    (Number(r.purchase_price) || 0) + (Number(r.rehab_budget) || 0);
  if (r.loan_amount_requested == null || cost <= 0) return '—';
  return ((Number(r.loan_amount_requested) / cost) * 100).toFixed(1) + '% of purchase + rehab';
}

const AGREEMENT_TEXT = `Wholesale Lender & Commercial Referral Partner Agreement — short form

Between The Feet Washers, Inc. (operator of WholesalingOS) and the lender named in this lending box.

1. Commercial purpose only. Every packet shared here is a commercial, non-owner-occupied investment real estate request from an active business entity (LLC/Corporation). Nothing here is a consumer loan.
2. Referral fee. When a deal you fund through this platform closes, The Feet Washers, Inc. earns a referral fee of 1.5%–2.0% of the funded loan amount, shown on the HUD/ALTA settlement statement. The exact percent within that range is agreed per deal before closing and is never an upfront borrower fee.
3. Non-circumvention. For 12 months after you first see a packet here, you will not go around the platform to fund that same borrower or deal directly in order to avoid the referral fee in section 2.
4. No upfront fees. You charge the borrower no upfront fee to review or receive a packet here.
5. Your own underwriting. You underwrite every deal yourself. Nothing on this platform is a funding commitment, a guarantee, or legal advice.
6. Attorney review. Loan documents are reviewed by each party's own attorney before signing.`;

export default function LenderDashboard({ userId, userEmail }: { userId: string; userEmail: string | null }) {
  const [tab, setTab] = useState<'packets' | 'box'>('packets');
  const [packets, setPackets] = useState<FundingRequest[]>([]);
  const [box, setBox] = useState<LenderBox | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);

  const isOperator = userEmail === OPERATOR_EMAIL;
  const [allBoxes, setAllBoxes] = useState<LenderBoxWithEmail[]>([]);

  const [company, setCompany] = useState('');
  const [types, setTypes] = useState<FundingType[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [minLoan, setMinLoan] = useState('');
  const [maxLoan, setMaxLoan] = useState('');
  const [maxLtv, setMaxLtv] = useState('');
  const [minDscr, setMinDscr] = useState('');
  const [agreed, setAgreed] = useState(false);

  const refresh = () => {
    // Slice 136 — the real database error is shown now, not the
    // generic "Could not load packets." (see readableError above).
    loadMatchedFundingRequests().then(setPackets).catch((e) => setErr(readableError(e, 'Could not load packets.')));
    loadMyLenderBox(userId)
      .then((b) => {
        setBox(b);
        if (b) {
          setCompany(b.company_name || '');
          setTypes(b.lending_types || []);
          setStates(b.states_covered || []);
          setMinLoan(b.min_loan_amount != null ? String(b.min_loan_amount) : '');
          setMaxLoan(b.max_loan_amount != null ? String(b.max_loan_amount) : '');
          setMaxLtv(b.max_ltv_percent != null ? String(b.max_ltv_percent) : '');
          setMinDscr(b.min_dscr != null ? String(b.min_dscr) : '');
          setAgreed(b.partner_agreement_accepted);
        }
      })
      .catch(() => {});
    if (isOperator) {
      loadAllLenderBoxesForOperator(userEmail).then(setAllBoxes).catch(() => {});
    }
  };
  useEffect(refresh, [userId, userEmail, isOperator]);

  const toggleType = (t: FundingType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const toggleState = (code: string) =>
    setStates((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  const numOrNull = (v: string) => {
    const n = parseFloat(v.replace(/[$,]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const saveBox = async () => {
    setMsg('');
    try {
      const saved = await saveLenderBox(userId, {
        company_name: company,
        lending_types: types,
        states_covered: states,
        min_loan_amount: numOrNull(minLoan),
        max_loan_amount: numOrNull(maxLoan),
        max_ltv_percent: numOrNull(maxLtv),
        min_dscr: numOrNull(minDscr),
      });
      setBox(saved);
      setMsg('Lending box saved. It is yours only until a packet matches it — it is not published to the world.');
      refresh();
    } catch (e) {
      setMsg(readableError(e, 'Save failed — try again.'));
    }
  };

  const acceptAgreement = async () => {
    if (!box?.id || !agreed) {
      setMsg('Save your lending box first, then check the agreement box to accept it.');
      return;
    }
    try {
      await acceptPartnerAgreement(box.id);
      setMsg('Partner agreement accepted. The operator still has to verify you before packets can match your box.');
      refresh();
    } catch (e) {
      setMsg(readableError(e, 'Acceptance failed — try again.'));
    }
  };

  return (
    <div>
      <h3>Capital &amp; Lending Partner Desk</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        You see only the opt-in commercial deal packets your lending box matches — verified partner
        status, an accepted partner agreement, the packet&apos;s state, and its program all have to
        line up. A packet that is not listed was not withheld by this page; the database did not
        return it. No packet here is a funding commitment.
      </p>
      {err && <p style={{ fontSize: 13, color: '#f87171' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setTab('packets')} style={{ background: tab === 'packets' ? '#065f46' : '#0f172a', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Opt-In Deal Packets ({packets.length})</button>
        <button onClick={() => setTab('box')} style={{ background: tab === 'box' ? '#065f46' : '#0f172a', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>My Lending Box</button>
      </div>

      {tab === 'packets' && (
        <div>
          {statusMsg && <p style={{ fontSize: 13 }}>{statusMsg}</p>}
          {packets.length === 0 ? (
            <p style={{ fontSize: 13 }}>
              No matched packets yet. Packets appear here only after your lending box is saved, your
              partner agreement is accepted, and the operator verifies you — and only for packets
              whose state and program your box covers.
            </p>
          ) : (
            <ul style={{ fontSize: 13 }}>
              {packets.map((r) => (
                <li key={r.id} style={{ marginBottom: 12, background: '#0f172a', padding: 12, borderRadius: 10 }}>
                  <strong>{r.property_address || 'Property address not given'}</strong>
                  {' '}· {r.financing_type} · via {r.routing_track === 'direct_feet_washers' ? 'Direct — The Feet Washers, Inc.' : 'ISO network'}
                  <br />
                  Purchase price {money(r.purchase_price)} · Loan requested {money(r.loan_amount_requested)} ·
                  Est. ARV {money(r.estimated_arv)} · Rehab {money(r.rehab_budget)} · Rent {r.monthly_rent != null ? money(r.monthly_rent) + '/mo' : '—'}
                  <br />
                  Implied LTV {impliedLtv(r)} · Implied LTC {impliedLtc(r)} ·
                  Target closing {r.target_closing_date || '—'} · Title company {r.title_company_name || '—'}
                  <br />
                  Borrower entity {r.borrowing_entity_name || '—'}{r.entity_state ? ` (${r.entity_state})` : ''} ·
                  Business-purpose certified: yes · No upfront fee acknowledged: yes
                  <br />
                  Status:{' '}
                  <select
                    value={r.status}
                    onChange={async (e) => {
                      const next = e.target.value as FundingStatus;
                      try {
                        // Slice 120, item 5: the change is logged with
                        // the lender as the actor.
                        await setFundingRequestStatus(r.id!, next, { oldStatus: r.status, actorRole: 'lender', userId });
                        setStatusMsg(`Packet status set to ${next}.`);
                        setHistoryVersion((v) => v + 1);
                        refresh();
                      } catch (err2) {
                        setStatusMsg(readableError(err2, 'Status update failed.'));
                      }
                    }}
                  >
                    {FUNDING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {r.id && <FundingHistoryList requestId={r.id} version={historyVersion} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'box' && (
        <div>
          {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
          <p style={{ fontSize: 13 }}>
            Verified partner: <strong>{box?.is_verified_partner ? 'Yes — verified by the operator' : 'No — not verified yet'}</strong>
            {' · '}Partner agreement: <strong>{box?.partner_agreement_accepted ? `Accepted${box.partner_agreement_accepted_at ? ` on ${new Date(box.partner_agreement_accepted_at).toLocaleDateString()}` : ''}` : 'Not accepted'}</strong>
          </p>
          <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
            <label style={{ fontSize: 13 }}>Company name <input style={{ width: '100%' }} value={company} onChange={(e) => setCompany(e.target.value)} /></label>
            <div style={{ fontSize: 13 }}>
              Loan programs{' '}
              {LENDING_PROGRAMS.map((p) => (
                <label key={p.value} style={{ marginRight: 10 }}>
                  <input type="checkbox" checked={types.includes(p.value)} onChange={() => toggleType(p.value)} /> {p.label}
                </label>
              ))}
            </div>
            <label style={{ fontSize: 13 }}>Min loan $ <input inputMode="numeric" value={minLoan} onChange={(e) => setMinLoan(e.target.value)} /></label>
            <label style={{ fontSize: 13 }}>Max loan $ <input inputMode="numeric" value={maxLoan} onChange={(e) => setMaxLoan(e.target.value)} /></label>
            <label style={{ fontSize: 13 }}>Max LTV % <input inputMode="numeric" value={maxLtv} onChange={(e) => setMaxLtv(e.target.value)} /></label>
            <label style={{ fontSize: 13 }}>Min DSCR <input inputMode="numeric" value={minDscr} onChange={(e) => setMinDscr(e.target.value)} /></label>
            <div style={{ fontSize: 13 }}>
              States covered — click to toggle:
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {US_STATES.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => toggleState(s.code)}
                    title={s.name}
                    style={{ padding: '6px 9px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.35)', background: states.includes(s.code) ? '#065f46' : '#0f172a', color: '#fff', fontSize: 12.5, cursor: 'pointer' }}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={saveBox}>Save my lending box</button>
          </div>

          <h4 style={{ marginTop: 20 }}>Wholesale Lender &amp; Commercial Referral Partner Agreement</h4>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: 12, borderRadius: 8, fontSize: 12.5 }}>{AGREEMENT_TEXT}</pre>
          <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
            ⚖️ ATTORNEY REVIEW REQUIRED BEFORE USE. This is a template, not legal advice. Have your
            own attorney review it before you accept it. The referral fee is 1.5%–2.0% — a range, not
            a fixed percent — and the non-circumvention tail is 12 months. Accepting this agreement
            does not verify you: verification is a separate step, done only by the operator, and the
            database refuses verification for a box whose agreement was never accepted.
          </p>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />{' '}
            I accept the Wholesale Lender &amp; Commercial Referral Partner Agreement above.
          </label>{' '}
          <button onClick={acceptAgreement} disabled={!box?.id || !agreed || box?.partner_agreement_accepted}>
            {box?.partner_agreement_accepted ? 'Agreement already accepted' : 'Accept agreement'}
          </button>
          {!box?.id && <p style={{ fontSize: 12, color: '#94a3b8' }}>Save your lending box first — the agreement is recorded on it.</p>}
        </div>
      )}

      {isOperator && (
        <section style={{ marginTop: 20, background: '#0f172a', padding: 14, borderRadius: 10 }}>
          <h4 style={{ marginTop: 0 }}>Operator — partner verification</h4>
          {allBoxes.length === 0 ? (
            <p style={{ fontSize: 13 }}>No lender boxes registered yet.</p>
          ) : (
            <ul style={{ fontSize: 13 }}>
              {allBoxes.map((b) => (
                <li key={b.id} style={{ marginBottom: 8 }}>
                  <strong>{b.company_name || '(no company name)'}</strong> · {b.lender_email || b.lender_id} ·
                  agreement {b.partner_agreement_accepted ? 'accepted' : 'NOT accepted'} ·
                  programs {(b.lending_types || []).join(', ') || 'none'} · states {(b.states_covered || []).join(', ') || 'none'}
                  {' '}
                  <button
                    disabled={!b.partner_agreement_accepted && !b.is_verified_partner}
                    onClick={async () => {
                      try {
                        await setLenderVerified(b.id!, !b.is_verified_partner, userEmail);
                        setMsg(b.is_verified_partner ? 'Partner verification removed.' : 'Lender verified — matched ISO packets can now reach this lender.');
                        refresh();
                      } catch (e) {
                        setMsg(readableError(e, 'Verification update failed.'));
                      }
                    }}
                  >
                    {b.is_verified_partner ? 'Remove verification' : 'Verify partner'}
                  </button>
                  {!b.partner_agreement_accepted && !b.is_verified_partner && (
                    <span style={{ color: '#94a3b8' }}> — cannot verify until the agreement is accepted.</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
