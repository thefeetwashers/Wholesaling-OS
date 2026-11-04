// Slice 39 — closing checklist badges for escrow files. Derived ONLY
// from data the wholesaler recorded: append-only milestone rows and
// the escrow file's own status fields (Slice: schema v2 + v3.8).
// Nothing is fetched from a title company and nothing is inferred
// from dates alone except the one honest signal a date CAN give:
// an EMD deadline that passed without the EMD being marked received
// needs attention.

export interface ChecklistFile {
  emd_status?: string;
  emd_deadline?: string | null;
  title_search_status?: string;
  file_status?: string;
  target_closing_date?: string | null;
  outcome?: string;
}

export type ChecklistState = 'done' | 'attention' | 'pending' | 'not_started';

export interface ChecklistItem {
  key: string;
  label: string;
  state: ChecklistState;
  detail: string;
}

export interface ClosingChecklist {
  items: ChecklistItem[];
  doneCount: number;
  totalCount: number;
  badgeKey: 'closed' | 'action_needed' | 'in_progress' | 'not_started';
  badgeLabel: string;
}

export const CLOSING_STEPS = [
  'Contract signed',
  'EMD received',
  'Title search ordered',
  'Title commitment received',
  'Closing scheduled',
  'Closed / funded',
] as const;

export function closingChecklist(file: ChecklistFile, milestoneNames: string[], now: Date = new Date()): ClosingChecklist {
  const has = (name: string) => milestoneNames.includes(name);
  const items: ChecklistItem[] = [];

  items.push({
    key: 'contract',
    label: 'Contract signed',
    state: has('Contract signed') ? 'done' : 'not_started',
    detail: has('Contract signed') ? 'Milestone recorded' : 'Not recorded yet',
  });

  const emdDeadlinePast = !!file.emd_deadline && new Date(file.emd_deadline).getTime() < now.getTime();
  if (file.emd_status === 'deficient_cancelled') {
    items.push({ key: 'emd', label: 'EMD received', state: 'attention', detail: 'EMD marked deficient / cancelled' });
  } else if (file.emd_status === 'received_verified' || has('EMD received')) {
    items.push({ key: 'emd', label: 'EMD received', state: 'done', detail: 'Marked received' });
  } else if (emdDeadlinePast) {
    items.push({ key: 'emd', label: 'EMD received', state: 'attention', detail: 'Deadline passed — not marked received' });
  } else {
    items.push({ key: 'emd', label: 'EMD received', state: 'pending', detail: file.emd_deadline ? 'Awaiting — deadline set' : 'Awaiting — no deadline set' });
  }

  const title = file.title_search_status || 'not_started';
  items.push({
    key: 'title_search',
    label: 'Title search ordered',
    state: has('Title search ordered') || title !== 'not_started' ? 'done' : 'not_started',
    detail: has('Title search ordered') ? 'Milestone recorded' : title !== 'not_started' ? `Search status: ${title.replace(/_/g, ' ')}` : 'Not recorded yet',
  });

  if (title === 'issues_found' && !has('Title commitment received')) {
    items.push({ key: 'commitment', label: 'Title commitment received', state: 'attention', detail: 'Title issues found — resolve before closing' });
  } else if (has('Title commitment received') || title === 'clear_title') {
    items.push({ key: 'commitment', label: 'Title commitment received', state: 'done', detail: has('Title commitment received') ? 'Milestone recorded' : 'Title marked clear' });
  } else if (title !== 'not_started' || has('Title search ordered')) {
    items.push({ key: 'commitment', label: 'Title commitment received', state: 'pending', detail: 'Search under way' });
  } else {
    items.push({ key: 'commitment', label: 'Title commitment received', state: 'not_started', detail: 'Not recorded yet' });
  }

  items.push({
    key: 'scheduled',
    label: 'Closing scheduled',
    state: has('Closing scheduled') || !!file.target_closing_date ? 'done' : 'pending',
    detail: has('Closing scheduled') ? 'Milestone recorded' : file.target_closing_date ? `Target date ${file.target_closing_date}` : 'No date recorded yet',
  });

  if (file.outcome === 'fell_through' || file.file_status === 'aborted_cancelled') {
    items.push({ key: 'closed', label: 'Closed / funded', state: 'attention', detail: 'File ended — fell through' });
  } else if (file.outcome === 'closed' || file.file_status === 'successfully_closed' || has('Closed / funded')) {
    items.push({ key: 'closed', label: 'Closed / funded', state: 'done', detail: 'Marked closed' });
  } else {
    items.push({ key: 'closed', label: 'Closed / funded', state: 'not_started', detail: 'Not closed yet' });
  }

  const doneCount = items.filter((i) => i.state === 'done').length;
  const closedDone = items[items.length - 1].state === 'done';
  const anyAttention = items.some((i) => i.state === 'attention');
  const badge = closedDone
    ? { badgeKey: 'closed' as const, badgeLabel: '✅ Closed' }
    : anyAttention
      ? { badgeKey: 'action_needed' as const, badgeLabel: '🔴 Action needed' }
      : doneCount > 0
        ? { badgeKey: 'in_progress' as const, badgeLabel: `🟡 In progress — ${doneCount} of ${items.length} steps` }
        : { badgeKey: 'not_started' as const, badgeLabel: '⚪ Not started' };

  return { items, doneCount, totalCount: items.length, ...badge };
}

// The next milestone the wholesaler can record, in checklist order —
// the first canonical step not already in the append-only log.
export function nextMilestone(milestoneNames: string[]): string | null {
  for (const step of CLOSING_STEPS) {
    if (!milestoneNames.includes(step)) return step;
  }
  return null;
}
