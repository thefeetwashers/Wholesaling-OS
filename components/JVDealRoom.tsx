import React, { useCallback, useEffect, useState } from 'react';
import {
  postJvListing,
  loadOpenJvListings,
  loadMyJvListings,
  loadMyJvInterests,
  loadInterestsForListing,
  expressJvInterest,
  acceptJvInterest,
  declineJvInterest,
  withdrawJvInterest,
  deleteJvListing,
  isVerifiedOperator,
  type JvListing,
  type JvInterest,
  type JvPropertyType,
} from '../lib/jv-room';
import { loadMyProfile, loadSellerPageSettings } from '../lib/portals';
import { US_STATES } from '../lib/funding';
import { buildJVSplitAgreement, JV_SPLIT_MERGE_TAGS, ATTORNEY_REVIEW_BANNER } from '../lib/contracts';

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 3,
  padding: 8,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 14,
  boxSizing: 'border-box',
};

function VerifiedOperatorBadge() {
  return (
    <span
      title="Completed the 7-day bootcamp and passed the Day 7 check"
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 700,
        color: '#0f766e',
        background: '#ccfbf1',
        border: '1px solid #99f6e4',
        borderRadius: 999,
        padding: '2px 8px',
        marginLeft: 6,
        verticalAlign: 'middle',
      }}
    >
      ✓ Verified Operator
    </span>
  );
}

// ---------------------------------------------------------------------------
// JV Split Agreement — offered only when a listing is partnered, i.e.
// both sides opted in. Party A = originator (100 − proposed split),
// Party B = partner (proposed split). The property address is typed
// in here by the originator — it was never shown in the room before
// the match. Generating is not signing; the agreement carries the
// attorney-review banner top and bottom.
// ---------------------------------------------------------------------------

