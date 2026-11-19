'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabase';
import { loadDeals, type DealRow } from '../lib/deals';
import { createListingForDeal, createEscrowFile, loadEscrowFilesForDeal, loadMilestonesForFiles, updateEscrowFileStatus, addEscrowMilestone, setEscrowOutcome, type EscrowFileRow } from '../lib/escrow';
import DealAutopsy, { AutopsyLessons } from './DealAutopsy';
import DealReviews from './DealReviews';
import ClosingCertificate from './ClosingCertificate';
import { closingChecklist, nextMilestone } from '../lib/closing-checklist';
import { emdCountdownText } from '../lib/contracts';
import RequestFundingModal from './RequestFundingModal';
import SellerAdvanceRequest from './SellerAdvanceRequest';
import { loadAllAdvanceRequestsForOperator, setAdvanceStatus, type SellerAdvanceRequest as AdvanceRow, type SellerAdvanceStatus } from '../lib/seller-advance';
import { loadMyProfile } from '../lib/portals';
import { OPERATOR_EMAIL } from '../lib/funding';

// Slice 122 — investor insurance quote. The partner URL comes only
// from NEXT_PUBLIC_INSURANCE_PARTNER_URL; it is UNSET today, so the
// button does not render a link — it says plainly that no partner
// is configured. No insurer is named or hardcoded here.
const INSURANCE_PARTNER_URL = process.env.NEXT_PUBLIC_INSURANCE_PARTNER_URL || '';

// Title escrow tracker, ported from the old prototype.
// Milestones and the EMD countdown are manual: you set the deadline, the app counts down from it.
// Payout is price + fee − referral = net. Title handoff is an email package, not an API.
const MILESTONES = [
  'Contract signed', 'EMD received', 'Title search ordered',
  'Title commitment received', 'Closing scheduled', 'Closed / funded',
];

