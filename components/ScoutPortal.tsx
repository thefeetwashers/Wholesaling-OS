import React, { useCallback, useEffect, useState } from 'react';
import {
  submitScoutLead,
  loadMyScoutLeads,
  loadUnclaimedScoutLeads,
  loadMyClaimedScoutLeads,
  claimScoutLead,
  setScoutLeadStatus,
  setScoutLeadW9,
  setScoutLeadPhotos,
  signScoutPhotoUrls,
  uploadScoutPhoto,
  DISTRESS_TAGS,
  SCOUT_PAYOUT,
  type ScoutLead,
  type ScoutLeadStatus,
} from '../lib/scouts';
import { loadMyProfile, loadSellerPageSettings } from '../lib/portals';
import { US_STATES } from '../lib/funding';
import { buildScoutFinderFeeAgreement, SCOUT_FINDER_MERGE_TAGS, ATTORNEY_REVIEW_BANNER } from '../lib/contracts';
import ReferrerPortal from './ReferrerPortal';

type DistressTag = (typeof DISTRESS_TAGS)[number]['value'];

const STATUS_STEPS: { key: ScoutLeadStatus; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'claimed_reviewing', label: 'Claimed by Wholesaler' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'in_escrow', label: 'In Escrow' },
  { key: 'closed_paid_1000', label: 'Closed & $1,000 Paid' },
];

const STEP_INDEX: Record<ScoutLeadStatus, number> = {
  submitted: 0,
  claimed_reviewing: 1,
  under_contract: 2,
  in_escrow: 3,
  closed_paid_1000: 4,
  passed: -1,
};

const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Photos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!paths || paths.length === 0) return;
    let live = true;
    signScoutPhotoUrls(paths)
      .then((m) => {
        if (live) setUrls(paths.map((p) => m.get(p)).filter((u): u is string => !!u));
      })
      .catch((e: any) => {
        if (live) setErr(e?.message || 'Photos could not be loaded.');
      });
    return () => {
      live = false;
    };
  }, [paths]);
  if (!paths || paths.length === 0) return null;
  if (err) return <p style={{ fontSize: 13, color: '#b91c1c', margin: '6px 0' }}>Photos could not be loaded: {err}</p>;
  if (!urls) return <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0' }}>Loading photos…</p>;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
      {urls.map((u, i) => (
        <img key={i} src={u} alt={`Property photo ${i + 1}`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />
      ))}
    </div>
  );
}

