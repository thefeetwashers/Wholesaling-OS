-- Slice 137 (part A) — the unified per-wholesaler provider store.
--
-- This is THE unified provider store. There is no second store:
-- Slice 134 will ADD skip-trace / email / SMS columns to THIS
-- same table (batchdata_api_key, google_api_key, google_cse_id,
-- twilio_account_sid, twilio_auth_token, twilio_from_number,
-- ses_access_key_id, ses_secret_access_key, resend_api_key) —
-- it will NOT create another table. Part A adds only the AI
-- columns (ai_provider, gemini_api_key, groq_api_key) because
-- the AI Wholesale Copilot is what this slice ships.
--
-- NOTE (fail-closed until Slice 134): the existing /api/send
-- route (app/api/send/route.ts) and the skip-trace Edge
-- Functions (skip-trace-decision-maker, google-skip-trace)
-- select OTHER columns from this table (Twilio / SES / Resend
-- for sending; batchdata_api_key / google_api_key /
-- google_cse_id for skip-trace). Those columns do NOT exist
-- yet, so those lookups keep failing closed ("not configured")
-- exactly as they do today — this migration changes nothing
-- about them. Slice 134 adds those columns; do NOT add them
-- here.
--
-- BYOK ONLY (founder decision, Nov 16, 2026): each wholesaler
-- brings their OWN provider keys. There is no shared operator
-- key, no fallback, and no global GEMINI_API_KEY / GROQ_API_KEY
-- secret. The ai-wholesale-copilot Edge Function reads the
-- CALLER's own row server-side with the service-role client.
--
-- KEYS ARE PLAIN TEXT columns. They are stored as entered, in
-- plain text — NEVER claim they are "encrypted" anywhere (no
-- encryption is applied here). RLS is owner-only, so no other
-- signed-in user can read a row; the service-role client is
-- the only server-side reader. The get_ai_key_status() RPC
-- below returns only masked keys, so client code NEVER reads
-- a full key.
--
-- No seed data. No anon access (no anon policy, no anon grant).
-- GRANTs are in THIS file (the Nov 17 lesson: tables created
-- by migrations get no data grants by default).

create table if not exists public.wholesaler_provider_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  ai_provider text not null default 'gemini' check (ai_provider in ('gemini', 'groq')),
  gemini_api_key text,
  groq_api_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wholesaler_provider_settings enable row level security;

drop policy if exists wholesaler_provider_settings_select_own on public.wholesaler_provider_settings;
create policy wholesaler_provider_settings_select_own
  on public.wholesaler_provider_settings for select
  using (user_id = auth.uid());

drop policy if exists wholesaler_provider_settings_insert_own on public.wholesaler_provider_settings;
create policy wholesaler_provider_settings_insert_own
  on public.wholesaler_provider_settings for insert
  with check (user_id = auth.uid());

drop policy if exists wholesaler_provider_settings_update_own on public.wholesaler_provider_settings;
create policy wholesaler_provider_settings_update_own
  on public.wholesaler_provider_settings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists wholesaler_provider_settings_delete_own on public.wholesaler_provider_settings;
create policy wholesaler_provider_settings_delete_own
  on public.wholesaler_provider_settings for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.wholesaler_provider_settings to authenticated;
grant select, insert, update, delete on table public.wholesaler_provider_settings to service_role;

drop trigger if exists wholesaler_provider_settings_set_updated_at on public.wholesaler_provider_settings;
create trigger wholesaler_provider_settings_set_updated_at
  before update on public.wholesaler_provider_settings
  for each row execute function public.set_updated_at();

-- get_ai_key_status(): one row for the CALLER only — which AI
-- provider they picked, whether each key is set, and each key
-- MASKED (first 4 chars + '…' + last 4 chars, or null when no
-- key). The mask is computed server-side, so client code NEVER
-- reads a full key. A caller with no settings row yet gets one
-- row with the defaults (gemini, no keys, null masks) — never
-- an error, never another wholesaler's row.
create or replace function public.get_ai_key_status()
returns table (
  ai_provider text,
  has_gemini_key boolean,
  has_groq_key boolean,
  gemini_key_mask text,
  groq_key_mask text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(s.ai_provider, 'gemini') as ai_provider,
    coalesce(nullif(trim(s.gemini_api_key), '') is not null, false) as has_gemini_key,
    coalesce(nullif(trim(s.groq_api_key), '') is not null, false) as has_groq_key,
    case
      when nullif(trim(s.gemini_api_key), '') is not null
      then left(trim(s.gemini_api_key), 4) || '…' || right(trim(s.gemini_api_key), 4)
      else null
    end as gemini_key_mask,
    case
      when nullif(trim(s.groq_api_key), '') is not null
      then left(trim(s.groq_api_key), 4) || '…' || right(trim(s.groq_api_key), 4)
      else null
    end as groq_key_mask
  from (select 1) as dummy
  left join public.wholesaler_provider_settings s on s.user_id = auth.uid();
$$;

grant execute on function public.get_ai_key_status() to authenticated;

-- Rollback (only if this migration itself must be undone):
--   drop function if exists public.get_ai_key_status();
--   drop table if exists public.wholesaler_provider_settings;
