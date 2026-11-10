'use client';

// Slice 113 — First-10-Days Sprint. The activation path on the
// Command Center: five firsts, each checked off ONLY by the real
// record behind it (lib/sprint.ts) — a claimed county row, a roll
// search the panel itself stamped when it returned records, a Desk
// entry marked sent, the seller-page flag on the profile, the lead
// count. There is no "mark done" anywhere on this card, on purpose:
// a checklist you can click into completion teaches nothing, and
// the Day-91 Value Receipt reports exactly the value these five
// steps create. When all five are on the record, the card retires
// to a single line.

import { useEffect, useState } from 'react';
import { loadSprint, type SprintState } from '../lib/sprint';

interface Step {
  title: string;
  why: string;
  done: boolean;
  evidence: string;
  view: string;
  action: string;
}

export default function Sprint({
  userId,
  onNavigate,
}: {
  userId: string;
  onNavigate: (view: string) => void;
}) {
  const [state, setState] = useState<SprintState | null>(null);

  useEffect(() => {
    let live = true;
    loadSprint(userId)
      .then((s) => {
        if (live) setState(s);
      })
      .catch(() => {
        if (live) setState(null);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  if (!state) return null;

  const steps: Step[] = [
    {
      title: 'Claim your counties',
      why: 'Your markets focus everything else — the doors, the radar, the feed all lean on where you work.',
      done: state.countiesClaimed > 0,
      evidence:
        state.countiesClaimed > 0
          ? `${state.countiesClaimed} ${state.countiesClaimed === 1 ? 'county' : 'counties'} claimed on your account`
          : 'No counties claimed yet',
      view: 'records',
      action: 'Claim counties',
    },
    {
      title: 'Run your first state-roll search',
      why: 'The rolls above the Desk are live ownership records — owner, mailing address, values — free, in the states whose terms allow it.',
      done: state.rollStamp !== null,
      evidence: state.rollStamp
        ? `First search: ${state.rollStamp.state}, ${state.rollStamp.at} (this device)`
        : 'No roll search has returned records yet',
      view: 'records',
      action: 'Search a roll',
    },
    {
      title: 'Send your first records request',
      why: 'Probate, lis pendens, and fire lists have no feed anywhere — the Desk writes the public-records letter the office must answer.',
      done: state.deskSent,
      evidence: state.deskSent
        ? 'A Desk entry is logged as sent (this device)'
        : 'No Desk request logged as sent yet',
      view: 'records',
      action: 'Open the Desk',
    },
    {
      title: 'Publish your seller page',
      why: 'Your own door for sellers: a public page with your company, your terms, and a form that lands as a lead with consent recorded.',
      done: state.sellerPageLive,
      evidence: state.sellerPageLive ? 'Your seller page is live' : 'Seller page not published yet',
      view: 'dashboard',
      action: 'Set up the page',
    },
    {
      title: 'Build your first ten leads',
      why: 'Ten real leads is a pipeline: enough to work the call queue, tag the distress, and learn your market’s answers.',
      done: state.leadCount >= 10,
      evidence: `${state.leadCount} of 10 leads on your account`,
      view: 'leads',
      action: 'Add leads',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  if (doneCount === steps.length) {
    return (
      <section style={{ background: '#1e293b', padding: '12px 20px', borderRadius: 12, marginTop: 16 }}>
        <span style={{ fontSize: 13.5, color: '#6ee7b7', fontWeight: 600 }}>
          🏁 First-10-Days Sprint complete — all five firsts are on the record. The office is working.
        </span>
      </section>
    );
  }

  return (
    <section style={{ background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        🚀 Your first-10-days sprint — {doneCount} of {steps.length} on the record
      </h2>
      <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 12px', maxWidth: 880 }}>
        Five firsts that turn a new account into a working office. Each step checks off only when the
        real record behind it exists — a claimed county, a search that returned records, a request
        logged as sent, a live page, real leads. There is nothing to click into completion here; do the
        thing and the card knows.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {steps.map((s, i) => (
          <div
            key={s.title}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ fontSize: 18, lineHeight: 1.2 }}>{s.done ? '✅' : '⬜'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>
                {i + 1}. {s.title}
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 2 }}>{s.why}</div>
              <div style={{ fontSize: 12.5, color: s.done ? '#6ee7b7' : '#94a3b8', marginTop: 4 }}>
                {s.evidence}
              </div>
            </div>
            {!s.done && (
              <button
                type="button"
                onClick={() => onNavigate(s.view)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 9,
                  background: '#065f46',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.action} →
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
