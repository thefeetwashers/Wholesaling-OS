'use client';

// Slice 25 — workspace sidebar. Every part of the office is one click
// from here; the main area shows ONE view at a time instead of the old
// single endless scroll. The Owner Admin item appears only for the
// platform owner's account (the console itself also self-gates).

export interface ShellView {
  key: string;
  label: string;
  icon: string;
}

export const SHELL_VIEWS: ShellView[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { key: 'today', label: 'Today', icon: '📅' },
  { key: 'assistant', label: 'AI Assistant', icon: '🤖' },
  { key: 'leads', label: 'Leads', icon: '🏘️' },
  { key: 'comms', label: 'Comms Center', icon: '💬' },
  { key: 'contracts', label: 'Contracts & Closing', icon: '📝' },
  { key: 'buyers', label: 'Buyers', icon: '💵' },
  { key: 'directory', label: 'Lenders & Vendors', icon: '🧰' },
  { key: 'money', label: 'Money', icon: '📊' },
  { key: 'records', label: 'Counties & Title', icon: '🗂️' },
];

export default function Sidebar({
  view,
  onView,
  showAdmin,
}: {
  view: string;
  onView: (key: string) => void;
  showAdmin: boolean;
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
      {SHELL_VIEWS.map(item)}
      {showAdmin && (
        <>
          <div className="ws-side-label">Platform owner</div>
          {item({ key: 'admin', label: 'Owner Admin', icon: '🛡️' })}
        </>
      )}
    </nav>
  );
}
