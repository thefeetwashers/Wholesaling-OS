'use client';

import { isOverdue, isDueToday, type Lead } from '../lib/leads';

export default function TodayCenter({ leads }: { leads: Lead[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = leads.filter((l) => isOverdue(l, today));
  const dueToday = leads.filter((l) => isDueToday(l, today));
  const newLeads = leads.filter((l) => l.status === 'new');

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>Today Center</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>Built only from leads you entered in this app. No other data is counted.</p>
      <ul>
        <li><strong>Overdue follow-ups: {overdue.length}</strong>
          {overdue.map((l) => <div key={l.id || l.property_address}>— {l.property_address} (follow-up was {l.follow_up_date})</div>)}
        </li>
        <li><strong>Due today: {dueToday.length}</strong>
          {dueToday.map((l) => <div key={l.id || l.property_address}>— {l.property_address}</div>)}
        </li>
        <li><strong>New leads to contact: {newLeads.length}</strong></li>
        <li>Viewings needing confirmation — Slice 3 (viewings not ported yet)</li>
        <li>EMD deadlines within 24 hours — Slice 3 (escrow not ported yet)</li>
        <li>Unsigned contracts — Slice 3 (signature pipeline not ported yet)</li>
      </ul>
    </section>
  );
}
