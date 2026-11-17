-- ============================================================================
-- WholesalingOS — Slice 133 item 2: proof-of-funds verification.
-- Migration file ONLY. NOT APPLIED. NOT LIVE.
--
-- A cash buyer uploads a proof-of-funds document (bank letter or
-- statement) into a PRIVATE Supabase Storage bucket; the operator
-- reviews it in the app (components/ProofOfFundsReview.tsx, wired
-- into components/OperatorStats.tsx) and marks it verified or
-- rejected. A verified buy box then shows "POF verified" + the
-- verification date in the public Cash Buyers directory
-- (components/BuyerPofStatus.tsx). No verified badge exists
-- without an actual operator check: the badge reads ONLY from
-- rows the operator set to 'verified'.
--
-- Privacy, by construction:
--   * The 'buyer-pof-documents' bucket is PRIVATE. Nobody gets a
--     public URL; the operator opens a document only through a
--     1-hour signed URL minted with the operator's own session
--     (lib/proof-of-funds.ts mintPofSignedUrl), gated by the
--     storage policies below.
--   * The tracking table holds NO bank account numbers and NO
--     amounts — only the storage path, the status, and the
--     verification timestamps. No account number is ever
--     displayed anywhere in the app.
--   * The public read path is ONLY the view
--     public.verified_buyer_pof, which exposes exactly two
--     columns (user_id, verified_at) and only for rows whose
--     status is 'verified'. It contains no storage path, no
--     status history, and no document content. The view is
--     deliberately NOT security_invoker: with security_invoker
--     the underlying table's RLS (no anon access at all) would
--     make the view return nothing for the public directory.
--   * No anon access to the table or the bucket at all.
--
-- One current document per buyer: UNIQUE(user_id). A rejected
-- buyer re-uploads and the row returns to 'pending' (verified_at
-- and verified_by cleared); a verified buyer who re-uploads also
-- returns to 'pending' until the operator checks the new
-- document — a new upload never keeps an old verified badge.
--
-- Ordering: bucket (1) -> table (2) -> indexes + trigger (3) ->
-- table policies (4) -> public view (5) -> grants (6). No policy
-- or function here references a table created later in this file.
-- public.is_operator() and public.set_updated_at() already exist
-- (migration 20261115090000_capital_lending_lender_role.sql).
-- Policies are dropped before creation so the file re-runs cleanly.
-- Nothing here sends email or messages.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Private 'buyer-pof-documents' Storage bucket + policies.
--    Pattern follows Slice 125 ('storefront-videos'): a buyer
--    uploads only under their own user id (<user_id>/…), reads
--    only their own document, deletes only their own; the
--    operator reads all. No public access, no public listing.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('buyer-pof-documents', 'buyer-pof-documents', false)
on conflict (id) do nothing;

drop policy if exists "buyer uploads own proof of funds" on storage.objects;
create policy "buyer uploads own proof of funds"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'buyer-pof-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "buyer reads own proof of funds" on storage.objects;
create policy "buyer reads own proof of funds"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'buyer-pof-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "buyer deletes own proof of funds" on storage.objects;
create policy "buyer deletes own proof of funds"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'buyer-pof-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "operator reads all proof of funds" on storage.objects;
create policy "operator reads all proof of funds"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'buyer-pof-documents'
    and public.is_operator()
  );

-- ----------------------------------------------------------------------------
-- 2. Tracking table. Status states only:
--      pending  — uploaded, waiting for the operator
--      verified — the operator checked the document
--      rejected — the operator checked it and did not accept it
--    verified_at is set only by a verify; verified_by is the
--    operator who decided (verify or reject). No amount, no
--    account number, no document content lives in this table.
-- ----------------------------------------------------------------------------
create table if not exists public.buyer_pof_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  uploaded_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyer_pof_documents_user_unique unique (user_id)
);

