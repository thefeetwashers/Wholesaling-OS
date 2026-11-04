'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadMyListings, type MyListing } from '../lib/portals';
import { loadMilestonesForFiles, type EscrowFileRow } from '../lib/escrow';
import { closingChecklist } from '../lib/closing-checklist';

// Slice 47 — title handoff packet. Title companies don't log into
// portals (decided Oct 19, 2026); they open a clean packet. One pick
// builds the one-page summary from the real escrow record — address,
// both prices and the assignment fee (the title company needs the
// fee for disbursement; sellers never see it on their views), EMD,
// dates, and the closing checklist as it stands — and opens a print
// view the wholesaler can print or save as PDF and email over.

const money = (n?: number | null) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString('en-US')}`);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface DealRow { id: string; contract_price?: number | null; assignment_fee?: number | null }

export default function TitlePacket({ userId }: { userId: string }) {
  const [files, setFiles] = useState<EscrowFileRow[]>([]);
  const [listings, setListings] = useState<Record<string, MyListing>>({});
  const [deals, setDeals] = useState<Record<string, DealRow>>({});
  const [miles, setMiles] = useState<Record<string, string[]>>({});
  const [pick, setPick] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) { setLoaded(true); return; }
        const [filesRes, myListings] = await Promise.all([
          supabase.from('escrow_files').select('*').eq('owner_id', userId).order('created_at', { ascending: false }),
          loadMyListings(userId).catch(() => [] as MyListing[]),
        ]);
        const fs = (filesRes.data || []) as EscrowFileRow[];
        setFiles(fs);
        const lmap: Record<string, MyListing> = {};
        for (const l of myListings) if (l.id) lmap[l.id] = l;
        setListings(lmap);
        const dealIds = Array.from(new Set(myListings.map((l) => l.deal_id).filter(Boolean))) as string[];
        if (dealIds.length) {
          const { data } = await supabase.from('deals').select('id, contract_price, assignment_fee').in('id', dealIds);
          const dmap: Record<string, DealRow> = {};
          for (const d of (data || []) as DealRow[]) dmap[d.id] = d;
          setDeals(dmap);
        }
        const m = await loadMilestonesForFiles(userId, fs.map((f) => f.id).filter(Boolean) as string[]).catch(() => null);
        setMiles(m || {});
      } finally { setLoaded(true); }
    })();
  }, [userId]);

  const file = files.find((f) => f.id === pick) || null;
  const listing = file ? listings[file.listing_id] : undefined;
  const deal = listing?.deal_id ? deals[listing.deal_id] : undefined;
  const address = listing?.deals?.documents?.property_address || 'Property';
  const cl = file ? closingChecklist(file, miles[file.id as string] || []) : null;

  const printPacket = () => {
    if (!file || !cl) return;
    const rows: [string, string][] = [
      ['Property', address],
      ['Seller contract price (A–B)', money(deal?.contract_price)],
      ['Buyer total (B–C)', money(listing?.total_marketplace_cost)],
      ['Assignment fee', money(deal?.assignment_fee)],
      ['EMD required', money(file.emd_amount_required)],
      ['EMD status', file.emd_status || '—'],
      ['EMD deadline', file.emd_deadline ? file.emd_deadline.slice(0, 10) : '—'],
      ['Title search', file.title_search_status || '—'],
      ['File status', file.file_status || '—'],
      ['Target closing', file.target_closing_date || '—'],
      ['Checklist', `${cl.badgeLabel} (${cl.doneCount} of ${cl.totalCount})`],
    ];
    const steps = cl.items.map((i) => `<tr><td>${esc(i.label)}</td><td>${esc(i.state)}</td><td>${esc(i.detail)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><title>Title packet — ${esc(address)}</title>
<style>body{font-family:Arial,sans-serif;margin:40px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:12px 0}td{border:1px solid #ccc;padding:6px 8px;font-size:13px}td:first-child{font-weight:bold;width:220px}.note{font-size:12px;color:#555}</style></head>
<body><h1>WholesalingOS — Title Handoff Packet</h1>
<p class="note">Prepared ${new Date().toLocaleDateString('en-US')} from the wholesaler's WholesalingOS records. Verify all figures against the executed contracts before disbursement.</p>
<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
<h2 style="font-size:15px">Closing checklist</h2>
<table><tr><td><b>Step</b></td><td><b>State</b></td><td><b>Detail</b></td></tr>${steps}</table>
<p class="note">Assignment of equitable interest — the buyer purchases the wholesaler's contract rights, as disclosed on the listing.</p>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 }}>
      <h2>Title Handoff Packet</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>
        Title companies open packets, not portals. Pick an escrow file and print its one-page summary —
        both prices, the fee, EMD, dates, and the checklist as it stands — ready to email over.
      </p>
      {loaded && files.length === 0 && <p style={{ fontSize: 14 }}>No escrow files yet — a packet can be built once a deal reaches escrow.</p>}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Pick an escrow file…</option>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {(listings[f.listing_id]?.deals?.documents?.property_address || 'Property')} · {f.file_status || 'opened'}
              </option>
            ))}
          </select>
          <button onClick={printPacket} disabled={!file}>Open print view</button>
        </div>
      )}
      {file && cl && (
        <div style={{ background: '#fff', color: '#111', borderRadius: 10, padding: 16, marginTop: 12, fontSize: 14 }}>
          <strong>{address}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 6, marginTop: 8 }}>
            <span>A–B price: {money(deal?.contract_price)}</span>
            <span>B–C total: {money(listing?.total_marketplace_cost)}</span>
            <span>Assignment fee: {money(deal?.assignment_fee)}</span>
            <span>EMD: {money(file.emd_amount_required)} · {file.emd_status || '—'}</span>
            <span>Closing: {file.target_closing_date || '—'}</span>
            <span>Checklist: {cl.badgeLabel} ({cl.doneCount} of {cl.totalCount})</span>
          </div>
        </div>
      )}
    </section>
  );
}
