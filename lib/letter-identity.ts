// Slice 62 — the wholesaler's letter identity (name, business,
// phone, email) used by the direct-mail letter and the sign kit.
// Typed once by the wholesaler, kept on THIS device only
// (localStorage) — the platform stores nothing and invents
// nothing: blank fields print as the template's bracket slots,
// exactly like the Comms Center has always behaved.

export interface LetterIdentity {
  you: string;
  biz: string;
  phone: string;
  email: string;
}

const KEY = 'ws_letter_identity';

export function loadLetterIdentity(): LetterIdentity {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<LetterIdentity>;
      return { you: p.you || '', biz: p.biz || '', phone: p.phone || '', email: p.email || '' };
    }
  } catch { /* ignore */ }
  return { you: '', biz: '', phone: '', email: '' };
}

export function saveLetterIdentity(v: LetterIdentity): void {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The TitlePacket print pattern (Slice 47): a clean standalone
// document in a new window, printed or saved as PDF by the user.
export function openPrintWindow(title: string, bodyHtml: string): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${escHtml(title)}</title></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
