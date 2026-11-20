-- ============================================================================
-- Migration: 016_activity_days.sql
-- Description: Logging streak.
--   - activity_days: one row per user per Tashkent day on which the user LOGGED
--     at least one transaction (manual, Telegram text or voice). Imports do not count.
--   - Filled by an AFTER INSERT trigger on transactions, so every write path counts
--     (Mini App, bot, AI executor) without app code changes.
--   - The day is the Tashkent date of the moment of logging (now()), NOT the
--     transaction's own date: backfilling yesterday's expense today counts for today.
--   - Deleting a transaction keeps the day (the user still showed up).
--   - Backfill from existing rows uses transaction_date (best available history).
-- Requires: 007, 012.  Safe to re-run (idempotent).
-- Note: Do NOT apply automatically to production without explicit change review.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.activity_days (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.activity_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_days_select_own" ON public.activity_days;
CREATE POLICY "activity_days_select_own" ON public.activity_days
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
-- No INSERT/UPDATE/DELETE policies: only the trigger below (SECURITY DEFINER) writes.

CREATE OR REPLACE FUNCTION public.record_activity_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source IN ('csv', 'excel') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.activity_days (user_id, day)
  VALUES (NEW.user_id, (now() AT TIME ZONE 'Asia/Tashkent')::date)
  ON CONFLICT (user_id, day) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_activity_day() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_transactions_activity_day ON public.transactions;
CREATE TRIGGER trg_transactions_activity_day
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_day();

-- History: days that already have logged (non-import) transactions.
INSERT INTO public.activity_days (user_id, day)
SELECT DISTINCT user_id, transaction_date
FROM public.transactions
WHERE source NOT IN ('csv', 'excel')
  AND transaction_date <= (now() AT TIME ZONE 'Asia/Tashkent')::date
ON CONFLICT (user_id, day) DO NOTHING;

COMMIT;
