'use client';

import { useEffect, useState } from 'react';
import {
  loadDisbursements,
  saveDisbursement,
  setDisbursementStatus,
  authorizationLetter,
  loadKpis,
  buildActionPlans,
  type Disbursement,
  type DisbursementMethod,
  type KpiData,
} from '../lib/money';
import { loadDeals, type DealRow } from '../lib/deals';
import { loadAllBuyBoxes } from '../lib/portals';

// Slice 14 — Money & scoreboard: disbursements with authorization
// letters, a KPI scorecard computed live from the user's own rows, and
// 7/30-day action plans generated from their real gaps. Plus the
// vacant-land-to-builders playbook, tied to real land buy-box demand.

const card: React.CSSProperties = { background: '#1e293b', padding: 16, borderRadius: 12, marginTop: 16 };
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export default function MoneyScoreboard({ userId }: { userId: string | null }) {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [disbs, setDisbs] = useState<Disbursement[]>([]);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [msg, setMsg] = useState('');
  const [letterFor, setLetterFor] = useState<string | null>(null);
  const [landBoxes, setLandBoxes] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const [dealId, setDealId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<DisbursementMethod>('wire');
  const [payee, setPayee] = useState('');

  const refresh = () => {
    if (!userId) return;
    loadDisbursements(userId).then(setDisbs).catch(() => {});
    loadKpis(userId).then(setKpi).catch(() => {});
  };
  useEffect(() => {
    if (!userId) return;
    loadDeals(userId).then((rows) => { if (rows) setDeals(rows); }).catch(() => {});
    loadAllBuyBoxes()
      .then((boxes) => setLandBoxes(boxes.filter((b) => b.property_types.some((t) => t.toLowerCase().includes('land'))).length))
      .catch(() => {});
    refresh();
    try { setChecked(JSON.parse(localStorage.getItem('ws_plan_checks') || '{}')); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!userId) return null;
  const dealAddress = (id?: string | null) => {
    const d = deals.find((x) => x.id === id);
    const a = d?.documents?.property_address;
    return typeof a === 'string' && a ? a : 'Deal property';
  };
  const plans = kpi ? buildActionPlans(kpi) : null;
  const toggle = (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    try { localStorage.setItem('ws_plan_checks', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const planItem = (key: string, text: string) => (
    <li key={key}>
      <label>
        <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} /> {text}
      </label>
    </li>
  );

  return (
    <section style={card}>
      <h2>Money & Scoreboard</h2>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}

      <h3>KPI scorecard — your numbers, this week vs last</h3>
      {kpi === null ? (
        <p style={{ fontSize: 13 }}>Loading your scorecard…</p>
      ) : (
        <div style={{ fontSize: 13 }}>
          <p>
            Leads added: <strong>{kpi.leadsThisWeek}</strong> this week · {kpi.leadsLastWeek} last week<br />
            Calls made: <strong>{kpi.callsThisWeek}</strong> · {kpi.callsLastWeek} last week<br />
            Conversations (motivated / follow-up): <strong>{kpi.conversationsThisWeek}</strong> this week<br />
            Offers received: <strong>{kpi.offersThisWeek}</strong> this week · {kpi.offersAcceptedTotal} accepted all-time<br />
            A–B contracts signed: <strong>{kpi.contractsSignedTotal}</strong> all-time<br />
            Assignment fees on closed deals (actuals recorded): <strong>{money(kpi.feesClosedTotal)}</strong>
          </p>
        </div>
      )}

      {plans && (
        <>
          <h3>Your 7-day action plan — generated from your pipeline</h3>
          <ul style={{ fontSize: 13, listStyle: 'none', paddingLeft: 0 }}>
            {plans.sevenDay.map((s, i) => planItem('7d-' + i, s))}
          </ul>
          <h3>Your 30-day action plan</h3>
          <ul style={{ fontSize: 13, listStyle: 'none', paddingLeft: 0 }}>
            {plans.thirtyDay.map((s, i) => planItem('30d-' + i, s))}
          </ul>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>Checkboxes are saved on this device. Every number in these plans comes from your own data above.</p>
        </>
      )}

      <h3>Disbursements</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select value={dealId} onChange={(e) => setDealId(e.target.value)}>
          <option value="">Pick a saved deal…</option>
          {deals.map((d) => <option key={d.id} value={d.id}>{dealAddress(d.id)}</option>)}
        </select>
        <input placeholder="Amount $" inputMode="numeric" style={{ width: 110 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select value={method} onChange={(e) => setMethod(e.target.value as DisbursementMethod)}>
          <option value="wire">Wire</option>
          <option value="online">Online payment</option>
          <option value="mailed_check">Mailed check</option>
        </select>
        <input placeholder="Payee name" value={payee} onChange={(e) => setPayee(e.target.value)} />
        <button onClick={async () => {
          const amt = Number(amount);
          if (!(amt > 0)) { setMsg('Enter an amount first.'); return; }
          const d: Disbursement = {
            deal_id: dealId || null,
            amount: amt,
            method,
            instructions: { payee_name: payee },
            status: 'draft',
          };
          d.authorization_letter = authorizationLetter(d, dealAddress(dealId || undefined));
          try { await saveDisbursement(userId, d); setMsg('Disbursement saved as a draft with its authorization letter.'); setAmount(''); setPayee(''); refresh(); }
          catch (e) { setMsg(e instanceof Error ? e.message : 'Save failed'); }
        }}>Save disbursement</button>
      </div>
      {disbs.length === 0 ? (
        <p style={{ fontSize: 13 }}>No disbursements yet. Record one when a deal closes and money moves.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {disbs.map((d) => (
            <li key={d.id} style={{ marginBottom: 8 }}>
              <strong>{money(Number(d.amount))}</strong> to {d.instructions?.payee_name || 'payee'} — {dealAddress(d.deal_id)} · {d.method} · status: {d.status}
              {d.sent_at ? ` · sent ${new Date(d.sent_at).toLocaleDateString()}` : ''}
              {d.received_at ? ` · received ${new Date(d.received_at).toLocaleDateString()}` : ''}
              <br />
              {d.status === 'draft' && <button onClick={async () => { await setDisbursementStatus(d, 'sent_to_title'); refresh(); }}>Mark sent to title</button>}
              {d.status === 'sent_to_title' && <button onClick={async () => { await setDisbursementStatus(d, 'received'); refresh(); }}>Mark received</button>}
              {' '}<button onClick={() => setLetterFor(letterFor === d.id ? null : (d.id || null))}>Authorization letter</button>
              {letterFor === d.id && d.authorization_letter && (
                <p style={{ background: '#0f172a', padding: 12, borderRadius: 10, whiteSpace: 'pre-wrap' }}>{d.authorization_letter}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>
        Bank details are never stored in WholesalingOS — wire instructions move only between the payee and the title company.
      </p>

      <h3>Playbook — vacant land to builders</h3>
      <div style={{ fontSize: 13 }}>
        <p>
          Active buyer demand for land right now: <strong>{landBoxes} buy box{landBoxes === 1 ? '' : 'es'}</strong> asking for land.
        </p>
        <ol>
          <li>Source: tax-delinquent and code-violation lists plus Driving for Dollars pins on empty lots.</li>
          <li>Verify zoning and buildability at the county appraiser / GIS link in the Counties section — never guess a lot is buildable.</li>
          <li>Price off recent land comps, not house ARV math; land MAO is its own calculation.</li>
          <li>Contract the lot with the standard A–B flow (price only to the seller), then list it publicly so builder buy boxes match it.</li>
          <li>Builders move fast and pay cash — send the accepted-offer B–C through the same signing flow, and close with your usual title company.</li>
        </ol>
      </div>
    </section>
  );
}
