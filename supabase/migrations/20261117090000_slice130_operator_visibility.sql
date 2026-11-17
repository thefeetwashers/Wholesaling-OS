-- Slice 130 — Operator visibility: W-9 gate on scout payouts,
-- term sheet rate/term, and problem reports.
--
-- (a) scout_leads gains w9_received + w9_received_at, and a CHECK
-- that status 'closed_paid_1000' requires w9_received = TRUE. The
-- Scout Finder's Fee Agreement already pays only "upon receipt of
-- the Scout's completed IRS Form W-9" — this makes the database
-- enforce what the agreement already says. No scout lead has ever
-- reached closed_paid_1000 (no live proof anywhere), so the CHECK
-- has no existing row to refuse.
-- (b) funding_requests gains interest_rate + loan_term_months,
-- each NULL until the operator sets it, each > 0 when set. The term
-- sheet keeps rendering "TO BE AGREED" while either is blank.
-- (c) problem_reports — a report a signed-in user files from the
-- dashboard; the operator triages it in OperatorStats. The app
-- never emails: the row IS the report, on the operator's desk in
-- the app. No DELETE policy — reports are kept as a record.
-- Order: columns → table → policies. No policy or function here
-- references a table created later in this file. Existing RLS on
-- other tables is untouched — the claiming wholesaler can already
-- update their claimed scout leads (policy "claiming wholesaler
-- advances scout lead"), so the W-9 checkbox needs no new policy.

alter table public.scout_leads
  add column if not exists w9_received boolean not null default false,
  add column if not exists w9_received_at timestamptz;

alter table public.scout_leads
  drop constraint if exists scout_leads_w9_before_paid;
alter table public.scout_leads
  add constraint scout_leads_w9_before_paid
  check (status <> 'closed_paid_1000' or w9_received = true);

alter table public.funding_requests
  add column if not exists interest_rate numeric
    check (interest_rate is null or interest_rate > 0),
  add column if not exists loan_term_months integer
    check (loan_term_months is null or loan_term_months > 0);

create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  category text not null
    check (category in ('listing', 'scout_lead', 'payment', 'term_sheet', 'storefront', 'other')),
  subject text not null,
  details text not null,
  page_context text,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.problem_reports enable row level security;

create index if not exists idx_problem_reports_user
  on public.problem_reports (user_id);
create index if not exists idx_problem_reports_status
  on public.problem_reports (status);

drop trigger if exists problem_reports_set_updated_at on public.problem_reports;
create trigger problem_reports_set_updated_at
  before update on public.problem_reports
  for each row execute function public.set_updated_at();

-- The reporter inserts their own report and reads it back.
drop policy if exists "reporter inserts own problem report" on public.problem_reports;
create policy "reporter inserts own problem report"
  on public.problem_reports
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reporter reads own problem reports" on public.problem_reports;
create policy "reporter reads own problem reports"
  on public.problem_reports
  for select
  to authenticated
  using (user_id = auth.uid());

-- The operator reads every report (support and oversight only) and
-- is the only account that moves a report's status.
drop policy if exists "operator reads all problem reports" on public.problem_reports;
create policy "operator reads all problem reports"
  on public.problem_reports
  for select
  to authenticated
  using (public.is_operator());

drop policy if exists "operator updates problem report status" on public.problem_reports;
create policy "operator updates problem report status"
  on public.problem_reports
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.problem_reports;
--   alter table public.funding_requests drop column if exists interest_rate, drop column if exists loan_term_months;
--   alter table public.scout_leads drop constraint if exists scout_leads_w9_before_paid, drop column if exists w9_received, drop column if exists w9_received_at;
