// Slice 133 — "Copy Deal & Open OBL" button (owner only).
//
// There is NO OpenBuyersList public API, so this does NOT
// auto-post. On tap it copies the plain-text deal summary
// (lib/deal-cross-post.ts — real published_deals fields only, no
// street address, blanks read "not provided") to the clipboard,
// then opens https://openbuyerslist.com/ in a new tab so the
// wholesaler pastes it into OBL's guided form by hand. The label
// and the note under the button say exactly that.
//
// Rendered ONLY on the wholesaler's OWN published deals — the
// callers gate on deal.user_id === signed-in user id. On public
// cards it is hidden for anyone else (including signed-out
// visitors and other wholesalers). No OBL data of any kind is
// copied or shown here.

'use client';

import { useState } from 'react';
import { formatDealCrossPost, OPEN_BUYERS_LIST_URL, type DealCrossPostInput } from '../lib/deal-cross-post';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (older browser / permission) —
    // fall back to a hidden textarea + execCommand.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function CopyDealToOblButton({ deal }: { deal: DealCrossPostInput }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  const onClick = async () => {
    setBusy(true);
    setErr('');
    setCopied(false);
    const text = formatDealCrossPost(deal);
    const ok = await copyText(text);
    setBusy(false);
    if (!ok) {
      setErr('The deal text could not be copied — your browser blocked clipboard access. Try again.');
      return;
    }
    setCopied(true);
    window.open(OPEN_BUYERS_LIST_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <span style={{ display: 'block' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid #0f766e',
          background: '#fff',
          color: '#0f766e',
          fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer',
          fontSize: 13,
        }}
      >
        {busy ? 'Copying…' : copied ? 'Copied — paste it in OBL' : 'Copy deal & open OBL to cross-post by hand'}
      </button>
      <span style={{ display: 'block', fontSize: 12, color: '#334155', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', marginTop: 4 }}>
        This does not auto-post — it copies the deal text and opens OpenBuyersList, where you paste it into
        their form yourself.
      </span>
      {err && <span style={{ display: 'block', fontSize: 12.5, color: '#991b1b', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 8px', marginTop: 4 }}>{err}</span>}
    </span>
  );
}