function JvAgreementForm({
  listing,
  interest,
  myEmail,
  myCompany,
  iAmOriginator,
  onClose,
}: {
  listing: JvListing;
  interest: JvInterest;
  myEmail: string;
  myCompany: string;
  iAmOriginator: boolean;
  onClose: () => void;
}) {
  const partnerEmail = iAmOriginator ? interest.wholesaler_email || '' : interest.originator_email || '';
  const originatorEmail = iAmOriginator ? myEmail : interest.originator_email || '';
  const proposed = Number(listing.proposed_jv_split_percent ?? 50);
  const [f, setF] = useState({
    effective_date: today(),
    party_a_entity: iAmOriginator ? myCompany : '',
    party_a_state: 'FL',
    party_a_address: '',
    party_a_email: originatorEmail,
    party_a_phone: '',
    party_b_entity: iAmOriginator ? '' : myCompany,
    party_b_state: 'FL',
    party_b_address: '',
    party_b_email: partnerEmail,
    party_b_phone: '',
    contract_date: '',
    property_address: '',
    title_company: '',
    title_officer_email: '',
    closing_date: '',
    property_state: listing.property_state || 'FL',
    party_a_signer: '',
    party_a_title: '',
    party_b_signer: '',
    party_b_title: '',
  });
  const [referralPaid, setReferralPaid] = useState('');
  const [dealExpenses, setDealExpenses] = useState('');
  const [contractPrice, setContractPrice] = useState(listing.contract_price != null ? String(listing.contract_price) : '');
  const [doc, setDoc] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const approvedExpenses =
    (referralPaid ? Number(referralPaid) : 0) + (dealExpenses ? Number(dealExpenses) : 0);

  const generate = () => {
    setDoc(
      buildJVSplitAgreement({
        ...f,
        contract_price: contractPrice ? Number(contractPrice) : null,
        party_a_split_percent: 100 - proposed,
        party_b_split_percent: proposed,
        approved_expenses: approvedExpenses,
      })
    );
  };
  const row = (label: string, key: keyof typeof f, type: string = 'text') => (
    <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
      {label}
      <input type={type} value={f[key]} onChange={set(key)} style={inputStyle} />
    </label>
  );
  return (
    <div style={{ border: '1px solid #99f6e4', background: '#f0fdfa', borderRadius: 10, padding: 12, marginTop: 10 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Generate JV Split Agreement</h4>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
        Both sides opted in, so the split can now be written down. Party A (originator) keeps {100 - proposed}% and Party B (partner) keeps{' '}
        {proposed}% — from the split you posted. The platform takes 0%: it is not a party to the split. Generating this document is not
        signing it — have licensed counsel review it first, then sign it between yourselves.
      </p>
      {row('Effective date', 'effective_date', 'date')}
      {row('Party A entity (originator)', 'party_a_entity')}
      {row('Party A state', 'party_a_state')}
      {row('Party A address', 'party_a_address')}
      {row('Party A email', 'party_a_email', 'email')}
      {row('Party A phone', 'party_a_phone', 'tel')}
      {row('Party B entity (partner)', 'party_b_entity')}
      {row('Party B state', 'party_b_state')}
      {row('Party B address', 'party_b_address')}
      {row('Party B email', 'party_b_email', 'email')}
      {row('Party B phone', 'party_b_phone', 'tel')}
      {row('Underlying contract date', 'contract_date', 'date')}
      <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
        Property address (entered now — it was never shown in the room before the match)
        <input value={f.property_address} onChange={(e) => setF((p) => ({ ...p, property_address: e.target.value }))} placeholder="Full street address" style={inputStyle} />
      </label>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
        Contract price ($)
        <input type="number" value={contractPrice} onChange={(e) => setContractPrice(e.target.value)} style={inputStyle} />
      </label>
      {row('Title company', 'title_company')}
      {row('Title officer email', 'title_officer_email', 'email')}
      {row('Target closing date', 'closing_date', 'date')}
      <p style={{ fontSize: 13, margin: '0 0 8px' }}>
        Split: Party A <strong>{100 - proposed}%</strong> / Party B <strong>{proposed}%</strong> (from the posted listing)
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          Referral paid ($) — from the JV Split Calculator
          <input type="number" min={0} value={referralPaid} onChange={(e) => setReferralPaid(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          Deal expenses ($) — from the JV Split Calculator
          <input type="number" min={0} value={dealExpenses} onChange={(e) => setDealExpenses(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <p style={{ fontSize: 13, margin: '0 0 8px' }}>
        Approved expenses: <strong>${approvedExpenses.toLocaleString()}</strong> — this is the total deducted from the gross fee before the
        split.
      </p>
      {row('Property state (governing law)', 'property_state')}
      {row('Party A signer', 'party_a_signer')}
      {row('Party A title', 'party_a_title')}
      {row('Party B signer', 'party_b_signer')}
      {row('Party B title', 'party_b_title')}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <button
          onClick={generate}
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          Generate agreement
        </button>
        <button
          onClick={onClose}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
      {doc && (
        <div style={{ marginTop: 12 }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, maxHeight: 520, overflow: 'auto' }}>
            {doc}
          </pre>
          <p style={{ fontSize: 12, color: '#475569', margin: '8px 0' }}>Merge tags: {JV_SPLIT_MERGE_TAGS.join(', ')}</p>
          <button
            onClick={() => window.print()}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Print / save as PDF
          </button>
          <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>{ATTORNEY_REVIEW_BANNER}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JV Deal Room
// ---------------------------------------------------------------------------

export default function JVDealRoom({ userId }: { userId: string }) {
  const [open, setOpen] = useState<JvListing[]>([]);
  const [mine, setMine] = useState<JvListing[]>([]);
  const [myInterests, setMyInterests] = useState<JvInterest[]>([]);
  const [interestsByListing, setInterestsByListing] = useState<Record<string, JvInterest[]>>({});
  const [badges, setBadges] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [myEmail, setMyEmail] = useState('');
  const [myCompany, setMyCompany] = useState('');
  const [agreementFor, setAgreementFor] = useState<{ listing: JvListing; interest: JvInterest; iAmOriginator: boolean } | null>(null);

  // Post form state
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [type, setType] = useState<JvPropertyType>('house');
  const [contractPrice, setContractPrice] = useState('');
  const [arv, setArv] = useState('');
  const [repairs, setRepairs] = useState('');
  const [split, setSplit] = useState('50');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    loadOpenJvListings()
      .then(setOpen)
      .catch((e: any) => setErr(e?.message || 'Could not load open JV listings.'));
    loadMyJvListings(userId)
      .then((rows) => {
        setMine(rows);
        rows.forEach((l) => {
          loadInterestsForListing(l.id!)
            .then((ints) => setInterestsByListing((p) => ({ ...p, [l.id!]: ints })))
            .catch(() => {});
        });
      })
      .catch(() => {});
    loadMyJvInterests(userId)
      .then(setMyInterests)
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let live = true;
    loadMyProfile(userId)
      .then((p) => {
        if (live) setMyEmail(p?.email || '');
      })
      .catch(() => {});
    loadSellerPageSettings(userId)
      .then((s) => {
        if (live) setMyCompany(s?.company || '');
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  // Verified Operator badges: boolean only, looked up per originator.
  useEffect(() => {
    const ids = Array.from(new Set([...open.map((l) => l.originating_wholesaler_id), ...mine.map((l) => l.originating_wholesaler_id)])).filter(Boolean) as string[];
    ids.forEach((id) => {
      if (id in badges) return;
      isVerifiedOperator(id).then((v) => setBadges((p) => ({ ...p, [id]: v })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mine]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = Number(split);
    if (!Number.isFinite(s) || s < 0 || s > 100) {
      setErr('The partner split must be a percent between 0 and 100.');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await postJvListing(userId, {
        property_city: city,
        property_state: state,
        property_type: type,
        contract_price: contractPrice ? Number(contractPrice) : null,
        estimated_arv: arv ? Number(arv) : null,
        estimated_repairs: repairs ? Number(repairs) : null,
        proposed_jv_split_percent: s,
        deal_summary: summary,
      });
      setCity('');
      setContractPrice('');
      setArv('');
      setRepairs('');
      setSplit('50');
      setSummary('');
      setMsg('JV listing posted. Wholesalers browsing the room can see the city, prices, and split — never the street address or seller contact.');
      refresh();
    } catch (ex: any) {
      setErr(ex?.message || 'The listing could not be posted.');
    } finally {
      setBusy(false);
    }
  };

  const express = async (listing: JvListing, message: string) => {
    setErr('');
    setMsg('');
    try {
      await expressJvInterest(userId, myEmail, listing.id!, message);
      setMsg('Interest recorded. Your email was shared with the originator — they can accept it, and then you can both see each other’s contact. Until they accept, you will see “waiting for the originator”.');
      refresh();
    } catch (ex: any) {
      setErr(ex?.message || 'Interest could not be recorded.');
    }
  };

  const accept = async (interest: JvInterest, listingId: string) => {
    setErr('');
    try {
      await acceptJvInterest(interest.id!, listingId, myEmail);
      setMsg('JV matched. Both sides can now see each other’s contact, and the JV Split Agreement can be generated below.');
      refresh();
    } catch (ex: any) {
      setErr(ex?.message || 'Accept failed.');
    }
  };

  const myInterestFor = (listingId: string) => myInterests.find((i) => i.jv_listing_id === listingId);

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>JV Deal Room — Joint Venture &amp; Co-Wholesaling</h2>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>
        Split the work, split the fee. Post a deal you need a partner on, or browse open deals from other wholesalers. Listings show city,
        state, type, prices, and split only — never a street address or seller contact. Partnering is a mutual opt-in: your email is shared
        with the originator when you express interest, and theirs is shared with you only when they accept. The JV split agreement is
        generated after a match; it is not signed in-app. The platform takes 0% of any JV split.
      </p>
      {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
      {msg && <p style={{ color: '#0f766e', fontSize: 13 }}>{msg}</p>}

      <form onSubmit={post} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Post a JV deal</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'block', fontSize: 13 }}>
            City *
            <input required value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'block', fontSize: 13 }}>
            State *
            <select value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'block', fontSize: 13 }}>
            Property type
            <select value={type} onChange={(e) => setType(e.target.value as JvPropertyType)} style={inputStyle}>
              <option value="house">House</option>
              <option value="land">Land</option>
              <option value="multifamily">Multifamily</option>
            </select>
          </label>
          <label style={{ display: 'block', fontSize: 13 }}>
            Partner split % (what the partner keeps)
            <input type="number" min={0} max={100} value={split} onChange={(e) => setSplit(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'block', fontSize: 13 }}>
            Contract price ($)
            <input type="number" min={0} value={contractPrice} onChange={(e) => setContractPrice(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'block', fontSize: 13 }}>
            Estimated ARV ($)
            <input type="number" min={0} value={arv} onChange={(e) => setArv(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'block', fontSize: 13 }}>
            Estimated repairs ($)
            <input type="number" min={0} value={repairs} onChange={(e) => setRepairs(e.target.value)} style={inputStyle} />
          </label>
        </div>
        <label style={{ display: 'block', fontSize: 13, marginTop: 8 }}>
          Deal summary (no street address, no seller name or contact)
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} style={inputStyle} placeholder="e.g. 3/2 SFR, roof 2019, seller motivated, 21-day close. JV partner brings the cash buyer." />
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{ marginTop: 10, padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Posting…' : 'Post JV listing'}
        </button>
      </form>

      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Open JV deals</h3>
      {open.length === 0 ? (
        <p style={{ fontSize: 13, color: '#64748b' }}>No open JV deals right now. Post the first one above.</p>
      ) : (
        open.map((l) => {
          const isMine = l.originating_wholesaler_id === userId;
          const interest = myInterestFor(l.id!);
          const badge = l.originating_wholesaler_id ? badges[l.originating_wholesaler_id] : false;
          return (
            <div key={l.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {l.property_city || 'City not given'}
                {l.property_state ? `, ${l.property_state}` : ''}
                {l.property_type ? ` · ${l.property_type}` : ''}
                {badge && <VerifiedOperatorBadge />}
              </div>
              <p style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>
                Contract {money(l.contract_price)} · ARV {money(l.estimated_arv)} · Repairs {money(l.estimated_repairs)} · Partner keeps{' '}
                {l.proposed_jv_split_percent}%
              </p>
              {l.deal_summary && <p style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>{l.deal_summary}</p>}
              <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0' }}>
                Posted {l.created_at ? new Date(l.created_at).toLocaleDateString() : ''}
              </p>
              {isMine ? (
                <p style={{ fontSize: 13, color: '#0f766e', margin: '4px 0 0' }}>This is your listing — manage interests below.</p>
              ) : interest ? (
                interest.status === 'accepted' ? (
                  <div>
                    <p style={{ fontSize: 13, color: '#0f766e', margin: '4px 0' }}>
                      ✓ Matched — originator contact: {interest.originator_email || 'not shared yet'}
                    </p>
                    <button
                      onClick={() => setAgreementFor({ listing: l, interest, iAmOriginator: false })}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                    >
                      Generate JV Split Agreement
                    </button>
                  </div>
                ) : interest.status === 'declined' ? (
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>The originator declined this interest.</p>
                ) : (
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>
                    Waiting for the originator — your email was shared with them when you expressed interest.
                    <button
                      onClick={() => withdrawJvInterest(interest.id!).then(refresh)}
                      style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 }}
                    >
                      Withdraw interest
                    </button>
                  </p>
                )
              ) : (
                <button
                  onClick={() => express(l, '')}
                  style={{ marginTop: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  I’m interested — share my email with the originator
                </button>
              )}
            </div>
          );
        })
      )}

      <h3 style={{ margin: '16px 0 8px', fontSize: 16 }}>My JV listings</h3>
      {mine.length === 0 ? (
        <p style={{ fontSize: 13, color: '#64748b' }}>You have not posted a JV listing yet.</p>
      ) : (
        mine.map((l) => {
          const ints = interestsByListing[l.id!] || [];
          const accepted = ints.find((i) => i.status === 'accepted');
          return (
            <div key={l.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {l.property_city || 'City not given'}
                {l.property_state ? `, ${l.property_state}` : ''} · Partner keeps {l.proposed_jv_split_percent}% · Status: {l.status}
              </div>
              {ints.length === 0 ? (
                <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0' }}>No interest yet.</p>
              ) : (
                ints.map((i) => (
                  <div key={i.id} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 8 }}>
                    <p style={{ fontSize: 13, margin: '0 0 6px' }}>
                      Interest from {i.wholesaler_email || 'a wholesaler'} — {i.status}
                      {i.message ? ` · “${i.message}”` : ''}
                    </p>
                    {i.status === 'interested' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => accept(i, l.id!)}
                          style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                        >
                          Accept — share my email &amp; partner up
                        </button>
                        <button
                          onClick={() => declineJvInterest(i.id!).then(refresh)}
                          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
              {l.status === 'partnered' && accepted && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 13, color: '#0f766e', margin: '0 0 6px' }}>
                    ✓ Partnered with {accepted.wholesaler_email}. Both sides can now see each other’s contact.
                  </p>
                  <button
                    onClick={() => setAgreementFor({ listing: l, interest: accepted, iAmOriginator: true })}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    Generate JV Split Agreement
                  </button>
                </div>
              )}
              {l.status === 'open' && (
                <button
                  onClick={() => deleteJvListing(l.id!).then(refresh)}
                  style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 }}
                >
                  Remove listing
                </button>
              )}
            </div>
          );
        })
      )}

      {agreementFor && (
        <JvAgreementForm
          listing={agreementFor.listing}
          interest={agreementFor.interest}
          myEmail={myEmail}
          myCompany={myCompany}
          iAmOriginator={agreementFor.iAmOriginator}
          onClose={() => setAgreementFor(null)}
        />
      )}
    </div>
  );
}
