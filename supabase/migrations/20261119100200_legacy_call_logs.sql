-- Legacy schema — call_logs (9 live columns).
--
-- Columns VERIFIED LIVE Nov 19, 2026 (read-only re-dump,
-- 17:21–17:31 EST). The Nov 17 columns dump listed the WRONG
-- columns for this table (deal_id, buyer_id, summary, caller,
-- created_at) — a stale snapshot. The 9 live columns below are
-- the truth. No fixes, no improvements: nullability, defaults,
-- policy, CHECK constraint, and grants are transcribed exactly.
-- RLS is enabled, NOT forced. The dump lists NO foreign keys
-- and NO indexes — none are added.
-- Policies are dropped before creation so the file re-runs cleanly.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.call_logs (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  lead_id uuid,
  called_at timestamptz not null default now(),
  duration_seconds integer,
  outcome text not null,
  notes text,
  next_step text,
  next_step_date date,
  constraint call_logs_outcome_check check (outcome in ('motivated', 'not_interested', 'follow_up', 'no_answer', 'wrong_number', 'do_not_call'))
);

alter table public.call_logs enable row level security;

drop policy if exists "owners manage own call logs" on public.call_logs;
create policy "owners manage own call logs"
  on public.call_logs
  for all
  to public
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Grants exactly as dumped (grants pattern A).
-- service_role holds NO data grants on any legacy table — recorded
-- as-is, do NOT add any.
grant references, trigger, truncate on public.call_logs to anon;
grant delete, insert, references, select, trigger, truncate, update on public.call_logs to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.call_logs to postgres;
grant references, trigger, truncate on public.call_logs to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.call_logs;
