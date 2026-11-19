-- Legacy schema — buy_boxes (13 live columns).
--
-- Columns VERIFIED LIVE Nov 19, 2026 (read-only re-dump,
-- 17:21–17:31 EST). The Nov 17 columns dump listed the WRONG
-- columns for this table (owner_id, buyer_id, name, min_price,
-- max_price, min_arv, max_arv, min_bedrooms, min_bathrooms) —
-- a stale snapshot. The 13 live columns below are the truth,
-- and the "buyers manage own buy boxes" policy's user_id is a
-- real column, so the policy is consistent. No fixes, no
-- improvements: nullability, defaults, policies, and grants are
-- transcribed exactly. RLS is enabled, NOT forced. The dump
-- lists NO foreign keys and NO indexes — none are added.
-- Policies are dropped before creation so the file re-runs cleanly.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.buy_boxes (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  label text not null default 'My Buy Box'::text,
  states text[] not null default '{}'::text[],
  counties text[] not null default '{}'::text[],
  cities text[] not null default '{}'::text[],
  property_types text[] not null default '{}'::text[],
  price_min numeric,
  price_max numeric,
  min_beds integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.buy_boxes enable row level security;

drop policy if exists "buy boxes readable by signed-in users" on public.buy_boxes;
create policy "buy boxes readable by signed-in users"
  on public.buy_boxes
  for select
  to authenticated
  using (true);

drop policy if exists "buyers manage own buy boxes" on public.buy_boxes;
create policy "buyers manage own buy boxes"
  on public.buy_boxes
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Grants exactly as dumped (grants pattern A).
-- service_role holds NO data grants on any legacy table — recorded
-- as-is, do NOT add any.
grant references, trigger, truncate on public.buy_boxes to anon;
grant delete, insert, references, select, trigger, truncate, update on public.buy_boxes to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.buy_boxes to postgres;
grant references, trigger, truncate on public.buy_boxes to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.buy_boxes;
