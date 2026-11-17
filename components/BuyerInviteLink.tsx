// Slice 133 — "Copy invite link" block for the buyer invite.
//
// One click copies the wholesaler's own buyer invite link
// (lib/invite-link.ts — canonical /join?role=buyer, plus
// ?ref=<their public_slug> when they have one saved). The link
// itself is shown as text next to the button so it can be
// pasted into texts, emails, social posts, and OBL deal notes.
// An optional QR code (same goqr.me format verified live for
// the probate letter) encodes the link for flyers and open
// houses, with the text URL under it as fallback.
//
// Honest label, on the block: "They register themselves — one
// tap on your link." Never "we register buyers for you", never
// a claim that buyers are auto-added. No email is sent here.
//
// Props: userId loads the wholesaler's own public_slug from
// their storefront profile; pass publicSlug directly when the
// parent already loaded the profile (CashBuyersDealBlast does)
// to avoid a second load. A null slug reads as the plain link.

import { useEffect, useState } from 'react';
import { loadMyStorefront } from '../lib/storefront';
import { buildBuyerInviteLink, buyerInviteQrUrl } from '../lib/invite-link';

export default function BuyerInviteLink({
  userId,
  publicSlug,
  showQr = true,
}: {
  userId?: string | null;
  publicSlug?: string | null;
  showQr?: boolean;
}) {
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [qrFailed, setQrFailed] = useState(false);

  // Load the slug only when the parent did not hand one over.
  useEffect(() => {
    if (publicSlug !== undefined) return;
    if (!userId) return;
    let on = true;
    loadMyStorefront(userId)
      .then((p) => { if (on) setLoadedSlug(p?.public_slug?.trim() || null); })
      .catch(() => { if (on) setLoadedSlug(null); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, publicSlug]);

  const slug = publicSlug !== undefined ? publicSlug : loadedSlug;
  const inviteLink = buildBuyerInviteLink(slug);
  const qrUrl = buyerInviteQrUrl(inviteLink);

  function copy() {
    setCopyError('');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteLink).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        },
        () => setCopyError('Copy failed — select the link text manually.'),
      );
    } else {
      setCopyError('Copy is not available in this browser — select the link text manually.');
    }
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: 16 }}>
      <h4 style={{ fontSize: 14, margin: '0 0 4px' }}>Invite buyers — one-click link</h4>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 8px' }}>
        They register themselves — one tap on your link. Share it in a text, an email, a social
        post, or your OBL deal notes. Nobody is added as a buyer until they register.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={copy}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          Copy invite link
        </button>
        <span style={{ fontSize: 13, wordBreak: 'break-all', color: '#7dd3fc' }}>{inviteLink}</span>
      </div>
      {copied && (
        <div style={{ background: '#ecfdf5', color: '#0f172a', border: '1px solid #10b981', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 8 }}>
          Invite link copied.
        </div>
      )}
      {copyError && <p style={{ fontSize: 13, color: '#fca5a5', margin: '8px 0 0' }}>{copyError}</p>}
      {showQr && (
        <div style={{ marginTop: 12 }}>
          {qrFailed ? (
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0 }}>
              The QR image did not load — use the link above. For flyers and open houses, the
              link is: <span style={{ wordBreak: 'break-all' }}>{inviteLink}</span>
            </p>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR code for your buyer invite link" width={200} height={200} onError={() => setQrFailed(true)} />
              <p style={{ fontSize: 12, color: '#cbd5e1', margin: '4px 0 0', wordBreak: 'break-all' }}>{inviteLink}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