export default function Escrow({ userId }: { userId: string | null }) {
  // Slice 141 audit fix: money fields start blank — no pre-filled price
  // or fee. A save must use only figures the wholesaler actually typed.
  const [price, setPrice] = useState('');
  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [dealId, setDealId] = useState('');
  const [files, setFiles] = useState<EscrowFileRow[]>([]);
  const [milestones, setMilestones] = useState<Record<string, string[]>>({});
  const [savedMsg, setSavedMsg] = useState('');
  const [myEmail, setMyEmail] = useState<string | null>(null);
  useEffect(() => {
    if (userId && supabaseConfigured) {
      loadDeals(userId).then((rows) => { if (rows) setDeals(rows); }).catch(() => {});
      loadMyProfile(userId).then((p) => setMyEmail(p?.email || null)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const isOperator = (myEmail || '').toLowerCase() === OPERATOR_EMAIL;
  useEffect(() => {
    if (userId && supabaseConfigured && dealId) {
      loadEscrowFilesForDeal(userId, dealId).then((rows) => {
        if (!rows) return;
        setFiles(rows);
        const ids = rows.map((r) => r.id).filter(Boolean) as string[];
        loadMilestonesForFiles(userId, ids).then((m) => { if (m) setMilestones(m); }).catch(() => {});
      }).catch(() => {});
    }
  }, [userId, dealId]);
  const saveEscrow = async () => {
    if (!dealId || !userId || !supabaseConfigured) { setSavedMsg('Pick a saved deal and sign in to save escrow.'); return; }
    if (price === '' || fee === '') { setSavedMsg('Enter a contract price and an assignment fee before saving — a blank figure is never saved as a listing price.'); return; }
    const listing = await createListingForDeal(userId, dealId, num(price) + num(fee)).catch(() => null);
    if (!listing) { setSavedMsg('Save failed — check sign-in and try again.'); return; }
    const selectedDeal = deals.find((d) => d.id === dealId);
    const file = await createEscrowFile(userId, listing.id, selectedDeal?.emd_amount ?? 0, deadline || null).catch(() => null);
    if (!file || !file.id) { setSavedMsg('Listing created but escrow file failed — check the listings table.'); return; }
    const recorded: string[] = [];
    for (let i = 0; i <= step && i < MILESTONES.length; i++) {
      await addEscrowMilestone(userId, file.id, MILESTONES[i]).catch(() => {});
      recorded.push(MILESTONES[i]);
    }
    setMilestones({ ...milestones, [file.id]: recorded });
    setFiles([file, ...files]); setSavedMsg('Escrow file saved to Supabase (listing + file + milestones).');
  };
  const [fee, setFee] = useState('');
  const [referral, setReferral] = useState('');
  const [deadline, setDeadline] = useState('');
  const [step, setStep] = useState(0);
  const [showFunding, setShowFunding] = useState(false);
  const net = num(price) + num(fee) - num(referral);
  const selectedDeal = deals.find((d) => d.id === dealId);
  const selectedDocs = (selectedDeal?.documents || {}) as { property_address?: string; state?: string };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Title Escrow Tracker</h2>
      <label>Deal (saved in Supabase): <select value={dealId} onChange={(e) => { const id = e.target.value; setDealId(id); const d = deals.find((x) => x.id === id); if (d?.contract_price != null) setPrice(String(d.contract_price)); if (d?.assignment_fee != null) setFee(String(d.assignment_fee)); }}><option value="">— pick a deal —</option>{deals.map((d) => <option key={d.id} value={d.id}>{(d.documents as { property_address?: string } | undefined)?.property_address || d.id} — {d.contract_type}</option>)}</select></label>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>{savedMsg || 'Save creates a marketplace listing, then an escrow file, then append-only milestone rows.'}</p>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Milestones are advanced by you, by hand. Nothing here talks to a title company system. Milestones saved to Supabase are append-only — they are inserted, never edited or deleted.</p>
      <label>Contract price $ <input type="number" placeholder="Not provided" value={price} onChange={(e) => setPrice(e.target.value)} /></label>{' '}
      <label>Assignment fee $ <input type="number" placeholder="Not provided" value={fee} onChange={(e) => setFee(e.target.value)} /></label>{' '}
      <label>Referral $ <input type="number" placeholder="Not provided" value={referral} onChange={(e) => setReferral(e.target.value)} /></label>
      {price === '' || fee === '' ? (
        <p>Enter a contract price and an assignment fee to see the payout net — nothing is filled in for you.</p>
      ) : (
        <p><strong>Payout net: ${net.toLocaleString()}</strong> (price + fee − referral)</p>
      )}
      <label>EMD deadline: <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
      <p>EMD countdown: {deadline ? emdCountdownText(deadline) : 'No deadline set yet.'}</p>
      <p style={{ fontSize: 13, color: '#fbbf24' }}>
        ⚑ Have the double-close answer ready — some sellers, lenders and HOAs restrict assignments.
        Knowing your double-close path — and what it costs — before you sign keeps one clause from killing a funded deal.{' '}
        <button
          type="button"
          onClick={() => setShowFunding(true)}
          disabled={!userId}
          style={{ background: '#065f46', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, fontWeight: 700, cursor: userId ? 'pointer' : 'not-allowed', marginLeft: 6 }}
        >
          Request Transactional Funding →
        </button>
        {!userId && <span style={{ color: '#94a3b8' }}> Sign in first — a funding request is tied to your account.</span>}
        {!dealId && userId && <span style={{ color: '#94a3b8' }}> Pick a deal above first — the request prefills from it.</span>}
      </p>
      {showFunding && userId && dealId && (
        <RequestFundingModal
          userId={userId}
          prefill={{
            financingType: 'transactional',
            dealId,
            propertyAddress: selectedDocs.property_address,
            propertyState: selectedDocs.state,
            purchasePrice: price === '' ? undefined : num(price),
          }}
          onClose={() => setShowFunding(false)}
          onSubmitted={() => setShowFunding(false)}
        />
      )}
      <ol>
        {MILESTONES.map((m, i) => (
          <li key={m} style={{ opacity: i <= step ? 1 : 0.5 }}>
            {m} {i === step && <button onClick={() => setStep(Math.min(step + 1, MILESTONES.length - 1))}>Mark done →</button>}
            {i < step && ' ✓'}
          </li>
        ))}
      </ol>
      <button onClick={saveEscrow}>Save escrow file to Supabase</button>
      {files.length > 0 && (
        <ul>
          {files.map((f) => (
            <li key={f.id} style={{ marginBottom: 8 }}>
              Escrow file — EMD required ${f.emd_amount_required ?? 0}, deadline {f.emd_deadline || 'none'} ·{' '}
              <strong>Outcome: {f.outcome === 'closed' ? 'Closed' : f.outcome === 'fell_through' ? 'Fell through' : 'Open'}</strong>
              {f.id && (
                <>
                  {' '}
                  {f.outcome !== 'closed' && <button onClick={async () => { await setEscrowOutcome(f.id!, 'closed'); setFiles(files.map((x) => (x.id === f.id ? { ...x, outcome: 'closed' } : x))); setSavedMsg('Escrow marked closed — this counts on the buyer’s record.'); }}>Mark closed</button>}{' '}
                  {f.outcome !== 'fell_through' && <button onClick={async () => { await setEscrowOutcome(f.id!, 'fell_through'); setFiles(files.map((x) => (x.id === f.id ? { ...x, outcome: 'fell_through' } : x))); setSavedMsg('Escrow marked fell through — this counts on the buyer’s record.'); }}>Mark fell through</button>}{' '}
                  {f.outcome && f.outcome !== 'open' && <button onClick={async () => { await setEscrowOutcome(f.id!, 'open'); setFiles(files.map((x) => (x.id === f.id ? { ...x, outcome: 'open' } : x))); setSavedMsg('Escrow outcome reopened.'); }}>Reopen</button>}
                  <DealAutopsy escrowFileId={f.id} outcome={f.outcome || 'open'} />
                  <DealReviews userId={userId} escrowFileId={f.id} outcome={f.outcome || 'open'} />
                  <ClosingCertificate file={f} deal={deals.find((d) => d.id === dealId) || null} />
                </>
              )}
              {f.id && (() => {
                const names = milestones[f.id] || [];
                const cl = closingChecklist(f, names);
                const next = nextMilestone(names);
                const icon = (s: string) => (s === 'done' ? '✅' : s === 'attention' ? '🔴' : s === 'pending' ? '🟡' : '⚪');
                return (
                  <span style={{ display: 'block', marginTop: 6, fontSize: 12.5 }}>
                    <strong>{cl.badgeLabel}</strong>
                    <span style={{ display: 'block', marginTop: 2 }}>
                      {cl.items.map((it) => (
                        <span key={it.key} style={{ marginRight: 10 }} title={it.detail}>{icon(it.state)} {it.label}{it.state === 'attention' ? ` — ${it.detail}` : ''}</span>
                      ))}
                    </span>
                    <span style={{ display: 'block', marginTop: 6 }}>
                      🛡️ Bind Vacant / Landlord Insurance (Required by Lender){' '}
                      {INSURANCE_PARTNER_URL ? (
                        <a href={INSURANCE_PARTNER_URL} target="_blank" rel="noreferrer" style={{ color: '#7dd3fc' }}>Get Investor Insurance Quote →</a>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>No insurance partner configured yet — ask the operator for an introduction.</span>
                      )}
                      {' '}
                      {names.includes('Insurance bound') ? (
                        <span style={{ color: '#34d399' }}>✓ Insurance bound</span>
                      ) : (
                        <button onClick={async () => { await addEscrowMilestone(userId!, f.id!, 'Insurance bound'); setMilestones({ ...milestones, [f.id!]: [...names, 'Insurance bound'] }); setSavedMsg('Milestone recorded: Insurance bound'); }}>Record: Insurance bound</button>
                      )}
                    </span>
                    {next && <button onClick={async () => { await addEscrowMilestone(userId!, f.id!, next); setMilestones({ ...milestones, [f.id!]: [...names, next] }); setSavedMsg(`Milestone recorded: ${next}`); }}>Record next step: {next}</button>}{' '}
                    <label>EMD: <select value={f.emd_status || 'awaiting_wire'} onChange={async (e) => { const v = e.target.value; await updateEscrowFileStatus(f.id!, { emd_status: v }); setFiles(files.map((x) => (x.id === f.id ? { ...x, emd_status: v } : x))); }}>
                      <option value="awaiting_wire">Awaiting</option>
                      <option value="received_verified">Received</option>
                      <option value="deficient_cancelled">Deficient / cancelled</option>
                    </select></label>{' '}
                    <label>Title search: <select value={f.title_search_status || 'not_started'} onChange={async (e) => { const v = e.target.value; await updateEscrowFileStatus(f.id!, { title_search_status: v }); setFiles(files.map((x) => (x.id === f.id ? { ...x, title_search_status: v } : x))); }}>
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="issues_found">Issues found</option>
                      <option value="clear_title">Clear title</option>
                    </select></label>
                  </span>
                );
              })()}
            </li>
          ))}
        </ul>
      )}
      {userId && <SellerAdvanceRequest userId={userId} dealId={dealId || null} />}
      {isOperator && <OperatorAdvanceReview operatorEmail={myEmail} />}
      <p style={{ fontSize: 12, color: '#94a3b8' }}>Mark the outcome honestly when a file ends — it becomes part of the buyer’s earned record that other wholesalers see at offer time.</p>
      <AutopsyLessons />
    </section>
  );
}

// Slice 122 — operator review list for seller moving advance
// requests. The operator sees every request in the Escrow desk and
// moves it through review. Approving here does not move money —
// the advance itself is agreed outside this table and repaid out
// of closing proceeds. No email is sent.
function OperatorAdvanceReview({ operatorEmail }: { operatorEmail: string | null }) {
  const [rows, setRows] = useState<AdvanceRow[]>([]);
  const [msg, setMsg] = useState('');
  const refresh = () => {
    if (operatorEmail !== OPERATOR_EMAIL) return;
    loadAllAdvanceRequestsForOperator(operatorEmail).then(setRows).catch(() => {});
  };
  useEffect(refresh, [operatorEmail]);
  if (operatorEmail !== OPERATOR_EMAIL) return null;
  const move = async (id: string, status: SellerAdvanceStatus) => {
    try {
      await setAdvanceStatus(id, status, operatorEmail);
      setMsg(`Request moved to ${status}.`);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not move the request.');
    }
  };
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff', marginTop: 12, color: '#0f172a' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Operator desk — seller advance requests</h3>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
        Requests only — no advance is promised or guaranteed by a request, and approving one here moves no money. Any advance is agreed
        separately and repaid out of closing proceeds.
      </p>
      {msg && <p style={{ fontSize: 13, color: '#0f766e' }}>{msg}</p>}
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: '#64748b' }}>No seller advance requests yet.</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} style={{ borderTop: '1px solid #f1f5f9', padding: '8px 0' }}>
            <p style={{ fontSize: 13, margin: '0 0 6px' }}>
              <strong>${Number(r.amount_requested).toLocaleString()}</strong> — {r.seller_name || 'seller not named'} — status:{' '}
              <strong>{r.status}</strong> · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
              {r.reason ? <><br />Reason: {r.reason}</> : null}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['under_review', 'approved', 'declined', 'repaid'] as SellerAdvanceStatus[]).map((s) => (
                <button
                  key={s}
                  disabled={r.status === s}
                  onClick={() => move(r.id!, s)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: r.status === s ? 'default' : 'pointer', fontSize: 12, opacity: r.status === s ? 0.5 : 1 }}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
