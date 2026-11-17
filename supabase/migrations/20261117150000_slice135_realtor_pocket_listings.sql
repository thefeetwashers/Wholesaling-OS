-- Slice 135 — Agent pocket listings (realtor_pocket_listings).
--
-- A licensed agent submits an off-market pocket listing through the
-- public /agents form. The submission itself is NOT public: no
-- anon/authenticated SELECT exists on this table, and no direct
-- INSERT/UPDATE/DELETE policy exists either. The public path is
-- the SECURITY DEFINER function submit_realtor_pocket_listing()
-- below, which validates server-side and inserts one row. The
-- operator reads rows and flips status (the approve flow) under
-- public.is_operator() — the same pattern as the lender boxes in
-- 20261115090000 and published_deals in 20261117130000.
--
-- RLS + GRANTS ARE IN THIS FILE (the Nov 17 lesson): tables
-- created by migrations get NO data grants by default, so without
-- the grants below the operator table gets "permission denied"
-- and the feature silently does nothing. The RLS policies remain
-- the real gate. Policies are dropped before creation so the file
-- re-runs cleanly. public.is_operator() already exists — no
-- second function.
--
-- No fake data is seeded. No street address ever leaves this
-- table: the approve flow publishes city/state/ZIP only to
-- public.published_deals (see components/RealtorPocketListings.tsx).
-- Commission % and relist terms stay in this operator-only table
-- and are never copied into the published deal notes.

create table if not exists public.realtor_pocket_listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent_name text not null,
  brokerage text,
  agent_email text not null,
  agent_phone text not null,
  property_address text not null,
  city text not null,
  state_code text not null,
  zip text not null,
  asking_price numeric not null,
  estimated_arv numeric,
  commission_percent numeric,
  wants_relist boolean not null default false,
  property_notes text,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'approved', 'declined'))
);

alter table public.realtor_pocket_listings enable row level security;

create index if not exists idx_realtor_pocket_listings_status_created
  on public.realtor_pocket_listings (status, created_at desc);

-- The operator reads every submission (support and oversight only).
drop policy if exists "operator reads all pocket listings" on public.realtor_pocket_listings;
create policy "operator reads all pocket listings"
  on public.realtor_pocket_listings
  for select
  to authenticated
  using (public.is_operator());

-- The operator updates submissions — status changes only, used by
-- the approve flow (the app updates status and nothing else).
-- No other account may update a row it does not own, and there is
-- no owner row here: agents submit through the RPC, not by login.
drop policy if exists "operator updates pocket listings" on public.realtor_pocket_listings;
create policy "operator updates pocket listings"
  on public.realtor_pocket_listings
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- No INSERT / DELETE / public-SELECT policy on purpose: direct
-- writes are denied for everyone, and reads are operator-only.
-- Public submissions go through the function below.

grant select, insert, update, delete on public.realtor_pocket_listings to authenticated;
grant select, insert, update, delete on public.realtor_pocket_listings to service_role;

-- ----------------------------------------------------------------------------
-- submit_realtor_pocket_listing — the public submission path.
--
-- Same pattern as submit_seller_lead_v2 (20261115130000): a
-- SECURITY DEFINER function, so anon + authenticated callers can
-- submit without any direct table privilege. It validates
-- server-side and rejects invalid input with a plain error:
-- every required field non-empty, agent_email matches a basic
-- email shape, asking_price > 0, estimated_arv > 0 when given,
-- commission_percent null or 0–10, state_code exactly 2 letters,
-- zip non-empty. On success it inserts one row and returns only
-- the new row id — never any other row.
-- ----------------------------------------------------------------------------
create or replace function public.submit_realtor_pocket_listing(
  p_agent_name text,
  p_agent_email text,
  p_agent_phone text,
  p_property_address text,
  p_city text,
  p_state_code text,
  p_zip text,
  p_asking_price numeric,
  p_brokerage text default null,
  p_estimated_arv numeric default null,
  p_commission_percent numeric default null,
  p_wants_relist boolean default false,
  p_property_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_state text;
begin
  if nullif(trim(coalesce(p_agent_name, '')), '') is null then
    raise exception 'Agent name is required.';
  end if;
  if nullif(trim(coalesce(p_agent_email, '')), '') is null then
    raise exception 'Agent email is required.';
  end if;
  if trim(p_agent_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Enter a valid agent email address.';
  end if;
  if nullif(trim(coalesce(p_agent_phone, '')), '') is null then
    raise exception 'Agent phone is required.';
  end if;
  if nullif(trim(coalesce(p_property_address, '')), '') is null then
    raise exception 'Property street address is required.';
  end if;
  if nullif(trim(coalesce(p_city, '')), '') is null then
    raise exception 'City is required.';
  end if;
  v_state := upper(trim(coalesce(p_state_code, '')));
  if v_state !~ '^[A-Z]{2}$' then
    raise exception 'State must be exactly 2 letters.';
  end if;
  if nullif(trim(coalesce(p_zip, '')), '') is null then
    raise exception 'ZIP is required.';
  end if;
  if p_asking_price is null or p_asking_price <= 0 then
    raise exception 'Net asking price must be greater than 0.';
  end if;
  if p_estimated_arv is not null and p_estimated_arv <= 0 then
    raise exception 'Estimated ARV must be greater than 0 when given.';
  end if;
  if p_commission_percent is not null
     and (p_commission_percent < 0 or p_commission_percent > 10) then
    raise exception 'Commission must be between 0 and 10 percent.';
  end if;

  insert into public.realtor_pocket_listings (
    agent_name,
    brokerage,
    agent_email,
    agent_phone,
    property_address,
    city,
    state_code,
    zip,
    asking_price,
    estimated_arv,
    commission_percent,
    wants_relist,
    property_notes,
    status
  ) values (
    trim(p_agent_name),
    nullif(trim(coalesce(p_brokerage, '')), ''),
    trim(p_agent_email),
    trim(p_agent_phone),
    trim(p_property_address),
    trim(p_city),
    v_state,
    trim(p_zip),
    p_asking_price,
    p_estimated_arv,
    p_commission_percent,
    coalesce(p_wants_relist, false),
    nullif(trim(coalesce(p_property_notes, '')), ''),
    'new'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_realtor_pocket_listing(text, text, text, text, text, text, text, numeric, text, numeric, numeric, boolean, text) to anon, authenticated;

-- Rollback (only if this migration itself must be undone):
--   drop function if exists public.submit_realtor_pocket_listing(text, text, text, text, text, text, text, numeric, text, numeric, numeric, boolean, text);
--   drop table if exists public.realtor_pocket_listings;