function Tracker({ status }: { status: ScoutLeadStatus }) {
  if (status === 'passed') {
    return <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0' }}>Passed — the wholesaler passed on this property. No fee is owed for a passed lead.</p>;
  }
  const idx = STEP_INDEX[status];
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {STATUS_STEPS.map((s, i) => (
        <li
          key={s.key}
          style={{
            fontSize: 12,
            fontWeight: i <= idx ? 700 : 400,
            color: i <= idx ? '#0f766e' : '#94a3b8',
            background: i <= idx ? '#ccfbf1' : '#f8fafc',
            border: `1px solid ${i <= idx ? '#99f6e4' : '#e2e8f0'}`,
            padding: '4px 8px',
            borderRadius: 999,
          }}
        >
          {i <= idx ? '✓ ' : ''}
          {s.label}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Scout Finder's Fee Agreement — generated only for a CLAIMED lead.
// Fields are filled from the lead + the current user's profile; the
// rest is typed in by the person generating it. Generation is not
// signing and not a promise — the $1,000 is owed only when the deal
// closes and funds (see Section 3 of the agreement).
// ---------------------------------------------------------------------------

function ScoutAgreementForm({
  lead,
  myEmail,
  myCompany,
  viewerIsWholesaler,
  onClose,
}: {
  lead: ScoutLead;
  myEmail: string;
  myCompany: string;
  viewerIsWholesaler: boolean;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    effective_date: today(),
    wholesaler_entity: viewerIsWholesaler ? myCompany : '',
    wholesaler_state: 'FL',
    wholesaler_address: '',
    wholesaler_email: viewerIsWholesaler ? myEmail : '',
    wholesaler_phone: '',
    scout_name: '',
    scout_address: '',
    scout_email: viewerIsWholesaler ? '' : myEmail,
    scout_phone: '',
    property_address: `${lead.property_address || ''}, ${lead.city || ''}, ${lead.state || 'FL'} ${lead.zip_code || ''}`.replace(/^,\s*/, '').trim(),
    submission_date: lead.created_at ? new Date(lead.created_at).toLocaleString() : '',
    title_company: '',
    title_officer_email: '',
    property_state: lead.state || 'FL',
    wholesaler_signer: '',
  });
  const [doc, setDoc] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const generate = () => {
    setDoc(
      buildScoutFinderFeeAgreement({
        ...f,
        payout_amount: Number(lead.payout_amount ?? SCOUT_PAYOUT),
      })
    );
  };
  const row = (label: string, key: keyof typeof f, type: string = 'text') => (
    <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
      {label}
      <input
        type={type}
        value={f[key]}
        onChange={set(key)}
        style={{ display: 'block', width: '100%', marginTop: 3, padding: 7, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
      />
    </label>
  );
  return (
    <div style={{ border: '1px solid #99f6e4', background: '#f0fdfa', borderRadius: 10, padding: 12, marginTop: 10 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Generate Scout Finder&apos;s Fee Agreement</h4>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
        Fill in the missing parties — the agreement is generated as a template with an attorney-review flag. Generating it is not signing it,
        and it does not promise a fee: the {fmt(Number(lead.payout_amount ?? SCOUT_PAYOUT))} is owed only if this lead closes and funds within 180 days of
        submission. A lead that is still unclaimed cannot generate this agreement at all.
      </p>
      {row('Effective date', 'effective_date', 'date')}
      {row('Wholesaler entity (Principal)', 'wholesaler_entity')}
      {row('Wholesaler state', 'wholesaler_state')}
      {row('Wholesaler address', 'wholesaler_address')}
      {row('Wholesaler email', 'wholesaler_email', 'email')}
      {row('Wholesaler phone', 'wholesaler_phone', 'tel')}
      {row('Scout name', 'scout_name')}
      {row('Scout address', 'scout_address')}
      {row('Scout email', 'scout_email', 'email')}
      {row('Scout phone', 'scout_phone', 'tel')}
      {row('Property address', 'property_address')}
      {row('Submission date / timestamp', 'submission_date')}
      {row('Title company', 'title_company')}
      {row('Title officer email', 'title_officer_email', 'email')}
      {row('Property state', 'property_state')}
      {row('Wholesaler signer', 'wholesaler_signer')}
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
          <p style={{ fontSize: 12, color: '#475569', margin: '8px 0' }}>Merge tags: {SCOUT_FINDER_MERGE_TAGS.join(', ')}</p>
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
// Scout submit form
// ---------------------------------------------------------------------------

function ScoutSubmitForm({ userId, onSubmitted }: { userId: string; onSubmitted: () => void }) {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<DistressTag[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const inputStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: 3, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };

  const toggleTag = (t: DistressTag) =>
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files || []);
    const valid: File[] = [];
    const problems: string[] = [];
    for (const f of chosen) {
      if (!f.type.startsWith('image/')) problems.push(`${f.name}: not an image.`);
      else if (f.size > 5 * 1024 * 1024) problems.push(`${f.name}: over 5 MB.`);
      else valid.push(f);
    }
    if (valid.length + files.length > 6) {
      problems.push('At most 6 photos per lead.');
    }
    setFiles((p) => [...p, ...valid].slice(0, 6));
    if (problems.length) setErr(problems.join(' '));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const lead = await submitScoutLead(userId, {
        property_address: address,
        city,
        state,
        zip_code: zip,
        distress_tags: tags,
        photo_urls: [],
        seller_notes: notes,
      });
      let uploaded: string[] = [];
      let photoError = '';
      for (const file of files) {
        try {
          uploaded.push(await uploadScoutPhoto(userId, lead.id!, file));
        } catch (up: any) {
          photoError = up?.message || 'Photo upload failed.';
          break;
        }
      }
      if (uploaded.length) {
        try {
          await setScoutLeadPhotos(lead.id!, uploaded);
        } catch (up: any) {
          photoError = up?.message || 'Photos could not be attached.';
        }
      }
      setAddress('');
      setCity('');
      setState('FL');
      setZip('');
      setNotes('');
      setTags([]);
      setFiles([]);
      setMsg(
        photoError
          ? `Lead submitted — but photos did not upload: ${photoError} The lead is in the queue; photos can be added once photo storage is set up.`
          : 'Lead submitted. It is now visible to wholesalers to claim — you can track it live below.'
      );
      onSubmitted();
    } catch (ex: any) {
      setErr(ex?.message || 'Submission failed. Nothing was submitted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 10 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Snap &amp; Submit Distressed Property</h3>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
        Snap a photo from your phone, track it live, and earn {fmt(SCOUT_PAYOUT)} at the title company closing table — only when the deal closes
        and funds. You never contact the owner, negotiate, or market the property: that is the wholesaler&apos;s job. Your role is information
        only.
      </p>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
        Property address *
        <input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" style={inputStyle} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          State
          <select value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
          ZIP
          <input value={zip} onChange={(e) => setZip(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 8, margin: '0 0 8px', padding: '8px 10px' }}>
        <legend style={{ fontSize: 13, fontWeight: 700 }}>What you observed (check all that apply)</legend>
        {DISTRESS_TAGS.map((t) => (
          <label key={t.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, margin: '4px 12px 4px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={tags.includes(t.value)} onChange={() => toggleTag(t.value)} />
            {t.label}
          </label>
        ))}
        <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>
          Only check what you actually saw, from public view. Do not enter the property or contact the owner.
        </p>
      </fieldset>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
        Photos (up to 6, 5 MB each, from public view)
        <input type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'block', marginTop: 4, fontSize: 13 }} />
        {files.length > 0 && <span style={{ fontSize: 12, color: '#475569' }}>{files.length} photo(s) selected: {files.map((f) => f.name).join(', ')}</span>}
      </label>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
        Notes (what you saw, in your own words)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={inputStyle} />
      </label>
      {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
      {msg && <p style={{ color: '#0f766e', fontSize: 13 }}>{msg}</p>}
      <button
        type="submit"
        disabled={busy}
        style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
      >
        {busy ? 'Submitting…' : 'Submit this property'}
      </button>
      <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
        No fee is owed for a submission alone. The {fmt(SCOUT_PAYOUT)} is paid only if an unclaimed, actionable lead results in a closed
        acquisition or assignment within 180 days — $0 if it does not close. See the Scout Finder&apos;s Fee Agreement for the full terms.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Scout's own submissions + tracker
// ---------------------------------------------------------------------------

function MyScoutLeads({ userId, myEmail, myCompany, refreshKey }: { userId: string; myEmail: string; myCompany: string; refreshKey: number }) {
  const [leads, setLeads] = useState<ScoutLead[]>([]);
  const [err, setErr] = useState('');
  const [agreementFor, setAgreementFor] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadMyScoutLeads(userId)
      .then((rows) => {
        if (live) setLeads(rows);
      })
      .catch((e: any) => {
        if (live) setErr(e?.message || 'Could not load your submissions.');
      });
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);
  if (err) return <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>;
  if (!leads.length) {
    return (
      <p style={{ fontSize: 13, color: '#64748b', margin: '10px 0' }}>
        You have not submitted any properties yet. When you do, their live status appears here — Submitted → Claimed → Under Contract → In Escrow
        → Closed &amp; {fmt(SCOUT_PAYOUT)} Paid.
      </p>
    );
  }
  return (
    <div style={{ marginTop: 10 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>My submitted properties</h3>
      {leads.map((l) => (
        <div key={l.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {l.property_address}
            {l.city ? `, ${l.city}` : ''}
            {l.state ? `, ${l.state}` : ''}
          </div>
          <Tracker status={l.status || 'submitted'} />
          <Photos paths={l.photo_urls || []} />
          {(l.distress_tags || []).length > 0 && (
            <p style={{ fontSize: 12, color: '#475569', margin: '4px 0' }}>
              Observed: {(l.distress_tags || []).map((t) => DISTRESS_TAGS.find((d) => d.value === t)?.label || t).join(', ')}
            </p>
          )}
          {l.seller_notes && <p style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>{l.seller_notes}</p>}
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            Submitted {l.created_at ? new Date(l.created_at).toLocaleString() : ''} · Payout if it closes and funds: {fmt(Number(l.payout_amount ?? SCOUT_PAYOUT))}
          </p>
          {l.status !== 'submitted' ? (
            <>
              <button
                onClick={() => setAgreementFor(agreementFor === l.id ? null : l.id || null)}
                style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, cursor: 'pointer' }}
              >
                {agreementFor === l.id ? 'Hide agreement' : "Generate Scout Finder's Fee Agreement"}
              </button>
              {agreementFor === l.id && (
                <ScoutAgreementForm lead={l} myEmail={myEmail} myCompany={myCompany} viewerIsWholesaler={false} onClose={() => setAgreementFor(null)} />
              )}
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
              Still unclaimed. The finder&apos;s fee agreement is generated only after a wholesaler claims this lead.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wholesaler browse / claim board (exported for the wholesaler dashboard)
// ---------------------------------------------------------------------------

export function ScoutClaimBoard({ userId, onClaimed }: { userId: string; onClaimed?: () => void }) {
  const [leads, setLeads] = useState<ScoutLead[]>([]);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(() => {
    loadUnclaimedScoutLeads()
      .then(setLeads)
      .catch((e: any) => setErr(e?.message || 'Could not load scout leads.'));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const claim = async (leadId: string) => {
    setBusyId(leadId);
    setErr('');
    try {
      await claimScoutLead(leadId, userId);
      load();
      onClaimed?.();
    } catch (e: any) {
      setErr(e?.message || 'Claim failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Scout leads — unclaimed</h3>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
        Properties spotted by scouts, waiting for a wholesaler to claim them. Claiming moves the lead into your sealed office — the scout can
        still see it, nobody else can — and you own the owner outreach from there.
      </p>
      {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
      {leads.length === 0 ? (
        <p style={{ fontSize: 13, color: '#64748b' }}>
          No unclaimed scout leads right now. When a scout submits one, it appears here.
        </p>
      ) : (
        leads.map((l) => (
          <div key={l.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {l.property_address}
              {l.city ? `, ${l.city}` : ''}
              {l.state ? `, ${l.state}` : ''}
            </div>
            <Photos paths={l.photo_urls || []} />
            {(l.distress_tags || []).length > 0 && (
              <p style={{ fontSize: 12, color: '#475569', margin: '4px 0' }}>
                Observed: {(l.distress_tags || []).map((t) => DISTRESS_TAGS.find((d) => d.value === t)?.label || t).join(', ')}
              </p>
            )}
            {l.seller_notes && <p style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>{l.seller_notes}</p>}
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 8px' }}>
              Submitted {l.created_at ? new Date(l.created_at).toLocaleString() : ''} · Scout payout if it closes and funds: {fmt(Number(l.payout_amount ?? SCOUT_PAYOUT))}
            </p>
            <button
              onClick={() => claim(l.id!)}
              disabled={busyId === l.id}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busyId === l.id ? 'wait' : 'pointer' }}
            >
              {busyId === l.id ? 'Claiming…' : 'Claim this lead'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wholesaler's claimed leads — status tracking + agreement generation
// ---------------------------------------------------------------------------

export function MyClaimedLeads({
  userId,
  refreshKey,
}: {
  userId: string;
  refreshKey?: number;
}) {
  const [leads, setLeads] = useState<ScoutLead[]>([]);
  const [err, setErr] = useState('');
  const [agreementFor, setAgreementFor] = useState<string | null>(null);
  const [myEmail, setMyEmail] = useState('');
  const [myCompany, setMyCompany] = useState('');
  const [isOperator, setIsOperator] = useState(false);
  const OPERATOR_EMAIL = 'thefeetwashers@gmail.com';
  const load = useCallback(() => {
    loadMyClaimedScoutLeads(userId)
      .then(setLeads)
      .catch((e: any) => setErr(e?.message || 'Could not load your claimed leads.'));
  }, [userId]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  useEffect(() => {
    let live = true;
    loadMyProfile(userId)
      .then((p) => {
        if (live) {
          setMyEmail(p?.email || '');
          setIsOperator((p?.email || '').toLowerCase() === OPERATOR_EMAIL);
        }
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

  const advance = async (lead: ScoutLead, status: ScoutLeadStatus) => {
    setErr('');
    // Slice 130 — W-9 gate: no payout without the scout's W-9 on
    // file. The database CHECK enforces the same rule, so this
    // message is the friendly path, not the only guard.
    if (status === 'closed_paid_1000' && !lead.w9_received) {
      setErr('W-9 needed before payout — mark W-9 received first.');
      return;
    }
    try {
      await setScoutLeadStatus(lead.id!, status);
      load();
    } catch (e: any) {
      setErr(e?.message || 'Status update failed.');
    }
  };

  const toggleW9 = async (lead: ScoutLead, received: boolean) => {
    setErr('');
    try {
      await setScoutLeadW9(lead.id!, received);
      load();
    } catch (e: any) {
      setErr(e?.message || 'W-9 flag did not save.');
    }
  };

  if (!leads.length) {
    return (
      <p style={{ fontSize: 13, color: '#64748b', margin: '10px 0' }}>
        You have not claimed any scout leads yet. Claim one from the board above and it appears here, with its status tracker and the
        finder&apos;s fee agreement.
      </p>
    );
  }
  const nextOptions = (l: ScoutLead): { value: ScoutLeadStatus; label: string }[] => {
    const opts: { value: ScoutLeadStatus; label: string }[] = [];
    if (l.status === 'claimed_reviewing') opts.push({ value: 'under_contract', label: 'Mark Under Contract' });
    if (l.status === 'under_contract') opts.push({ value: 'in_escrow', label: 'Mark In Escrow' });
    if (l.status === 'in_escrow' && isOperator) opts.push({ value: 'closed_paid_1000', label: 'Mark Closed — $1,000 Paid' });
    if (l.status !== 'passed' && l.status !== 'closed_paid_1000') opts.push({ value: 'passed', label: 'Pass on this lead' });
    return opts;
  };
  return (
    <div style={{ marginTop: 12 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>My claimed scout leads</h3>
      {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
      {leads.map((l) => (
        <div key={l.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {l.property_address}
            {l.city ? `, ${l.city}` : ''}
            {l.state ? `, ${l.state}` : ''}
          </div>
          <Tracker status={l.status || 'claimed_reviewing'} />
          <Photos paths={l.photo_urls || []} />
          {l.seller_notes && <p style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>{l.seller_notes}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {nextOptions(l).map((o) => (
              <button
                key={o.value}
                onClick={() => advance(l, o.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={() => setAgreementFor(agreementFor === l.id ? null : l.id || null)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
            >
              {agreementFor === l.id ? 'Hide agreement' : "Generate Scout Finder's Fee Agreement"}
            </button>
          </div>
          {l.status === 'in_escrow' && !isOperator && (
            <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
              &quot;Closed — $1,000 Paid&quot; is marked by the operator when the money is paid at the closing table.
            </p>
          )}
          {/* Slice 130 — W-9 gate. The checkbox is ticked by the
              claiming wholesaler (or the operator) once the scout's
              IRS Form W-9 is on file; the finder&apos;s fee agreement
              pays only "upon receipt of the Scout's completed IRS
              Form W-9", and the lead cannot move to Closed &amp; Paid
              without it. */}
          <label style={{ display: 'block', fontSize: 13, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={l.w9_received === true}
              onChange={(e) => toggleW9(l, e.target.checked)}
            />{' '}
            W-9 received — the scout&apos;s IRS Form W-9 is on file
            {l.w9_received && l.w9_received_at ? ` (marked ${new Date(l.w9_received_at).toLocaleDateString()})` : ''}
          </label>
          {l.status === 'in_escrow' && !l.w9_received && (
            <p style={{ fontSize: 12, color: '#b45309', margin: '6px 0 0' }}>
              W-9 needed before payout — mark W-9 received first.
            </p>
          )}
          {agreementFor === l.id && (
            <ScoutAgreementForm lead={l} myEmail={myEmail} myCompany={myCompany} viewerIsWholesaler={true} onClose={() => setAgreementFor(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScoutPortal — the Referrer door. The scout form is first; the
// existing "Know a seller?" referrer flow (ReferrerPortal) stays
// below it, and wholesalers see the claim board + their claimed
// leads. Which door the user is determines the role: the PortalHome
// Referrer door renders this whole component, and the Wholesaler
// office renders ScoutClaimBoard + MyClaimedLeads directly.
// ---------------------------------------------------------------------------

export default function ScoutPortal({
  userId,
  role,
  showWholesalerSections = false,
}: {
  userId: string;
  role: string | null;
  showWholesalerSections?: boolean;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [myEmail, setMyEmail] = useState('');
  const [myCompany, setMyCompany] = useState('');
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
  const isWholesaler = role === 'wholesaler' || role === 'admin' || role === 'operator';
  const showBoard = showWholesalerSections || isWholesaler;

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Scout &amp; Referrer Door</h2>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
        Free. Spot a vacant or distressed property? Snap a photo from your phone, track it live, and earn {fmt(SCOUT_PAYOUT)} at the title
        company closing table. Or, if you know a seller directly, refer them below — the same {fmt(SCOUT_PAYOUT)} on a closed deal.
      </p>
      <ScoutSubmitForm userId={userId} onSubmitted={() => setRefreshKey((k) => k + 1)} />
      <MyScoutLeads userId={userId} myEmail={myEmail} myCompany={myCompany} refreshKey={refreshKey} />
      {showBoard && (
        <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
          <ScoutClaimBoard userId={userId} onClaimed={() => setRefreshKey((k) => k + 1)} />
          <MyClaimedLeads userId={userId} refreshKey={refreshKey} />
        </div>
      )}
      <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Know a seller?</h3>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
          If you know the seller personally, refer them directly instead — the same {fmt(SCOUT_PAYOUT)} when the deal closes and funds.
        </p>
        <ReferrerPortal userId={userId} />
      </div>
    </div>
  );
}
