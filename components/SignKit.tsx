'use client';

import { useEffect, useState } from 'react';
import { loadSellerPageSettings, type SellerPageSettings } from '../lib/portals';
import { loadLetterIdentity, saveLetterIdentity, escHtml, openPrintWindow, type LetterIdentity } from '../lib/letter-identity';

// Slice 62 — the seller-page sign kit. Every letter, sign, and
// door hanger a wholesaler puts out should point at ONE door:
// their seller page, where a motivated seller hands over their
// own number with consent stamped (requested_contact). The kit
// prints a yard sign and a letter insert / door hanger from the
// wholesaler's real page address and their own details — the
// platform prints nothing and mails nothing.

export default function SignKit({ userId }: { userId: string }) {
  const [s, setS] = useState<SellerPageSettings | null>(null);
  const [idn, setIdn] = useState<LetterIdentity>(() => loadLetterIdentity());

  useEffect(() => {
    let live = true;
    loadSellerPageSettings(userId).then((v) => { if (live) setS(v); }).catch(() => {});
    return () => { live = false; };
  }, [userId]);

  if (!s) return null;

  const slug = (s.public_slug || '').trim().toLowerCase();
  const pageUrl = slug ? `https://wholesalingos.thefeetwashers.com/sell/${slug}` : '';
  const biz = idn.biz || s.company || '';
  const headline = s.seller_page_headline || 'We Buy Houses';

  const printSign = () => {
    saveLetterIdentity(idn);
    const html = `
<style>body{font-family:Arial,sans-serif;margin:0;color:#111;text-align:center}
.sign{border:6px solid #065f46;border-radius:18px;padding:48px 32px;margin:24px}
h1{font-size:54px;margin:0 0 10px;color:#065f46}
.biz{font-size:24px;font-weight:bold;margin-bottom:14px}
.line{font-size:19px;margin:6px 0}
.url{font-size:27px;font-weight:bold;color:#065f46;margin-top:22px;word-break:break-all}
.phone{font-size:30px;font-weight:bold;margin-top:8px}</style>
<div class="sign">
<h1>${escHtml(headline)}</h1>
${biz ? `<div class="biz">${escHtml(biz)}</div>` : ''}
<div class="line">Sell directly to us — no agent commissions, no repairs, no cleanout.</div>
<div class="line">You pick the closing date. We handle the paperwork.</div>
<div class="url">${escHtml(pageUrl.replace('https://', ''))}</div>
${idn.phone ? `<div class="phone">${escHtml(idn.phone)}</div>` : ''}
</div>`;
    openPrintWindow('Yard sign', html);
  };

  const printInsert = () => {
    saveLetterIdentity(idn);
    const html = `
<style>body{font-family:Arial,sans-serif;margin:40px;color:#111}
.card{border:2px solid #065f46;border-radius:12px;padding:22px 26px;max-width:560px}
h1{font-size:24px;margin:0 0 6px;color:#065f46}
p{font-size:14.5px;line-height:1.55;margin:6px 0}
.url{font-size:16.5px;font-weight:bold;color:#065f46}</style>
<div class="card">
<h1>${escHtml(headline)}</h1>
${biz ? `<p><strong>${escHtml(biz)}</strong></p>` : ''}
<p>Thinking of selling? Get a fair, all-cash offer directly from us — as-is, no fees,
and you choose the closing date. Start here (it takes two minutes):</p>
<p class="url">${escHtml(pageUrl.replace('https://', ''))}</p>
${idn.phone ? `<p>Or call ${idn.you ? escHtml(idn.you) + ' ' : ''}directly: <strong>${escHtml(idn.phone)}</strong></p>` : ''}
</div>`;
    openPrintWindow('Letter insert / door hanger', html);
  };

  const inp = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 6, color: '#fff', padding: '6px 9px', fontSize: 13.5, marginRight: 6, marginTop: 4 } as const;

  return (
    <section style={{ background: '#16213a', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 16, padding: '20px 24px', marginTop: 16 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>🪧 Sign kit — send sellers to your page</h2>
      {!s.seller_page_enabled || !slug ? (
        <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: 0 }}>
          Your sign kit prints the moment your seller page is switched on above. Every sign, letter, and door
          hanger you put out should point at that one page — it is where a seller hands you their number
          themselves, with consent recorded, instead of you ever having to hunt for it.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 8px' }}>
            Printed from your real page address — <strong style={{ color: '#7dd3fc' }}>{pageUrl}</strong> — and
            the details below (kept on this device only). The platform prints nothing and mails nothing; you do,
            and every reply lands on your page as a consented lead.
          </p>
          <input placeholder="Your name" value={idn.you} onChange={(e) => setIdn({ ...idn, you: e.target.value })} style={inp} />
          <input placeholder="Your business" value={idn.biz} onChange={(e) => setIdn({ ...idn, biz: e.target.value })} style={inp} />
          <input placeholder="Your phone" value={idn.phone} onChange={(e) => setIdn({ ...idn, phone: e.target.value })} style={inp} />
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={printSign}>Print yard sign</button>
            <button onClick={printInsert}>Print letter insert / door hanger</button>
          </div>
        </>
      )}
    </section>
  );
}
