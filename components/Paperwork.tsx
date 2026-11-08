'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadLeads, type Lead } from '../lib/leads';
import { jvSplit, dealNet } from '../lib/mao';
import { loadLetterIdentity, escHtml, openPrintWindow, type LetterIdentity } from '../lib/letter-identity';
import { offerLetter, type OfferInput } from '../lib/paperwork';

// Slice 80 — the money paperwork trio, on one panel in Contracts &
// Closing: (1) an offer-letter generator (an expression of interest,
// printed on the wholesaler's own letter identity — the platform
// sends nothing); (2) a JV split panel using the platform's standing
// split math; (3) a per-deal net sheet using the standing net math.
// All figures are typed by the wholesaler; nothing is pulled from
// anywhere and nothing is stored.

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

export default function Paperwork({ userId }: { userId: string }) {
  const [identity, setIdentity] = useState<LetterIdentity>({ you: '', biz: '', phone: '', email: '' });
  const [leads, setLeads] = useState<Lead[]>([]);

  // Offer letter state
  const [offer, setOffer] = useState<OfferInput>({
    sellerName: '', propertyAddress: '', city: '', state: '', price: 150000, emd: 1000, closingDays: 30, inspectionDays: 10,
  });
  // JV state
  const [jvFee, setJvFee] = useState(10000);
  const [partnerName, setPartnerName] = useState('');
  const [partnerPct, setPartnerPct] = useState(50);
  // Net sheet state
  const [netFee, setNetFee] = useState(10000);
  const [referral, setReferral] = useState(500);
  const [expLetters, setExpLetters] = useState(200);
  const [expPhotos, setExpPhotos] = useState(100);
  const [expOther, setExpOther] = useState(0);

  useEffect(() => {
    setIdentity(loadLetterIdentity());
    loadLeads(userId).then((rows) => setLeads(rows || [])).catch(() => setLeads([]));
  }, [userId]);

  const letter = useMemo(() => offerLetter(offer, identity, new Date()), [offer, identity]);
  const split = useMemo(() => jvSplit(jvFee, partnerPct), [jvFee, partnerPct]);
  const expenses = expLetters + expPhotos + expOther;
  const net = useMemo(() => dealNet(netFee, referral, expenses), [netFee, referral, expenses]);

  const pickLead = (id: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    setOffer((o) => ({
      ...o,
      sellerName: lead.owner_name || o.sellerName,
      propertyAddress: lead.property_address,
      city: lead.city || '',
      state: lead.state || '',
    }));
  };

  const printLetter = () => {
    const html = letter.split('\n').map((line) => `<p style="margin:0 0 8px">${escHtml(line) || '&nbsp;'}</p>`).join('');
    openPrintWindow('Offer letter', html);
  };

  const sub: React.CSSProperties = { background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '14px 16px', marginTop: 14 };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 13.5, marginTop: 8 };

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h2>🧾 Money Paperwork</h2>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        The three documents wholesalers re-type by hand: an offer letter, a JV split, and the per-deal net
        sheet. Every figure below is one you type — nothing is pulled, stored, or sent by the platform.
      </p>

      <div style={sub}>
        <strong>✉️ Offer letter generator</strong>
        <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
          An expression of interest, not a contract — the contract itself is generated above and carries the
          attorney-review gate. Prints on your letter identity (set it in Leads, on any lead's Letter button).
        </p>
        {leads.length > 0 && (
          <label style={lbl}>
            Start from one of your leads{' '}
            <select defaultValue="" onChange={(e) => pickLead(e.target.value)}>
              <option value="">Choose a lead…</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.property_address}</option>)}
            </select>
          </label>
        )}
        <label style={lbl}>Seller name <input value={offer.sellerName} onChange={(e) => setOffer({ ...offer, sellerName: e.target.value })} /></label>
        <label style={lbl}>Property address <input value={offer.propertyAddress} onChange={(e) => setOffer({ ...offer, propertyAddress: e.target.value })} style={{ width: 280 }} /></label>
        <label style={lbl}>
          City <input value={offer.city || ''} onChange={(e) => setOffer({ ...offer, city: e.target.value })} style={{ width: 130 }} />{' '}
          State <input value={offer.state || ''} onChange={(e) => setOffer({ ...offer, state: e.target.value })} style={{ width: 60 }} />
        </label>
        <label style={lbl}>Offer price $ <input type="number" value={offer.price} onChange={(e) => setOffer({ ...offer, price: num(e.target.value) })} /></label>
        <label style={lbl}>Earnest money $ <input type="number" value={offer.emd} onChange={(e) => setOffer({ ...offer, emd: num(e.target.value) })} /></label>
        <label style={lbl}>
          Closing within (days) <input type="number" value={offer.closingDays} onChange={(e) => setOffer({ ...offer, closingDays: num(e.target.value) })} style={{ width: 70 }} />{' '}
          Inspection period (days) <input type="number" value={offer.inspectionDays} onChange={(e) => setOffer({ ...offer, inspectionDays: num(e.target.value) })} style={{ width: 70 }} />
        </label>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: '#020617', borderRadius: 8, padding: 12, marginTop: 12 }}>{letter}</pre>
        <button type="button" onClick={printLetter} style={{ cursor: 'pointer' }}>Print / save the letter</button>
      </div>

      <div style={sub}>
        <strong>🤝 JV split panel</strong>
        <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
          Find JV partners on the JV Board; the agreement itself is signed in Contracts above, before any
          marketing. The platform takes no cut of a JV split and wires nothing — this panel is the arithmetic.
        </p>
        <label style={lbl}>Assignment fee $ <input type="number" value={jvFee} onChange={(e) => setJvFee(num(e.target.value))} /></label>
        <label style={lbl}>Partner name <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="JV partner" /></label>
        <label style={lbl}>Partner's share % <input type="number" value={partnerPct} onChange={(e) => setPartnerPct(Math.min(100, num(e.target.value)))} style={{ width: 70 }} /></label>
        <p style={{ fontSize: 14.5, marginTop: 10 }}>
          {partnerName || 'Your partner'} receives <strong>{money(split.partnerA)}</strong> · You keep <strong>{money(split.partnerB)}</strong>
        </p>
      </div>

      <div style={sub}>
        <strong>🧮 Per-deal net sheet</strong>
        <label style={lbl}>Assignment fee $ <input type="number" value={netFee} onChange={(e) => setNetFee(num(e.target.value))} /></label>
        <label style={lbl}>Referral owed $ <input type="number" value={referral} onChange={(e) => setReferral(num(e.target.value))} /></label>
        <label style={lbl}>Letters & postage $ <input type="number" value={expLetters} onChange={(e) => setExpLetters(num(e.target.value))} /></label>
        <label style={lbl}>Photos & travel $ <input type="number" value={expPhotos} onChange={(e) => setExpPhotos(num(e.target.value))} /></label>
        <label style={lbl}>Other expenses $ <input type="number" value={expOther} onChange={(e) => setExpOther(num(e.target.value))} /></label>
        <div style={{ fontSize: 14, marginTop: 10 }}>
          <div>Fee {money(netFee)} − referral {money(referral)} − expenses {money(expenses)}</div>
          <div style={{ fontSize: 16, marginTop: 4 }}>Your net on this deal: <strong>{money(net)}</strong></div>
          <p style={{ fontSize: 12.5, color: '#94a3b8' }}>
            If this deal is a JV, run your share from the panel above as the fee here. Taxes are not estimated —
            that is your accountant's line.
          </p>
        </div>
      </div>
    </section>
  );
}
