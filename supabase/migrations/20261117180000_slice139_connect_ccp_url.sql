-- Slice 139 — Amazon Connect softphone (BYOK).
--
-- Adds the per-wholesaler Amazon Connect CCP URL to the unified
-- provider store (public.wholesaler_provider_settings, created in
-- Slice 137). Each wholesaler pastes their OWN Connect instance
-- URL; there is no shared platform instance. The table's existing
-- owner-only policies already cover the new column, so no new
-- policies, grants, or seed data are added here.

ALTER TABLE public.wholesaler_provider_settings ADD COLUMN IF NOT EXISTS connect_ccp_url TEXT;
