'use client';

// Slice 132 — Managed disposition requests list (operator only).
//
// Rendered in ONE existing operator view (OperatorStats — the
// coordinator adds the render line; this file only defines the
// list, it does not wire itself in). The operator sees every
// request, newest first, and moves its status. A request is a
// REQUEST, not a booking; the fee is agreed in writing before
// work starts and no fee is shown or stored here. No email is
// sent. A missing table (migration not applied yet) shows its own
// plain note instead of breaking the panel — the same pattern as
// the problem-reports list in OperatorStats.

import { useEffect, useState } from 'react';
import {
  fetchAllManagedDispoRequests,
  setManagedDispoStatus,
  MANAGED_DISPO_STATUS_LABELS,
  type ManagedDispoRequest,
  type ManagedDispoStatus,
} from '../lib/managed-dispo';

const money = (n: number | null | undefined): string =>
  n == null ? 'not provided' : `$${Math.round(n).toLocaleString()}`;

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /does not exist|relation .* does not exist|PGRST205|column .* does not exist|PGRST204/i.test(msg);
}

export default function ManagedDispoRequests({ operatorEmail }: { operatorEmail: string | null }) {
  const [rows, setRows] = useState<ManagedDispoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAllManagedDispoRequests(operatorEmail);
        if (live) setRows(data);
      } catch (e) {
        if (live) {
          if (isMissingTable(e)) setMissing(true);
          else setError(e instanceof Error ? e.message : 'Could not load managed disposition requests.');
        }
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [operatorEmail]);

  async function changeStatus(row: ManagedDispoRequest, next: ManagedDispoStatus) {
    if (!row.id) return;
    setSavingId(row.id);
    setMsg('');
    try {
      await setManagedDispoStatus(row.id, next, operatorEmail);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'The status did not save.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p style={{ fontSize: 13, color: '#64748b' }}>Loading managed disposition requests…</p>;
  if (missing) {
    return (
      <p style={{ fontSize: 13 }}>
        The managed_dispo_requests table does not exist yet — run migration 20261117130000_slice132_marketplace_tables.sql first.
      </p>
    );
  }

  const open = rows.filter((r) => r.status === 'requested' || r.status === 'under_review');

  return (
    <div>
      <h4 style={{ marginTop: 20 }}>Managed disposition requests ({open.length} open)</h4>
      {msg && <p style={{ fontSize: 13, color: '#b91c1c' }}>{msg}</p>}
      {error && <p style={{ fontSize: 13, color: '#b91c1c' }}>{error}</p>}
      {rows.length === 0 ? (
        <p style={{ fontSize: 13 }}>No managed disposition requests yet.</p>
      ) : (
        <ul style={{ fontSize: 13 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ marginBottom: 12, background: '#0f172a', padding: 12, borderRadius: 10, color: '#e2e8f0' }}>
              <strong>{r.property_address || 'Address not given'}</strong>
              {r.city ? ` — ${r.city}, ${r.state || ''}` : ''} · {MANAGED_DISPO_STATUS_LABELS[r.status || 'requested']}
              {r.created_at ? ` · ${new Date(r.created_at).toLocaleString()}` : ''}
              <br />
              Asking: {money(r.asking_price)} · ARV: {money(r.arv)} · Est. repairs: {money(r.repair_estimate)}
              {r.notes ? <><br />{r.notes}</> : null}
              <br />
              {r.status !== 'under_review' && r.status !== 'accepted' && r.status !== 'completed' && (
                <button disabled={savingId === r.id} onClick={() => changeStatus(r, 'under_review')} style={{ marginTop: 6, marginRight: 6 }}>
                  Mark under review
                </button>
              )}
              {r.status !== 'accepted' && r.status !== 'completed' && (
                <button disabled={savingId === r.id} onClick={() => changeStatus(r, 'accepted')} style={{ marginTop: 6, marginRight: 6 }}>
                  Accept
                </button>
              )}
              {r.status !== 'declined' && r.status !== 'completed' && (
                <button disabled={savingId === r.id} onClick={() => changeStatus(r, 'declined')} style={{ marginTop: 6, marginRight: 6 }}>
                  Decline
                </button>
              )}
              {r.status !== 'completed' && (
                <button disabled={savingId === r.id} onClick={() => changeStatus(r, 'completed')} style={{ marginTop: 6 }}>
                  Mark completed
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
