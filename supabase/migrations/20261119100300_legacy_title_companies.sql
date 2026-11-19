-- Legacy schema — title_companies (10 live columns).
--
-- Columns VERIFIED LIVE Nov 19, 2026 (read-only re-dump,
-- 17:21–17:31 EST). The Nov 17 columns dump listed the WRONG
-- columns for this table (contact, licensed_states, trust_tier,
-- accepts_jv, accepts_wire, accepts_online_close, created_at) —
-- a stale snapshot. The 10 live columns below are the truth:
-- owner_id is NULLABLE (the "seed title companies readable"
-- policy's owner_id IS NULL only makes sense that way), states
-- replaces licensed_states, and portal_user is a real column,
-- so the "title users claim unlinked companies" policy is
-- consistent. No fixes, no improvements: nullability, defaults,
-- policies, and grants are transcribed exactly. RLS is enabled,
-- NOT forced. The dump lists NO foreign keys and NO indexes —
-- none are added. This file must precede the escrow_files legacy
-- migration, whose policies reference title_companies.
-- Policies are dropped before creation so the file re-runs cleanly.
-- Live baseline Nov 19, 2026: 7 rows.

create table if not exists public.title_companies (
  id uuid not null default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  states text[] not null default '{}'::text[],
  phone text,
  website text,
  assignment_friendly boolean not null default false,
  double_close_friendly boolean not null default false,
  notes text,
  portal_user uuid
);

alter table public.title_companies enable row level security;

drop policy if exists "owners manage own title companies" on public.title_companies;
create policy "owners manage own title companies"
  on public.title_companies
  for all
  to public
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "seed title companies readable" on public.title_companies;
create policy "seed title companies readable"
  on public.title_companies
  for select
  to public
  using (owner_id is null);

drop policy if exists "title users claim unlinked companies" on public.title_companies;
create policy "title users claim unlinked companies"
  on public.title_companies
  for update
  to authenticated
  using (portal_user is null)
  with check (portal_user = auth.uid());

-- Grants exactly as dumped. authenticated has NO delete and NO
-- insert on this table. service_role holds NO data grants on any
-- legacy table — recorded as-is, do NOT add any.
grant references, trigger, truncate on public.title_companies to anon;
grant references, select, trigger, truncate, update on public.title_companies to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.title_companies to postgres;
grant references, trigger, truncate on public.title_companies to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.title_companies;
