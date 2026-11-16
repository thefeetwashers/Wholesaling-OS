'use client';

import { useEffect, useRef, useState } from 'react';
import { loadLeads, type Lead } from '../lib/leads';
import { loadBuyers, type BuyerRow } from '../lib/buyers';
import { loadMyListings, type MyListing } from '../lib/portals';
import { fetchProbateLeads, type ProbateLeadRow } from '../lib/probate-leads-api';
import { loadCashBuyers, type CashBuyerRow } from '../lib/cash-buyers';
import type { ContractPrefill } from './WholesaleContractGenerator';

// Slice 46 — one search box for the whole office. A wholesaler on a
// call should not hunt view by view: type an address, a name, or a
// phone number and jump. Searches ONLY the signed-in wholesaler's
// own rows (the same loaders every view uses, RLS-scoped), matched
// in the browser — no new data path, nothing leaves the office.
//
// Slice 129 — the master search: probate_leads (case number,
// decedent, property address), cash_buyers (name, company, email,
// phone — the REAL columns, not buyer_name/company_name), and the
// leads table split by badge: distressed = a distress_tag is set,
// inbound = list_source 'Seller landing page'. There is NO
// seller_leads table and NO distressed_leads table in this repo —
// distress lives in leads.distress_tag and inbound leads are
// leads with list_source 'Seller landing page', and the search
// reads those real columns only. Cmd+K / Ctrl+K focuses the box.
// A probate or inbound hit offers the existing Draft Contract
// prefill (the generator's ContractPrefill) beside the jump.

interface Hit {
  group: string;
  label: string;
  sub: string;
  view: string;
  prefill?: ContractPrefill;
}

