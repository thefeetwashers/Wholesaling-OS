'use client';

// Slice 135 — Realtor pocket listings, operator-only table.
//
// Rendered in ONE existing operator view (the coordinator adds the
// render line; this file only defines the table, it does not wire
// itself in). The operator sees every agent submission, newest
// first, and promotes the ones worth publishing.
//
// Privacy: the street address, agent commission %, and relist
// terms live ONLY in this operator-only table. Promoting a listing
// inserts into public.published_deals with city/state/ZIP ONLY —
// never the street address — asking_price = agent net + the
// markup the operator types in (empty input, never a default),
// arv_low = arv_high = estimated ARV when given, property_type
// null (the intake form does not collect one), and notes that say
// only "Off-market pocket listing via licensed agent" — no terms.
// The pocket row then flips to status 'approved'.
//
// NO auto-blast: nothing is sent anywhere by this component. After
// promoting, the operator is pointed to the existing human-tap
// Cash Buyers deal blast (components/CashBuyersDealBlast.tsx),
// which copies text or opens the operator's own mail client with
// BCC — the app never sends email itself.
//
// RLS is the real gate (operator-only SELECT / UPDATE via
// public.is_operator(), migration 20261117150000). This component
// also checks is_operator() on load and renders an operator-only
// note for anyone else, so a non-operator never sees a row. A
// missing table (migration not applied yet) shows its own plain
// note instead of breaking the panel.

import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase';

export interface RealtorPocketListing {
  id: string;
  created_at: string;
  agent_name: string;
  brokerage: string | null;
  agent_email: string;
  agent_phone: string;
  property_address: string;
  city: string;
  state_code: string;
  zip: string;
  asking_price: number;
  estimated_arv: number | null;
  commission_percent: number | null;
  wants_relist: boolean;
  property_notes: string | null;
  status: string;
}

const money = (n: number | null | undefined): string =>
  n == null ? 'not provided' : `$${Math.round(n).toLocaleString()}`;

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /does not exist|relation .* does not exist|PGRST205|column .* does not exist|PGRST204/i.test(msg);
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};

