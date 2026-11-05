-- Migration: 010_telegram_webhook_idempotency.sql
-- Description: Persistent Telegram webhook update idempotency table with unique constraint and crash recovery.
-- Note: Do NOT apply directly to production without explicit change authorization.

BEGIN;

CREATE TABLE IF NOT EXISTS public.telegram_webhook_updates (
  update_id BIGINT PRIMARY KEY,
  chat_id BIGINT,
  user_id BIGINT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for monitoring, cleanup, and status checks
CREATE INDEX IF NOT EXISTS idx_telegram_webhook_updates_status 
  ON public.telegram_webhook_updates (status, created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.telegram_webhook_updates ENABLE ROW LEVEL SECURITY;

-- Deny direct access to public/anon/authenticated roles; service role bypasses RLS
DROP POLICY IF EXISTS "telegram_webhook_updates_service_only" ON public.telegram_webhook_updates;
CREATE POLICY "telegram_webhook_updates_service_only" ON public.telegram_webhook_updates
  FOR ALL TO authenticated, anon
  USING (false);

COMMIT;
