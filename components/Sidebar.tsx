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
  { key: 'comms', label: 'Comms Center', icon: '💬', group: 'Pipeline' },
  { key: 'sellerpage', label: 'Seller Page & Intake', icon: '🎙️', group: 'Pipeline' },
  { key: 'contracts', label: 'Contracts & Closing', icon: '📝', group: 'Pipeline' },
  { key: 'listings', label: 'My Listings', icon: '📣', group: 'Pipeline' },
  { key: 'buyers', label: 'Buyers', icon: '💵', group: 'Network' },
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
        </>
      )}
    </nav>
  );
}
