'use client';

import { useEffect, useState } from 'react';
import { loadLeads, updateLeadFields, LEAD_STATUSES, type Lead, type LeadStatus } from '../lib/leads';
import { ageLabel } from '../lib/match';

// Slice 78 — kanban pipeline board. The columns are the platform's
// real lead statuses, in pipeline order; a card is the wholesaler's
// own lead. Dragging a card (or tapping its ← → buttons — the
// reliable path on phones) writes the new status through the same
// owner-fenced update the lead editor uses, then the board reloads
// from the database. Nothing here is a second copy of the data:
// the board is a view of the leads table, not a store beside it.

const LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  under_contract: 'Under Contract',
  assigned: 'Assigned',
  closed: 'Closed',
  dead: 'Dead',
};

export default function KanbanBoard({ userId }: { userId: string }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = () => {
    loadLeads(userId).then((rows) => setLeads(rows || [])).catch(() => setLeads([]));
  };
  useEffect(refresh, [userId]);

  const move = async (lead: Lead, status: LeadStatus) => {
    if (!lead.id || lead.status === status) return;
    setError('');
    try {
      await updateLeadFields(userId, lead.id, { status });
      refresh();
    } catch {
      setError('That move did not save — check your connection and try again. The board still shows the saved state.');
    }
  };

  if (!leads) return <p style={{ fontSize: 14, color: '#94a3b8' }}>Loading your pipeline…</p>;

  const colStyle: React.CSSProperties = {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 10,
    minWidth: 210, flex: '1 1 210px',
  };
  const cardStyle: React.CSSProperties = {
    background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: 10, marginTop: 8,
  };
  const moveBtn: React.CSSProperties = {
    background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 6,
    padding: '2px 8px', cursor: 'pointer', fontSize: 12.5,
  };

  return (
    <section>
      <h2>📋 Pipeline Board</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Your leads by stage. Drag a card to a new column, or use its arrow buttons — either way the new stage
        saves to the same lead record your Leads list edits. Dead is a real stage, not a delete: dead leads
        stay counted and can be revived by moving them back.
      </p>
      {error && <p style={{ fontSize: 13.5, color: '#fca5a5' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
        {LEAD_STATUSES.map((status, idx) => {
          const cards = leads.filter((l) => l.status === status);
          return (
            <div
              key={status}
              style={{ ...colStyle, opacity: status === 'dead' ? 0.75 : 1 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const lead = leads.find((l) => l.id === dragId);
                if (lead) void move(lead, status);
                setDragId(null);
              }}
            >
              <strong style={{ fontSize: 13.5 }}>{LABEL[status]} · {cards.length}</strong>
              {cards.length === 0 && <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 8 }}>No leads here.</p>}
              {cards.map((lead) => (
                <div
                  key={lead.id}
                  style={cardStyle}
                  draggable
                  onDragStart={() => setDragId(lead.id || null)}
                  onDragEnd={() => setDragId(null)}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{lead.property_address}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {[lead.city, lead.state].filter(Boolean).join(', ')}
                    {lead.list_source ? ` · via ${lead.list_source}` : ''}
                    {lead.created_at ? ` · ${ageLabel(lead.created_at)}` : ''}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <button
                      type="button"
                      style={{ ...moveBtn, visibility: idx === 0 ? 'hidden' : 'visible' }}
                      onClick={() => void move(lead, LEAD_STATUSES[idx - 1])}
                      aria-label={`Move ${lead.property_address} back to ${LABEL[LEAD_STATUSES[idx - 1]]}`}
                    >← {LABEL[LEAD_STATUSES[idx - 1]]}</button>
                    <button
                      type="button"
                      style={{ ...moveBtn, visibility: idx === LEAD_STATUSES.length - 1 ? 'hidden' : 'visible' }}
                      onClick={() => void move(lead, LEAD_STATUSES[idx + 1])}
                      aria-label={`Move ${lead.property_address} forward to ${LABEL[LEAD_STATUSES[idx + 1]]}`}
                    >{LABEL[LEAD_STATUSES[idx + 1]]} →</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