export default function GlobalSearch({
  userId,
  onNavigate,
  onDraftContract,
}: {
  userId: string;
  onNavigate: (view: string) => void;
  onDraftContract?: (prefill: ContractPrefill) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cache = useRef<{ leads: Lead[]; buyers: BuyerRow[]; listings: MyListing[]; probate: ProbateLeadRow[]; cashBuyers: CashBuyerRow[] } | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);

  // Cmd+K / Ctrl+K focuses the search box from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) { setHits([]); return; }
    let live = true;
    const run = async () => {
      if (!cache.current) {
        const [leads, buyers, listings, probate, cashBuyers] = await Promise.all([
          loadLeads(userId).catch(() => null),
          loadBuyers(userId).catch(() => null),
          loadMyListings(userId).catch(() => [] as MyListing[]),
          fetchProbateLeads(userId, { includeClosed: true }).catch(() => null),
          loadCashBuyers(userId).catch(() => null),
        ]);
        cache.current = {
          leads: leads || [],
          buyers: buyers || [],
          listings: listings || [],
          probate: probate || [],
          cashBuyers: cashBuyers || [],
        };
      }
      if (!live || !cache.current) return;
      const digits = needle.replace(/\D/g, '');
      const out: Hit[] = [];
      const push = (h: Hit) => {
        if (out.length < 18) out.push(h);
      };
      // Probate leads first (pro se is the priority desk).
      for (const p of cache.current.probate) {
        const dmNames = p.decision_makers.map((d) => d.name).join(' ');
        const hay = `${p.case_number} ${p.decedent_name || ''} ${p.property_address || ''} ${dmNames}`.toLowerCase();
        if (hay.includes(needle)) {
          push({
            group: p.is_pro_se ? 'PRO SE PROBATE' : 'PROBATE',
            label: `${p.decedent_name || 'Decedent not listed'} — ${p.case_number}`,
            sub: `${p.case_status} · ${p.decision_makers[0]?.name || 'no decision-maker listed'}`,
            view: 'probate',
            prefill: {
              sellerName: p.decision_makers[0]?.name || '',
              propertyAddress: p.property_address || '',
              city: '',
              county: p.county || '',
              parcelId: '',
              probateCaseNumber: p.case_number,
              isProbate: true,
              purchasePrice: null,
            },
          });
        }
        if (out.length >= 18) break;
      }
      for (const l of cache.current.leads) {
        // Slice 127 — a probate case number is searchable too, so
        // typing 2026CP001433 finds the seller lead the probate
        // storefront link created. Slice 129 — owner phone/email
        // (the Google lookup pair) are searchable as well.
        const hay = `${l.property_address} ${l.owner_name || ''} ${l.city || ''} ${l.zip || ''} ${l.probate_case_number || ''} ${l.owner_email || ''} ${l.owner_phone || ''}`.toLowerCase();
        const phoneHit = digits.length >= 4 && (l.phones || []).some((p) => p.replace(/\D/g, '').includes(digits));
        if (hay.includes(needle) || phoneHit) {
          const isInbound = l.list_source === 'Seller landing page' || l.list_source === 'Seller page voice intake';
          const group = l.distress_tag ? l.distress_tag.replace(/_/g, ' ').toUpperCase() : isInbound ? 'INBOUND /SELL/' : 'Leads';
          push({
            group,
            label: l.property_address,
            sub: `${l.owner_name || 'Owner'} · ${l.status}${l.probate_case_number ? ` · Probate #${l.probate_case_number}` : ''}`,
            view: 'leads',
            ...(isInbound
              ? {
                  prefill: {
                    sellerName: l.owner_name || '',
                    propertyAddress: l.property_address,
                    city: l.city || '',
                    county: l.county || '',
                    parcelId: l.parcel_id || '',
                    probateCaseNumber: l.probate_case_number || '',
                    isProbate: !!l.probate_case_number,
                    purchasePrice: l.offer_amount ?? null,
                  },
                }
              : {}),
          });
        }
        if (out.length >= 18) break;
      }
      for (const c of cache.current.cashBuyers) {
        const hay = `${c.name} ${c.company || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase();
        if (hay.includes(needle)) {
          push({
            group: c.pof_verified ? 'POF CASH BUYER' : 'CASH BUYER',
            label: c.name,
            sub: `${c.company || 'No company listed'} · ${c.email}`,
            view: 'cashbuyers',
          });
        }
        if (out.length >= 18) break;
      }
      for (const b of cache.current.buyers) {
        if (`${b.name} ${b.buy_box || ''}`.toLowerCase().includes(needle)) {
          push({ group: 'Buyers', label: b.name, sub: b.buy_box || 'Buyer', view: 'buyers' });
        }
      }
      for (const li of cache.current.listings) {
        const addr = li.deals?.documents?.property_address || '';
        if (addr.toLowerCase().includes(needle)) {
          push({ group: 'Listings', label: addr, sub: `Listing · ${li.listing_status}`, view: 'listings' });
        }
      }
      setHits(out.slice(0, 18));
    };
    const t = setTimeout(run, 180);
    return () => { live = false; clearTimeout(t); };
  }, [q, userId]);

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="🔎 Search your office — address, name, phone, or case #…  (Cmd+K)"
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14.5 }}
        aria-label="Search your office"
      />
      {open && q.trim().length >= 2 && (
        <div style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
          {hits.length === 0 && <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0, padding: '10px 12px' }}>No matches in your office for “{q.trim()}”.</p>}
          {hits.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
              <button
                onClick={() => { onNavigate(h.view); setOpen(false); setQ(''); }}
                style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: '#e2e8f0' }}
              >
                <span style={{ fontSize: 11, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h.group}</span>
                <br />
                <span style={{ fontSize: 14 }}>{h.label}</span>
                <span style={{ fontSize: 12.5, color: '#94a3b8' }}> — {h.sub}</span>
              </button>
              {h.prefill && onDraftContract && (
                <button
                  onClick={() => { onDraftContract(h.prefill!); setOpen(false); setQ(''); }}
                  style={{ margin: '4px 8px 4px 0', padding: '5px 10px', borderRadius: 6, border: '1px solid #f59e0b', background: 'transparent', color: '#fbbf24', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Draft contract
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
