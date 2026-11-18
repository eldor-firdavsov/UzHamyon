-- ============================================================================
-- Migration: 014_reliability.sql
-- Description: Phase 1D reliability fixes.
--   1. get_auth_user_id_by_email(): find a user by email however many users exist (#35)
--   2. profiles.telegram_blocked_at / last_reminder_on: skip blocked users,
--      at most one reminder per Tashkent day, resumable broadcasts         (#36)
--   3. ai_conversations.channel + one 'telegram' conversation per user    (#40)
-- Requires: 001, 007.  Safe to re-run (idempotent).
-- Note: Do NOT apply automatically to production without explicit change review.
-- ============================================================================

BEGIN;

-- 1. USER LOOKUP BY EMAIL (service role only) --------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) TO service_role;

-- 2. REMINDER STATE ----------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_blocked_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_reminder_on DATE;

CREATE INDEX IF NOT EXISTS idx_profiles_reminder_candidates
  ON public.profiles (last_reminder_on, id)
  WHERE telegram_blocked_at IS NULL;

-- 3. ONE TELEGRAM CONVERSATION PER USER -------------------------------------------
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'web';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ai_conversations'::regclass AND conname = 'ai_conversations_channel_check'
  ) THEN
    ALTER TABLE public.ai_conversations
      ADD CONSTRAINT ai_conversations_channel_check CHECK (channel IN ('web', 'telegram'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_conversations_one_telegram_per_user
  ON public.ai_conversations (user_id)
  WHERE channel = 'telegram';

COMMIT;
