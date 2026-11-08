'use client';

// Slice 65 — Screen Guard wrapper (owner directive Nov 8, 2026: strict
// anti-copy posture for list and deal surfaces).
//
// What this DOES: blocks right-click, text selection and clipboard copy on
// the wrapped surface, and tiles a faint viewer-email watermark across it,
// so a leaked screen photo names the account it came from.
// What this CANNOT do (stated honestly): no website can stop a phone camera
// or an OS screenshot. The platform's real protection is architectural —
// the database only ever sends a user their own records.
import React from 'react';

export default function ScreenGuard({ email, children }: { email: string; children: React.ReactNode }) {
  const block = (e: React.SyntheticEvent) => { e.preventDefault(); };
  const stamps = Array.from({ length: 12 });
  return (
    <div
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', position: 'relative' }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
        {stamps.map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${(i % 4) * 26 + 4}%`,
              left: `${Math.floor(i / 4) * 34 + 2}%`,
              transform: 'rotate(-18deg)',
              fontSize: 11,
              letterSpacing: 1,
              color: 'rgba(148,163,184,0.16)',
              whiteSpace: 'nowrap',
            }}
          >
            {email}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
