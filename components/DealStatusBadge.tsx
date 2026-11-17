// Slice 133 — deal status badge for the directory and detail page.
//
// Standalone component: renders the published_deals status as a
// small pill. Unknown or missing values (e.g. rows read before
// the Slice 133 migration was applied) read as 'Active', the
// column default — never a blank badge, never an invented status.
// Colors only; the status word itself is always shown as text.

import { normalizeDealStatus, type DealStatus } from '../lib/deal-status';

const STYLES: Record<DealStatus, React.CSSProperties> = {
  Active: {
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #86efac',
  },
  'Under Contract': {
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d',
  },
  Sold: {
    background: '#e2e8f0',
    color: '#334155',
    border: '1px solid #cbd5e1',
  },
};

export default function DealStatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeDealStatus(status);
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        ...STYLES[normalized],
      }}
    >
      {normalized}
    </span>
  );
}
