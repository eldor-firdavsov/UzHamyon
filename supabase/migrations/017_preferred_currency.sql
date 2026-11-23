-- ============================================================================
-- Migration: 017_preferred_currency.sql
-- Description: The currency the user wants to SEE everything in (UZS or USD).
--   - Mini App converts every amount (balance, totals, limits, goals, lists)
--     into this currency at the current exchange rate.
--   - New transactions (Mini App, Telegram bot, AI chat) default to it when the
--     user does not name a currency.
--   - Stored amounts are never rewritten: each row keeps its own currency.
-- Requires: 001. Safe to re-run (idempotent). Additive only.
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) NOT NULL DEFAULT 'UZS';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_currency_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_currency_check
      CHECK (preferred_currency IN ('UZS', 'USD'));
  END IF;
END $$;

COMMIT;
