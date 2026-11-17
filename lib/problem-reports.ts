import { supabase, supabaseConfigured } from './supabase';

// Slice 130 — problem reports. A signed-in user files a report
// from the dashboard; the operator triages it in OperatorStats.
// The row IS the report: the app never emails (no email service is
// wired), and the modal says so. Reporters read only their own
// rows; the operator reads all and is the only account that moves
// a status. Every write selects its row back, so a refused save
// throws instead of looking saved.

export const PROBLEM_CATEGORIES = [
  { value: 'listing', label: 'Listing' },
  { value: 'scout_lead', label: 'Scout lead' },
  { value: 'payment', label: 'Payment' },
  { value: 'term_sheet', label: 'Term sheet' },
  { value: 'storefront', label: 'Storefront' },
  { value: 'other', label: 'Other' },
] as const;

export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number]['value'];
export type ProblemStatus = 'open' | 'reviewing' | 'resolved';

export const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = {
  open: 'Open',
  reviewing: 'Reviewing',
  resolved: 'Resolved',
};

export interface ProblemReport {
  id?: string;
  user_id?: string;
  category: ProblemCategory;
  subject: string;
  details: string;
  page_context?: string | null;
  status: ProblemStatus;
  created_at?: string;
  updated_at?: string;
}

const REPORT_SELECT =
  'id, user_id, category, subject, details, page_context, status, created_at, updated_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so the report was not saved. No report was faked.'
    );
  }
  return supabase;
}

export async function submitProblemReport(
  userId: string,
  report: { category: ProblemCategory; subject: string; details: string; pageContext: string | null }
): Promise<ProblemReport> {
  const client = requireSupabase();
  if (!report.subject.trim()) throw new Error('Add a short subject for the report.');
  if (!report.details.trim()) throw new Error('Describe the problem — details are required.');
  const { data, error } = await client
    .from('problem_reports')
    .insert({
      user_id: userId,
      category: report.category,
      subject: report.subject.trim(),
      details: report.details.trim(),
      page_context: report.pageContext || null,
      status: 'open',
    })
    .select(REPORT_SELECT)
    .single();
  if (error) throw error;
  return data as ProblemReport;
}

// Operator only: every report, newest first. RLS decides what this
// account may see — a non-operator gets an empty result (or an
// error), never another user's reports.
export async function loadAllProblemReports(): Promise<ProblemReport[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('problem_reports')
    .select(REPORT_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ProblemReport[];
}

// Operator only: move a report's status. Verified write — the
// update selects its row back, so a refused save throws.
export async function setProblemReportStatus(reportId: string, status: ProblemStatus): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('problem_reports')
    .update({ status })
    .eq('id', reportId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'The status did not save — the report may not exist, or the Slice 130 migration has not been applied yet.'
    );
  }
}
