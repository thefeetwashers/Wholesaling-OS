-- Slice 134 — BYOK provider store: skip-trace / email / SMS keys
-- on THE unified provider store, plus the inbound SMS inbox.
--
-- This slice EXTENDS the unified per-wholesaler provider store
-- created in Slice 137 (public.wholesaler_provider_settings).
-- It adds skip-trace, email, and SMS key columns to THAT same
-- table. There is no second settings table and no separate
-- per-channel integrations table — everything lands here, one
-- row per wholesaler, owner-only RLS, exactly as Slice 137 set
-- it up. The existing owner-only RLS policies on
-- wholesaler_provider_settings stay untouched; no new policies
-- are needed for these columns.
--
-- Keys are plain TEXT columns, stored exactly as entered. No
-- transformation is applied to them here. RLS is owner-only, so
-- no other signed-in user can read a row; the service-role
-- client is the only server-side reader of full keys. The
-- get_provider_key_status() RPC below returns only masked keys,
-- so client code NEVER reads a full key.
--
-- BYOK only (founder decision, Nov 16, 2026): each wholesaler
-- brings their own provider keys. There is no operator key, and
-- no other key is ever read in place of the wholesaler's own.
--
-- SCOPE: exactly the 22 columns in section 1 below (the original
-- 16 plus the 6 sender-identity columns added below). The Google
-- skip-trace columns named in the Slice 137 header
-- (google_api_key, google_cse_id) are NOT added here — they are
-- outside this slice's column list.
--
-- SENDER IDENTITY (the 6 added columns): a provider key alone
-- cannot send — every send needs a sender identity (a from
-- number for SMS, a from email for email, plus Telnyx's public
-- key for verifying inbound signatures). Without these columns
-- Telnyx, httpSMS, Resend, and SendGrid would answer
-- NOT_CONFIGURED forever, key or no key. The columns are plain
-- TEXT, nullable, no defaults, exactly like the key columns.
--
-- NOTE on twilio_from_number: it is REQUIRED here even though
-- the original Slice 134 queue list omitted it. The existing
-- app/api/send/route.ts SMS branch selects twilio_account_sid,
-- twilio_auth_token, twilio_from_number and treats SMS as not
-- configured unless all three are set, and the batch blaster
-- needs a from-number from this store.
--
-- No seed data. No anon access (no anon policy, no anon grant).
-- GRANTs are in THIS file (the Nov 17 lesson: tables created
-- by migrations get no data grants by default).

-- 1. Provider key columns on the unified store. All plain TEXT,
-- nullable, no defaults. The two provider-preference columns
-- carry inline CHECKs (the Slice 137 ai_provider precedent) and
-- are nullable with no default.
alter table public.wholesaler_provider_settings
  add column if not exists batchdata_api_key text,
  add column if not exists resend_api_key text,
  add column if not exists sendgrid_api_key text,
  add column if not exists ses_access_key_id text,
  add column if not exists ses_secret_access_key text,
  add column if not exists ses_region text,
  add column if not exists ses_from_email text,
  add column if not exists twilio_account_sid text,
  add column if not exists twilio_auth_token text,
  add column if not exists twilio_from_number text,
  add column if not exists telnyx_api_key text,
  add column if not exists textbee_api_key text,
  add column if not exists textbee_device_id text,
  add column if not exists httpsms_api_key text,
  add column if not exists telnyx_from_number text,
  add column if not exists httpsms_from_number text,
  add column if not exists resend_from_email text,
  add column if not exists sendgrid_from_email text,
  add column if not exists telnyx_public_key text,
  add column if not exists httpsms_device_id text,
  add column if not exists email_provider text check (email_provider in ('resend', 'sendgrid', 'ses')),
  add column if not exists sms_provider text check (sms_provider in ('twilio', 'telnyx', 'textbee', 'httpsms'));

-- 2. sms_messages — the inbound SMS inbox store. One row per
-- message, owned by the wholesaler it belongs to. Writes come
-- only from the service-role Edge Functions (sms-inbound +
-- dispatcher), never from the browser: there are NO
-- authenticated INSERT / UPDATE / DELETE policies below, on
-- purpose. STOP handling sets cash_buyers.sms_opt_out; the
-- dispatcher re-checks it at send time.
create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text,
  to_number text,
  body text,
  provider text,
  status text,
  created_at timestamptz not null default now()
);

alter table public.sms_messages enable row level security;

create index if not exists idx_sms_messages_user
  on public.sms_messages (user_id, created_at desc);

-- Owner SELECT only.
drop policy if exists "wholesaler reads own sms messages" on public.sms_messages;
create policy "wholesaler reads own sms messages"
  on public.sms_messages
  for select
  to authenticated
  using (user_id = auth.uid());

