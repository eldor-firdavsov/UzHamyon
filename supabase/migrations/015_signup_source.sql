-- ============================================================================
-- Migration: 015_signup_source.sql
-- Description: Where new users come from (Telegram deep links t.me/uz_hamyonbot?start=<source>).
--   - profiles.signup_source / signup_source_at: the FIRST source, never overwritten
--   - existing profiles are marked 'before_tracking' so they are never counted as new
--   - admin view: new users per source per day (Tashkent), service role / SQL editor only
-- Requires: 001.  Safe to re-run (idempotent).
-- Note: Do NOT apply automatically to production without explicit change review.
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_source TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_source_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_signup_source_format'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_signup_source_format
      CHECK (signup_source IS NULL OR signup_source ~ '^[a-z0-9_]{1,32}$');
  END IF;
END $$;

-- Everyone who exists before tracking starts is not a "new" user of any source.
UPDATE public.profiles
SET signup_source = 'before_tracking',
    signup_source_at = COALESCE(created_at, now())
WHERE signup_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_signup_source_at
  ON public.profiles (signup_source_at)
  WHERE signup_source IS NOT NULL;

CREATE OR REPLACE VIEW public.admin_new_users_by_source_daily
WITH (security_invoker = true) AS
SELECT
  (p.signup_source_at AT TIME ZONE 'Asia/Tashkent')::DATE AS day,
  p.signup_source AS source,
  COUNT(*)::INT AS new_users
FROM public.profiles p
WHERE p.signup_source IS NOT NULL
  AND p.signup_source <> 'before_tracking'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

-- Not readable through the public API: SQL editor / service role only.
REVOKE ALL ON public.admin_new_users_by_source_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_new_users_by_source_daily TO service_role;

COMMIT;
