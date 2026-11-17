// Slice 133 — one-click buyer invite link (founder, Nov 17).
//
// HONEST SCOPE FIRST: no button can register ANOTHER platform's
// buyers for them — registration is always the buyer's own
// action. What one click CAN do is the buyer's tap on an invite
// link. This file builds that link, nothing more.
//
// Canonical link: /join?role=buyer — the join page reads the
// role from the URL query and pre-selects Buyer (it also still
// accepts the localStorage stash). When the wholesaler has a
// public_slug saved on their own storefront profile
// (loadMyStorefront — the same slug the /sell/<slug> page uses),
// the link carries ?ref=<slug> so the invite is attributable
// to them; otherwise it is the plain link. The ref is carried
// in the URL and stashed by /join as 'ws_invite_ref' — no
// attribution system reads it yet, and none is claimed.
//
// The QR code uses the SAME goqr.me format already verified
// live for the probate letter:
//   https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=<encoded>
// No OBL buyer data is copied or used anywhere in this flow,
// and no email is sent: the wholesaler pastes the link into
// their own texts, emails, social posts, or OBL deal notes.

export const BUYER_INVITE_BASE =
  'https://wholesalingos.thefeetwashers.com/join?role=buyer';

// The wholesaler's invite link. A missing/blank slug reads as
// the plain link — never a guessed slug.
export function buildBuyerInviteLink(publicSlug?: string | null): string {
  const slug = (publicSlug || '').trim().toLowerCase();
  return slug ? `${BUYER_INVITE_BASE}&ref=${encodeURIComponent(slug)}` : BUYER_INVITE_BASE;
}

// QR image URL for an invite link (goqr.me, verified live for
// the probate letter). The caller always shows the text URL
// under the QR as fallback.
export function buyerInviteQrUrl(inviteLink: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(inviteLink)}`;
}