-- The operator reads every wholesaler's SMS inbox (support and
-- oversight only — the operator never edits another office's rows).
drop policy if exists "operator reads all sms messages" on public.sms_messages;
create policy "operator reads all sms messages"
  on public.sms_messages
  for select
  to authenticated
  using (public.is_operator());

-- Grants (see header — without these the app cannot touch the
-- table at all, RLS policies notwithstanding). Authenticated
-- gets SELECT only: the browser never writes this table.
-- Service role does the writes from the Edge Functions.
grant select on public.sms_messages to authenticated;
grant select, insert, update, delete on public.sms_messages to service_role;
grant select on public.sms_messages to postgres;

-- 3. STOP handling: a buyer who texts STOP is opted out here;
-- the dispatcher re-checks this flag at send time.
alter table public.cash_buyers
  add column if not exists sms_opt_out boolean not null default false;

-- 4. Buy-box SMS opt-in checkbox. False by default, following
-- the email_alerts_opt_in precedent: the dispatcher only sends
-- buy-box SMS where this flag is true.
alter table public.wholesaler_buy_boxes
  add column if not exists sms_opt_in boolean not null default false;

-- 5. get_provider_key_status(): one row for the CALLER only —
-- which email / SMS provider they picked, whether each key is
-- set, and each key MASKED (first 4 chars + '…' + last 4 chars,
-- or null when no key). The mask is computed server-side, so
-- client code NEVER reads a full key. A caller with no settings
-- row yet gets one row with nulls / falses — never an error,
-- never another wholesaler's row. Follows the
-- get_ai_key_status() pattern exactly.
--
-- Sender identity is returned alongside the keys, as PLAIN TEXT
-- (from numbers / from emails are not secrets): telnyx_from_number,
-- httpsms_from_number, resend_from_email, sendgrid_from_email,
-- telnyx_public_key, httpsms_device_id. telnyx_public_key is a
-- PUBLIC key — it is exposed as plain text, never masked. The
-- has_telnyx_keys / has_httpsms_keys / has_resend_keys /
-- has_sendgrid_keys flags are true only when the key AND its
-- sender identity are both set — a key without its sender is
-- not fully keyed and cannot send.
create or replace function public.get_provider_key_status()
returns table (
  email_provider text,
  sms_provider text,
  has_batchdata_key boolean,
  batchdata_key_mask text,
  has_resend_key boolean,
  resend_key_mask text,
  resend_from_email text,
  has_resend_keys boolean,
  has_sendgrid_key boolean,
  sendgrid_key_mask text,
  sendgrid_from_email text,
  has_sendgrid_keys boolean,
  has_ses_keys boolean,
  ses_region text,
  ses_from_email text,
  has_twilio_keys boolean,
  twilio_from_number text,
  has_telnyx_key boolean,
  telnyx_key_mask text,
  telnyx_from_number text,
  telnyx_public_key text,
  has_telnyx_keys boolean,
  has_textbee_key boolean,
  textbee_key_mask text,
  textbee_device_id text,
  has_httpsms_key boolean,
  httpsms_key_mask text,
  httpsms_from_number text,
  httpsms_device_id text,
  has_httpsms_keys boolean
)
language sql
security definer
set search_path = public
as $$
  select
    s.email_provider as email_provider,
    s.sms_provider as sms_provider,
    coalesce(nullif(trim(s.batchdata_api_key), '') is not null, false) as has_batchdata_key,
    case
      when nullif(trim(s.batchdata_api_key), '') is not null
      then left(trim(s.batchdata_api_key), 4) || '…' || right(trim(s.batchdata_api_key), 4)
      else null
    end as batchdata_key_mask,
    coalesce(nullif(trim(s.resend_api_key), '') is not null, false) as has_resend_key,
    case
      when nullif(trim(s.resend_api_key), '') is not null
      then left(trim(s.resend_api_key), 4) || '…' || right(trim(s.resend_api_key), 4)
      else null
    end as resend_key_mask,
    s.resend_from_email as resend_from_email,
    coalesce(nullif(trim(s.resend_api_key), '') is not null and nullif(trim(s.resend_from_email), '') is not null, false) as has_resend_keys,
    coalesce(nullif(trim(s.sendgrid_api_key), '') is not null, false) as has_sendgrid_key,
    case
      when nullif(trim(s.sendgrid_api_key), '') is not null
      then left(trim(s.sendgrid_api_key), 4) || '…' || right(trim(s.sendgrid_api_key), 4)
      else null
    end as sendgrid_key_mask,
    s.sendgrid_from_email as sendgrid_from_email,
    coalesce(nullif(trim(s.sendgrid_api_key), '') is not null and nullif(trim(s.sendgrid_from_email), '') is not null, false) as has_sendgrid_keys,
    coalesce(nullif(trim(s.ses_access_key_id), '') is not null and nullif(trim(s.ses_secret_access_key), '') is not null and nullif(trim(s.ses_region), '') is not null and nullif(trim(s.ses_from_email), '') is not null, false) as has_ses_keys,
    s.ses_region as ses_region,
    s.ses_from_email as ses_from_email,
    coalesce(nullif(trim(s.twilio_account_sid), '') is not null and nullif(trim(s.twilio_auth_token), '') is not null and nullif(trim(s.twilio_from_number), '') is not null, false) as has_twilio_keys,
    s.twilio_from_number as twilio_from_number,
    coalesce(nullif(trim(s.telnyx_api_key), '') is not null, false) as has_telnyx_key,
    case
      when nullif(trim(s.telnyx_api_key), '') is not null
      then left(trim(s.telnyx_api_key), 4) || '…' || right(trim(s.telnyx_api_key), 4)
      else null
    end as telnyx_key_mask,
    s.telnyx_from_number as telnyx_from_number,
    s.telnyx_public_key as telnyx_public_key,
    coalesce(nullif(trim(s.telnyx_api_key), '') is not null and nullif(trim(s.telnyx_from_number), '') is not null, false) as has_telnyx_keys,
    coalesce(nullif(trim(s.textbee_api_key), '') is not null, false) as has_textbee_key,
    case
      when nullif(trim(s.textbee_api_key), '') is not null
      then left(trim(s.textbee_api_key), 4) || '…' || right(trim(s.textbee_api_key), 4)
      else null
    end as textbee_key_mask,
    s.textbee_device_id as textbee_device_id,
    coalesce(nullif(trim(s.httpsms_api_key), '') is not null, false) as has_httpsms_key,
    case
      when nullif(trim(s.httpsms_api_key), '') is not null
      then left(trim(s.httpsms_api_key), 4) || '…' || right(trim(s.httpsms_api_key), 4)
      else null
    end as httpsms_key_mask,
    s.httpsms_from_number as httpsms_from_number,
    s.httpsms_device_id as httpsms_device_id,
    coalesce(nullif(trim(s.httpsms_api_key), '') is not null and nullif(trim(s.httpsms_from_number), '') is not null, false) as has_httpsms_keys
  from (select 1) as dummy
  left join public.wholesaler_provider_settings s on s.user_id = auth.uid();