alter table public.buyer_pof_documents enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Indexes + updated_at trigger.
-- ----------------------------------------------------------------------------
create index if not exists idx_buyer_pof_documents_user
  on public.buyer_pof_documents (user_id);

create index if not exists idx_buyer_pof_documents_status
  on public.buyer_pof_documents (status);

drop trigger if exists buyer_pof_documents_set_updated_at on public.buyer_pof_documents;
create trigger buyer_pof_documents_set_updated_at
  before update on public.buyer_pof_documents
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Table RLS. The buyer reads/inserts/updates/deletes only
--    their own row, and can only ever put it back to 'pending'
--    with no verification attached — a buyer can never verify
--    their own document. The operator reads all rows and is the
--    only account that moves a status to 'verified' or
--    'rejected'; a verify must carry a verification time and a
--    deciding operator. No anon policy exists: anon reads nothing.
-- ----------------------------------------------------------------------------
drop policy if exists "buyer reads own proof of funds record" on public.buyer_pof_documents;
create policy "buyer reads own proof of funds record"
  on public.buyer_pof_documents
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "buyer inserts own proof of funds record" on public.buyer_pof_documents;
create policy "buyer inserts own proof of funds record"
  on public.buyer_pof_documents
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and verified_at is null
    and verified_by is null
  );

drop policy if exists "buyer updates own proof of funds record" on public.buyer_pof_documents;
create policy "buyer updates own proof of funds record"
  on public.buyer_pof_documents
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and verified_at is null
    and verified_by is null
  );

drop policy if exists "buyer deletes own proof of funds record" on public.buyer_pof_documents;
create policy "buyer deletes own proof of funds record"
  on public.buyer_pof_documents
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "operator reads all proof of funds records" on public.buyer_pof_documents;
create policy "operator reads all proof of funds records"
  on public.buyer_pof_documents
  for select
  to authenticated
  using (public.is_operator());

drop policy if exists "operator decides proof of funds" on public.buyer_pof_documents;
create policy "operator decides proof of funds"
  on public.buyer_pof_documents
  for update
  to authenticated
  using (public.is_operator())
  with check (
    status in ('verified', 'rejected')
    and (status <> 'verified' or verified_at is not null)
    and (status <> 'verified' or verified_by is not null)
  );

-- ----------------------------------------------------------------------------
-- 5. Public view: the ONLY public read path. Exactly two columns
--    (user_id, verified_at), only for rows the operator verified.
--    The public Cash Buyers directory (/buyers) reads this view to
--    show "POF verified" + the date on a published buy box. It
--    exposes no storage path, no pending/rejected rows, and no
--    document content of any kind.
-- ----------------------------------------------------------------------------
create or replace view public.verified_buyer_pof as
select user_id, verified_at
  from public.buyer_pof_documents
 where status = 'verified';

-- ----------------------------------------------------------------------------
-- 6. Grants. Without these the app cannot touch the table at all,
--    RLS policies notwithstanding (the Nov 17 lesson). Anon gets
--    SELECT on the view ONLY — never on the table, never on the
--    bucket.
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.buyer_pof_documents to authenticated;
grant select, insert, update, delete on public.buyer_pof_documents to service_role;
grant select on public.verified_buyer_pof to anon;
grant select on public.verified_buyer_pof to authenticated;

-- Rollback (only if this migration itself must be undone):
--   revoke select on public.verified_buyer_pof from anon;
--   revoke select on public.verified_buyer_pof from authenticated;
--   drop view if exists public.verified_buyer_pof;
--   drop table if exists public.buyer_pof_documents;
--   drop policy if exists "buyer uploads own proof of funds" on storage.objects;
--   drop policy if exists "buyer reads own proof of funds" on storage.objects;
--   drop policy if exists "buyer deletes own proof of funds" on storage.objects;
--   drop policy if exists "operator reads all proof of funds" on storage.objects;
--   delete from storage.buckets where id = 'buyer-pof-documents';
