-- Slice 140 — Founder billing exemption.
--
-- The founder's own account never pays the $150/mo subscription
-- fee, never sees a trial-expired / pay prompt, and must never be
-- charged or status-changed by Stripe. This adds a single boolean
-- flag to public.saas_subscriptions and sets it on the founder's
-- row only.
--
-- The email literal below is the same one public.is_operator()
-- (migration 20261115090000) uses — it is the repo's ONE operator
-- definition, and it appears nowhere in app code. The existing
-- row-based policies from migration 20261115170000 ("wholesaler
-- reads own subscription" / "operator reads all subscriptions")
-- already cover the new column, so no new policies, grants, or
-- tables are added here. No new plan_status value is introduced.

ALTER TABLE public.saas_subscriptions ADD COLUMN IF NOT EXISTS is_founder_exempt boolean NOT NULL DEFAULT false;

UPDATE public.saas_subscriptions SET is_founder_exempt = true WHERE user_id IN (SELECT id FROM public.profiles WHERE email = 'thefeetwashers@gmail.com');