$$;

grant execute on function public.get_provider_key_status() to authenticated;

-- Rollback (only if this migration itself must be undone):
--   drop function if exists public.get_provider_key_status();
--   drop table if exists public.sms_messages;
--   alter table public.wholesaler_buy_boxes drop column if exists sms_opt_in;
--   alter table public.cash_buyers drop column if exists sms_opt_out;
--   alter table public.wholesaler_provider_settings drop column if exists sms_provider;
--   alter table public.wholesaler_provider_settings drop column if exists email_provider;
--   alter table public.wholesaler_provider_settings drop column if exists httpsms_device_id;
--   alter table public.wholesaler_provider_settings drop column if exists telnyx_public_key;
--   alter table public.wholesaler_provider_settings drop column if exists sendgrid_from_email;
--   alter table public.wholesaler_provider_settings drop column if exists resend_from_email;
--   alter table public.wholesaler_provider_settings drop column if exists httpsms_from_number;
--   alter table public.wholesaler_provider_settings drop column if exists telnyx_from_number;
--   alter table public.wholesaler_provider_settings drop column if exists httpsms_api_key;
--   alter table public.wholesaler_provider_settings drop column if exists textbee_device_id;
--   alter table public.wholesaler_provider_settings drop column if exists textbee_api_key;
--   alter table public.wholesaler_provider_settings drop column if exists telnyx_api_key;
--   alter table public.wholesaler_provider_settings drop column if exists twilio_from_number;
--   alter table public.wholesaler_provider_settings drop column if exists twilio_auth_token;
--   alter table public.wholesaler_provider_settings drop column if exists twilio_account_sid;
--   alter table public.wholesaler_provider_settings drop column if exists ses_from_email;
--   alter table public.wholesaler_provider_settings drop column if exists ses_region;
--   alter table public.wholesaler_provider_settings drop column if exists ses_secret_access_key;
--   alter table public.wholesaler_provider_settings drop column if exists ses_access_key_id;
--   alter table public.wholesaler_provider_settings drop column if exists sendgrid_api_key;
--   alter table public.wholesaler_provider_settings drop column if exists resend_api_key;
--   alter table public.wholesaler_provider_settings drop column if exists batchdata_api_key;
