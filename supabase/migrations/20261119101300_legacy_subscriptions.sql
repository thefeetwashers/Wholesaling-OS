-- Legacy schema — subscriptions (6 live columns).
--
-- Documents the live schema as verified live Nov 19, 2026
-- (read-only live re-verification). The Nov 17 columns dump
-- recorded the WRONG columns for this table — user_id,
-- stripe_customer_id, tier, status 'inactive', updated_at —
-- and the Nov 19 live check corrected it. Use the 6 columns
-- below, NOT the Nov 17 columns dump's subscriptions entry.
--
-- Columns (6): id uuid NOT NULL default gen_random_uuid();
-- profile_id uuid NOT NULL; stripe_subscription_id text NOT
-- NULL; status text NOT NULL; current_period_end timestamptz
-- NULLABLE; created_at timestamptz NOT NULL default now().
--
-- Policy (1): "owners manage own subscriptions", ALL, TO public,
-- USING (auth.uid() = profile_id), WITH CHECK
-- (auth.uid() = profile_id) — consistent with the live columns.
--
-- No CHECK constraints on this table (per the dump).
--
-- Grants as dumped (Query 2, subscriptions (20), same as
-- buy_boxes): anon REFERENCES, TRIGGER, TRUNCATE; authenticated
-- DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
-- (all 7); postgres all 7; service_role REFERENCES, TRIGGER,
-- TRUNCATE ONLY — service_role holds NO data grants on any
-- legacy table; do NOT add any.
--
-- The dump lists NO foreign keys and NO indexes — none are added.
-- RLS enabled, NOT forced. NOT APPLIED. NOT LIVE.
--
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.subscriptions (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  stripe_subscription_id text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "owners manage own subscriptions" on public.subscriptions;
create policy "owners manage own subscriptions"
  on public.subscriptions
  for all
  to public
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

grant references, trigger, truncate on public.subscriptions to anon;
grant delete, insert, references, select, trigger, truncate, update on public.subscriptions to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.subscriptions to postgres;
grant references, trigger, truncate on public.subscriptions to service_role;
