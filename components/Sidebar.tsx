'use client';

// Sidebar — workspace navigation, grouped by job (Slice 25 built the
// shell; Slice 43 grouped it and added the Listings, Seller Page, and
// Title Companies doors by splitting them out of combined views).
// Every part of the office is one click from here; the main area
// shows ONE view at a time. The Owner Admin item appears only for
// the platform owner's account (the console itself also self-gates).

export interface ShellView {
  key: string;
  label: string;
  icon: string;
  group: string;
}

export const SHELL_VIEWS: ShellView[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '🏠', group: 'Command' },
  { key: 'today', label: 'Today', icon: '📅', group: 'Command' },
  { key: 'assistant', label: 'AI Assistant', icon: '🤖', group: 'Command' },
  { key: 'leads', label: 'Leads', icon: '🏘️', group: 'Pipeline' },
  { key: 'probate', label: 'Probate Leads', icon: '⚖️', group: 'Pipeline' },
  { key: 'board', label: 'Pipeline Board', icon: '📋', group: 'Pipeline' },
  { key: 'field', label: 'Field Capture', icon: '📍', group: 'Pipeline' },
  { key: 'comms', label: 'Comms Center', icon: '💬', group: 'Pipeline' },
  { key: 'sellerpage', label: 'Seller Page & Intake', icon: '🎙️', group: 'Pipeline' },
  { key: 'contracts', label: 'Contracts & Closing', icon: '📝', group: 'Pipeline' },
  // Slice 129 — the JV Split calculator lives in Pipeline, next to
  // the contracts it feeds (it prints the existing JV agreement).
  { key: 'jvcalc', label: 'JV Split', icon: '🧮', group: 'Pipeline' },
  { key: 'listings', label: 'My Listings', icon: '📣', group: 'Pipeline' },
  { key: 'buyers', label: 'Buyers', icon: '💵', group: 'Network' },
  { key: 'cashbuyers', label: 'Cash Buyers', icon: '💰', group: 'Network' },
  { key: 'jvboard', label: 'JV Board', icon: '🤝', group: 'Network' },
  { key: 'directory', label: 'Lenders & Vendors', icon: '🧰', group: 'Network' },
  { key: 'titles', label: 'Title Companies', icon: '🏛️', group: 'Network' },
  { key: 'money', label: 'Money', icon: '📊', group: 'Money' },
  { key: 'records', label: 'Counties & Title', icon: '🗂️', group: 'Money' },
];

const GROUP_ORDER = ['Command', 'Pipeline', 'Network', 'Money'];

export default function Sidebar({
  view,
  onView,
  showAdmin,
  onReportProblem,
}: {
  view: string;
  onView: (key: string) => void;
  showAdmin: boolean;
  onReportProblem?: () => void;
}) {
  const item = (v: ShellView) => (
    <button
      key={v.key}
      className={view === v.key ? 'ws-side-item active' : 'ws-side-item'}
      onClick={() => onView(v.key)}
    >
      <span className="ws-side-ico">{v.icon}</span>
      {v.label}
    </button>
  );
  return (
    <nav className="ws-sidebar" aria-label="Workspace">
      <div className="ws-side-label">Your office</div>
      {GROUP_ORDER.map((g) => (
        <div key={g}>
          <div className="ws-side-label">{g}</div>
          {SHELL_VIEWS.filter((v) => v.group === g).map(item)}
        </div>
      ))}
      {showAdmin && (
        <>
          <div className="ws-side-label">Platform owner</div>
          {item({ key: 'admin', label: 'Owner Admin', icon: '🛡️', group: 'Platform owner' })}
          {/* Slice 129 — SaaS Admin (subscription rows, trial
              countdowns, plan status) is operator-only, like Owner
              Admin. RLS enforces it server-side too. */}
          {item({ key: 'saasadmin', label: 'SaaS Admin', icon: '💳', group: 'Platform owner' })}
          {/* Slice 130 — Operator Stats (real counts from live rows
              + problem-report triage) is operator-only too. */}
          {item({ key: 'opstats', label: 'Operator Stats', icon: '📈', group: 'Platform owner' })}
        </>
      )}
      {/* Slice 130 — Report a problem. The sidebar only renders for
          signed-in users, so this button is too. It opens the modal
          rendered by app/page.tsx; the report goes to the operator's
          desk in the app (the app never emails). */}
      {onReportProblem && (
        <button className="ws-side-item" onClick={onReportProblem}>
          <span className="ws-side-ico">🚩</span>
          Report a problem
        </button>
      )}
    </nav>
  );
}
