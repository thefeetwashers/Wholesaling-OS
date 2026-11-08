'use client';

import { useEffect, useState } from 'react';
import { loadLeads, type Lead } from '../lib/leads';
import { leadAddress, stopUrl, routeUrl } from '../lib/route';

// Slice 86 — the Route Board (Field view, under Field Capture).
// Turn today's open leads into a driving route: tick the stops,
// order them with ↑ ↓, and open the whole run in Google Maps —
// plain links built from your own leads' addresses, no map API,
// no key, and the platform never tracks the trip. A stop you have
// not worked yet keeps its place in your pipeline; the board is
// a plan, not a status change.

export default function RouteBoard({ userId }: { userId: string }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    loadLeads(userId)
      .then((rows) => { if (live) setLeads(rows.filter((l) => l.status !== 'closed' && l.status !== 'dead')); })
      .catch(() => { if (live) setLeads([]); });
    return () => { live = false; };
  }, [userId]);

  if (leads === null) return null;

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const move = (id: string, dir: -1 | 1) =>
    setPicked((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const stops = picked
    .map((id) => leads.find((l) => l.id === id))
    .filter((l): l is Lead => !!l);

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24, maxWidth: 720 }}>
      <h2>🗺️ Route board — plan the drive</h2>
      <p style={{ fontSize: 13.5, color: '#94a3b8' }}>
        Tick the open leads you want to drive today, put them in the order that makes sense from behind
        the wheel, then open the run in Google Maps. The links are plain Maps links built from your own
        addresses — no map account, no tracking; the platform never sees your trip.
      </p>
      {leads.length === 0 ? (
        <p style={{ fontSize: 13.5 }}>No open leads to route yet. Capture one above or add one in Leads and it shows up here.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
          {leads.map((l) => (
            <li key={l.id || l.property_address} style={{ fontSize: 14.5 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'baseline', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!l.id && picked.includes(l.id)} onChange={() => l.id && toggle(l.id)} />
                <span>
                  <strong>{l.property_address}</strong>
                  {l.city ? ` — ${l.city}, ${l.state || ''}` : ''} · via {l.list_source || 'Not recorded'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {stops.length > 0 && (
        <div style={{ marginTop: 14, background: '#0f172a', borderRadius: 10, padding: 14 }}>
          <strong style={{ fontSize: 14.5 }}>Today's run — {stops.length} stop{stops.length === 1 ? '' : 's'}</strong>
          <ol style={{ paddingLeft: 20, display: 'grid', gap: 6, marginTop: 8 }}>
            {stops.map((l, i) => (
              <li key={l.id || i} style={{ fontSize: 14 }}>
                {leadAddress(l)}{' '}
                <a href={stopUrl(l)} target="_blank" rel="noreferrer">Navigate ↗</a>{' '}
                <button type="button" onClick={() => l.id && move(l.id, -1)} disabled={i === 0}>↑</button>{' '}
                <button type="button" onClick={() => l.id && move(l.id, 1)} disabled={i === stops.length - 1}>↓</button>
              </li>
            ))}
          </ol>
          <a href={routeUrl(stops)} target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', marginTop: 10, background: '#065f46', color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: 16, textDecoration: 'none' }}>
            Open the full route in Google Maps ↗
          </a>
        </div>
      )}
    </section>
  );
}