export default function RealtorPocketListings({ userId, operatorEmail }: { userId: string; operatorEmail: string | null }) {
  const [rows, setRows] = useState<RealtorPocketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOperator, setIsOperator] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [markups, setMarkups] = useState<Record<string, string>>({});
  const [promotedIds, setPromotedIds] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMissing(false);
    setError('');
    try {
      if (!supabaseConfigured || !supabase) {
        setError('Supabase is not configured on this deployment — pocket listings cannot load.');
        setRows([]);
        return;
      }
      const { data: op, error: opErr } = await supabase.rpc('is_operator');
      if (opErr || !op) {
        setIsOperator(false);
        setRows([]);
        return;
      }
      setIsOperator(true);
      const { data, error: loadErr } = await supabase
        .from('realtor_pocket_listings')
        .select('*')
        .order('created_at', { ascending: false });
      if (loadErr) throw new Error(loadErr.message || 'Could not load pocket listings.');
      setRows((data || []) as RealtorPocketListing[]);
    } catch (e) {
      if (isMissingTable(e)) {
        setMissing(true);
      } else {
        setError(e instanceof Error ? e.message : 'Could not load pocket listings.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!operatorEmail) {
      setLoading(false);
      setIsOperator(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorEmail]);

  const setStatus = async (row: RealtorPocketListing, status: string) => {
    if (!supabase) return;
    setError('');
    setMsg('');
    setBusyId(row.id);
    try {
      const { error: updErr } = await supabase
        .from('realtor_pocket_listings')
        .update({ status })
        .eq('id', row.id);
      if (updErr) throw new Error(updErr.message || 'Status could not be updated.');
      setMsg(`Listing for ${row.city}, ${row.state_code} marked ${status}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const approveAndPromote = async (row: RealtorPocketListing) => {
    if (!supabase) return;
    const raw = (markups[row.id] || '').trim();
    if (raw === '') {
      setError('Type the assignment markup for this deal first — the markup box starts empty and must be filled in.');
      return;
    }
    const markup = Number(raw);
    if (!Number.isFinite(markup) || markup < 0) {
      setError('Assignment markup must be a number of 0 or more.');
      return;
    }
    setError('');
    setMsg('');
    setBusyId(row.id);
    try {
      // Publish first (city/state/ZIP only — NEVER the street
      // address; no commission %, no relist terms in the notes),
      // then flip the pocket row to approved.
      const asking = Number(row.asking_price) + markup;
      const { error: pubErr } = await supabase.from('published_deals').insert({
        user_id: userId,
        city: row.city,
        state: row.state_code,
        zip: row.zip,
        property_type: null,
        asking_price: asking,
        arv_low: row.estimated_arv ?? null,
        arv_high: row.estimated_arv ?? null,
        notes: 'Off-market pocket listing via licensed agent',
        published: true,
      });
      if (pubErr) throw new Error(pubErr.message || 'The deal could not be published.');
      const { error: updErr } = await supabase
        .from('realtor_pocket_listings')
        .update({ status: 'approved' })
        .eq('id', row.id);
      if (updErr) {
        // The deal IS published on /deals, but the pocket row did
        // not flip — say so plainly instead of letting the operator
        // promote it a second time and publish a duplicate.
        throw new Error(
          `The deal was published to /deals at ${money(asking)}, but the pocket row status could not be set to approved (${updErr.message}). Do not promote it again — fix the row status instead.`
        );
      }
      setPromotedIds((p) => ({ ...p, [row.id]: true }));
      setMarkups((p) => ({ ...p, [row.id]: '' }));
      setMsg(
        `Published to /deals at ${money(asking)} (${row.city}, ${row.state_code} ${row.zip} — no street address shown). Nothing was sent automatically — to share it with cash buyers, use Cash Buyers — CRM & Deal Blast in the dashboard: copy the blast text, or open it in your own email with BCC. The app never sends email itself.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The deal could not be promoted.');
    } finally {
      setBusyId(null);
    }
  };

  if (!operatorEmail || (!loading && !isOperator && !error && !missing)) {
    return (
      <p style={{ fontSize: 13, color: '#cbd5e1' }}>
        Agent pocket listings are operator-only.
      </p>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>Agent Pocket Listings</h2>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 12px' }}>
        Off-market listings submitted by licensed agents on /agents. Street addresses, commission %, and relist terms
        stay here — approving a listing publishes it to the buyer network with city and ZIP only.
      </p>
      {error && <p style={{ color: '#fca5a5', fontSize: 13 }}>{error}</p>}
      {msg && <p style={{ color: '#6ee7b7', fontSize: 13 }}>{msg}</p>}
      {missing && (
        <p style={{ fontSize: 13, color: '#cbd5e1' }}>
          Pocket listings are not set up yet — run migration 20261117150000_slice135_realtor_pocket_listings.sql, then reload.
        </p>
      )}
      {loading ? (
        <p style={{ fontSize: 14, color: '#cbd5e1' }}>Loading pocket listings…</p>
      ) : !missing && rows.length === 0 ? (
        <p style={{ fontSize: 14, color: '#cbd5e1' }}>No agent pocket listings yet — none have been submitted.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', color: '#0f172a', borderRadius: 10, overflow: 'hidden', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Property address</th>
                <th style={{ padding: '8px 10px' }}>City / State / ZIP</th>
                <th style={{ padding: '8px 10px' }}>Agent net / ARV</th>
                <th style={{ padding: '8px 10px' }}>Commission %</th>
                <th style={{ padding: '8px 10px' }}>Relist?</th>
                <th style={{ padding: '8px 10px' }}>Agent contact</th>
                <th style={{ padding: '8px 10px' }}>Notes</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px' }}>Approve &amp; promote</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const promoted = promotedIds[r.id] || r.status === 'approved';
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                    <td style={{ padding: '8px 10px' }}>{r.property_address}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.city}, {r.state_code} {r.zip}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      Net {money(r.asking_price)}
                      <br />
                      ARV {money(r.estimated_arv)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{r.commission_percent == null ? 'not provided' : `${r.commission_percent}%`}</td>
                    <td style={{ padding: '8px 10px' }}>{r.wants_relist ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.agent_name}
                      {r.brokerage ? ` (${r.brokerage})` : ''}
                      <br />
                      {r.agent_email}
                      <br />
                      {r.agent_phone}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{r.property_notes || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.status}
                      {r.status !== 'approved' && (
                        <select
                          value={r.status}
                          disabled={busyId === r.id}
                          onChange={(e) => setStatus(r, e.target.value)}
                          style={{ ...inputStyle, marginTop: 6 }}
                        >
                          <option value="new">new</option>
                          <option value="reviewed">reviewed</option>
                          <option value="declined">declined</option>
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', minWidth: 170 }}>
                      {promoted ? (
                        <span style={{ color: '#0f766e', fontWeight: 700 }}>✓ Published to /deals</span>
                      ) : (
                        <>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                            Assignment markup ($)
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={markups[r.id] || ''}
                              onChange={(e) => setMarkups((p) => ({ ...p, [r.id]: e.target.value }))}
                              placeholder="Markup amount"
                              style={inputStyle}
                            />
                          </label>
                          <button
                            onClick={() => approveAndPromote(r)}
                            disabled={busyId === r.id}
                            style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busyId === r.id ? 'wait' : 'pointer', fontSize: 13 }}
                          >
                            {busyId === r.id ? 'Promoting…' : 'Approve & promote'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
