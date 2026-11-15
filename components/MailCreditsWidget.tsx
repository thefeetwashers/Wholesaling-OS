import React, { useEffect, useState } from 'react';
import { loadMailBalance, loadMailLedger, MAIL_PRICE_PER_LETTER, type MailCreditRow } from '../lib/mail-credits';

// Slice 122 — Send via Direct Mail ($0.85/letter). The widget shows
// the user's balance as SUM(credits_delta) from the ledger. The
// $0.85/letter price is the user's own figure, displayed as the
// price. Sending is NOT wired to any print provider — the Send
// button is disabled, with an honest note, and no credits are
// deducted and no letter is claimed sent until sending is live.
export default function MailCreditsWidget({ userId }: { userId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<MailCreditRow[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    loadMailBalance(userId)
      .then(setBalance)
      .catch((e: any) => setErr(e?.message || 'Could not load your mail credits.'));
    loadMailLedger(userId)
      .then(setLedger)
      .catch(() => {});
  }, [userId]);

  const lettersAffordable = balance != null ? Math.floor(balance / MAIL_PRICE_PER_LETTER) : 0;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff', marginTop: 12 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Send via Direct Mail ($0.85/letter)</h3>
      {err ? (
        <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>
      ) : balance == null ? (
        <p style={{ fontSize: 13, color: '#64748b' }}>Loading your credit balance…</p>
      ) : (
        <>
          <p style={{ fontSize: 14, margin: '4px 0' }}>
            Credit balance: <strong>{balance.toLocaleString()} credits</strong> · ${MAIL_PRICE_PER_LETTER.toFixed(2)}/letter · covers{' '}
            <strong>{lettersAffordable.toLocaleString()} letters</strong>
          </p>
          <button
            disabled
            title="Mail sending connects when a print provider is connected — credits are not charged until sending is live."
            style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#64748b', fontWeight: 700, cursor: 'not-allowed' }}
          >
            Send via Direct Mail
          </button>
          <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
            Mail sending connects when a print provider is connected — credits are not charged until sending is live. No letter has been
            sent from this widget.
          </p>
          {ledger.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>Credit history</h4>
              {ledger.slice(0, 10).map((r) => (
                <p key={r.id} style={{ fontSize: 12, color: '#475569', margin: '3px 0' }}>
                  {Number(r.credits_delta) > 0 ? '+' : ''}
                  {r.credits_delta} credits
                  {r.description ? ` — ${r.description}` : ''}
                  {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
