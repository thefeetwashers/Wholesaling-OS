-- Slice 141 (audit fixes, workstream B) — audit #2: proof-of-funds
-- self-verify.
--
-- The hole: public.buyer_pof_documents has TWO permissive UPDATE
-- policies (migration 20261117141000) — "buyer updates own proof
-- of funds record" and "operator decides proof of funds". For an
-- UPDATE, Postgres requires the row to pass at least one policy's
-- USING and at least one policy's WITH CHECK — not necessarily
-- the SAME policy. So a buyer updating their own row passes the
-- buyer policy's USING (user_id = auth.uid()) and the operator
-- policy's WITH CHECK (status in ('verified','rejected') with
-- verified_at / verified_by filled in), and verifies their own
-- document with a direct PostgREST call. The RLS comments in
-- 20261117141000 claim otherwise; the claim was wrong.
--
-- The close, at the DB level: a BEFORE UPDATE trigger. RLS cannot
-- restrict this cleanly with permissive policies alone, and
-- tightening the policies into one would break the operator
-- decide path. The trigger refuses, for any signed-in
-- non-operator caller:
--   * setting status to 'verified' or 'rejected' (either
--     direction — a buyer may only ever put the row back to
--     'pending'), and
--   * leaving verified_at / verified_by non-null (only the
--     operator attaches a verification; a buyer re-upload
--     clears them to null, which stays allowed).
--
-- Preserved, unchanged:
--   * the buyer's pending upload / re-upload (submitPofDocument
--     upserts status 'pending' with verified_at / verified_by
--     null — passes the trigger);
--   * the operator decide flow (setPofStatus — public.is_operator()
--     passes the trigger, and the operator decide policy still
--     enforces verified_at / verified_by on a verify);
--   * service-role writes (auth.uid() is NULL on the service-role
--     path, e.g. webhooks / admin — pass untouched).
--
-- INSERT needs no trigger: the only INSERT policy is the buyer's,
-- whose WITH CHECK already forces status 'pending' with null
-- verification fields, and there is no operator INSERT policy to
-- combine with. No policy in 20261117141000 is edited here.
--
-- Grants are in this file (the Nov 17 lesson). No new secrets,
-- no new prices, no live status claimed. NOT APPLIED. NOT LIVE.

create or replace function public.guard_buyer_pof_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role writes (auth.uid() is NULL) and operator writes
  -- pass untouched.
  if auth.uid() is null or public.is_operator() then
    return new;
  end if;
  -- A signed-in non-operator may never decide a document.
  if new.status in ('verified', 'rejected') then
    raise exception 'Only the operator can verify or reject a proof-of-funds document.';
  end if;
  -- ... and may never leave a verification attached to the row.
  -- A buyer re-upload clears verified_at / verified_by to null,
  -- which stays allowed; keeping a verification while swapping
  -- the document is refused, so a new upload never keeps an old
  -- verified badge.
  if new.verified_at is not null or new.verified_by is not null then
    raise exception 'Only the operator can attach a verification to a proof-of-funds document.';
  end if;
  return new;
end;
$$;

drop trigger if exists buyer_pof_documents_guard_status on public.buyer_pof_documents;
create trigger buyer_pof_documents_guard_status
  before update on public.buyer_pof_documents
  for each row execute function public.guard_buyer_pof_status();

grant execute on function public.guard_buyer_pof_status() to authenticated;
grant execute on function public.guard_buyer_pof_status() to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop trigger if exists buyer_pof_documents_guard_status on public.buyer_pof_documents;
--   drop function if exists public.guard_buyer_pof_status();
