'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  loadTaxData, taxYears, closedDealsCsv, disbursementsCsv, yearSummary, type TaxData,
} from '../lib/tax-export';

// Slice 82 — tax-season export panel (Money view). Downloads are
// generated in the browser from the wholesaler's own rows; nothing
// is sent anywhere. The caveats print on the panel: "closed" is the
// platform's recorded definition, the year follows the record's
// own dates, and every line gets matched against closing
// statements before an accountant relies on it.

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function TaxExport({ userId }: { userId: string }) {
  const [data, setData] = useState<TaxData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    let live = true;
    loadTaxData(userId).then((d) => { if (live) setData(d); }).catch(() => { if (live) setData({ deals: [], disbursements: [] }); });
    return () => { live = false; };
  }, [userId]);

  const years = useMemo(() => (data ? taxYears(data, new Date().getFullYear()) : [year]), [data, year]);
  const summary = useMemo(() => (data ? yearSummary(data, year) : null), [data, year]);

  if (!data || !summary) return null;

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🧾 Tax-season export</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Two CSVs for your accountant, built from your recorded rows only. "Closed" means an actual sale price
        is recorded on the deal — the same definition your scoreboard uses — and the year follows each
        record's own dates. Match every line against your closing statements before filing; this is
        bookkeeping, not tax advice.
      </p>
      <label style={{ fontSize: 14 }}>
        Tax year{' '}
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <p style={{ fontSize: 14.5 }}>
        {year}: {summary.deals} closed deal{summary.deals === 1 ? '' : 's'} · {money(summary.fees)} in assignment
        fees · {summary.disbursements} disbursement{summary.disbursements === 1 ? '' : 's'} · {money(summary.out)} out
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ cursor: 'pointer' }} onClick={() => download(`wholesalingos-closed-deals-${year}.csv`, closedDealsCsv(data.deals, year))}>
          Download closed deals CSV ({year})
        </button>
        <button type="button" style={{ cursor: 'pointer' }} onClick={() => download(`wholesalingos-disbursements-${year}.csv`, disbursementsCsv(data.disbursements, year))}>
          Download disbursements CSV ({year})
        </button>
      </div>
    </section>
  );
}
