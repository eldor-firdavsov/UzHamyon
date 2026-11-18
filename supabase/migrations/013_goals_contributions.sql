-- ============================================================================
-- Migration: 013_goals_contributions.sql
-- Description: Phase 1C — savings (jamg'arma) history and goal correctness.
--   1. Default currency 'UZS' (transactions, financial_goals, budgets)        (#32)
--   2. goal_contributions table: every add (+) / withdraw (-) is a row        (#29)
--      + triggers that keep financial_goals.current_amount in sync in the
--        same DB transaction, for every code path (old ones included)
--   3. One "Boshlang'ich qoldiq" row per existing goal with money in it       (#29)
--   4. completed_notified_at / deadline_notified_at for one-time notices      (#33)
--   5. find_user_goal(): one goal-matching rule                               (#30)
--   6. execute_pending_ai_action_atomic: uses find_user_goal, writes
--      contributions, keeps 'cancelled', checks currency                      (#28-#31)
-- Requires: 007, 011, 012.  Safe to re-run (idempotent).
-- Note: Do NOT apply automatically to production without explicit change review.
-- ============================================================================

BEGIN;

-- 1. DEFAULT CURRENCY ------------------------------------------------------------
ALTER TABLE public.transactions    ALTER COLUMN currency SET DEFAULT 'UZS';
ALTER TABLE public.financial_goals ALTER COLUMN currency SET DEFAULT 'UZS';
ALTER TABLE public.budgets         ALTER COLUMN currency SET DEFAULT 'UZS';

-- 2. NOTIFICATION FLAGS ------------------------------------------------------------
ALTER TABLE public.financial_goals ADD COLUMN IF NOT EXISTS completed_notified_at TIMESTAMPTZ;
ALTER TABLE public.financial_goals ADD COLUMN IF NOT EXISTS deadline_notified_at TIMESTAMPTZ;

-- Goals that are already completed must not get a "congrats" message right after deploy.
UPDATE public.financial_goals
SET completed_notified_at = now()
WHERE status = 'completed' AND completed_notified_at IS NULL;

-- A new target date means a new deadline: allow one new deadline notice.
CREATE OR REPLACE FUNCTION public.reset_goal_deadline_notice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.target_date IS DISTINCT FROM OLD.target_date THEN
    NEW.deadline_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_goals_reset_deadline_notice ON public.financial_goals;
CREATE TRIGGER trg_financial_goals_reset_deadline_notice
  BEFORE UPDATE OF target_date ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.reset_goal_deadline_notice();

-- 3. GOAL CONTRIBUTIONS TABLE ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount <> 0),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 255),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'telegram_ai', 'telegram_voice', 'initial_balance', 'adjustment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON public.goal_contributions (goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user ON public.goal_contributions (user_id, created_at DESC);

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goal_contributions_owner_select" ON public.goal_contributions;
CREATE POLICY "goal_contributions_owner_select" ON public.goal_contributions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users may only add real money movements to their own goals. 'initial_balance' and
-- 'adjustment' rows are written by the SECURITY DEFINER triggers below.
-- No UPDATE / DELETE policies: the history cannot be rewritten (rows go away only
-- when the goal itself is deleted).
DROP POLICY IF EXISTS "goal_contributions_owner_insert" ON public.goal_contributions;
CREATE POLICY "goal_contributions_owner_insert" ON public.goal_contributions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND source IN ('manual', 'telegram_ai', 'telegram_voice')
    AND EXISTS (
      SELECT 1 FROM public.financial_goals g
      WHERE g.id = goal_id AND g.user_id = auth.uid()
    )
  );

-- 3a. Inserting a contribution moves the goal's money (same statement / transaction).
CREATE OR REPLACE FUNCTION public.apply_goal_contribution()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_goal public.financial_goals%ROWTYPE;
  v_new NUMERIC(12, 2);
BEGIN
  -- Rows that only record an existing state (or are written by the sync trigger) do not move money.
  IF NEW.source = 'initial_balance' OR current_setting('uzhamyon.goal_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_goal FROM public.financial_goals WHERE id = NEW.goal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maqsad topilmadi';
  END IF;
  IF v_goal.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Ruxsat berilmagan: maqsad boshqa foydalanuvchiga tegishli';
  END IF;

  v_new := v_goal.current_amount + NEW.amount;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'Maqsadda yetarli mablag‘ yo‘q (hozir: %)', v_goal.current_amount;
  END IF;

  PERFORM set_config('uzhamyon.goal_sync', 'on', true);
  UPDATE public.financial_goals
  SET current_amount = v_new,
      -- 'cancelled' stays cancelled until the user explicitly reopens it (#31).
      status = CASE
        WHEN v_goal.status = 'cancelled' THEN 'cancelled'
        WHEN v_new >= v_goal.target_amount THEN 'completed'
        ELSE 'in_progress'
      END
  WHERE id = v_goal.id;
  PERFORM set_config('uzhamyon.goal_sync', 'off', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goal_contributions_apply ON public.goal_contributions;
CREATE TRIGGER trg_goal_contributions_apply
  BEFORE INSERT ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.apply_goal_contribution();

-- 3b. Any OTHER change of current_amount (old code paths, rollbacks, manual edits)
--     is logged as an 'adjustment' row, so the history always adds up.
CREATE OR REPLACE FUNCTION public.log_goal_amount_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('uzhamyon.goal_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.current_amount IS DISTINCT FROM OLD.current_amount THEN
    PERFORM set_config('uzhamyon.goal_sync', 'on', true);
    INSERT INTO public.goal_contributions (user_id, goal_id, amount, note, source)
    VALUES (NEW.user_id, NEW.id, NEW.current_amount - OLD.current_amount, 'Qo‘lda tuzatish', 'adjustment');
    PERFORM set_config('uzhamyon.goal_sync', 'off', true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_goals_log_adjustment ON public.financial_goals;
CREATE TRIGGER trg_financial_goals_log_adjustment
  AFTER UPDATE OF current_amount ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.log_goal_amount_adjustment();

-- 3c. A goal created with money already in it gets an 'initial_balance' row.
CREATE OR REPLACE FUNCTION public.log_goal_initial_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_amount > 0 THEN
    INSERT INTO public.goal_contributions (user_id, goal_id, amount, note, source, created_at)
    VALUES (NEW.user_id, NEW.id, NEW.current_amount, 'Boshlang‘ich qoldiq', 'initial_balance', NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_goals_initial_balance ON public.financial_goals;
CREATE TRIGGER trg_financial_goals_initial_balance
  AFTER INSERT ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.log_goal_initial_balance();

-- 4. BACKFILL: one "Boshlang'ich qoldiq" row per existing goal with money --------------
INSERT INTO public.goal_contributions (user_id, goal_id, amount, note, source, created_at)
SELECT g.user_id, g.id, g.current_amount, 'Boshlang‘ich qoldiq', 'initial_balance', g.created_at
FROM public.financial_goals g
WHERE g.current_amount > 0
  AND NOT EXISTS (SELECT 1 FROM public.goal_contributions c WHERE c.goal_id = g.id);

-- 5. ONE GOAL-MATCHING RULE (#30) ----------------------------------------------------
-- Mirrors src/lib/goals/matchGoal.ts:
--   no name   → newest in_progress goal (or none)
--   with name → exact name first, then "one contains the other";
--               in_progress before completed; newest first; cancelled never matched.
CREATE OR REPLACE FUNCTION public.normalize_goal_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(btrim(regexp_replace(translate(COALESCE(p_name, ''), '‘’ʻʼ`', repeat(chr(39), 5)), '\s+', ' ', 'g'))), '');
$$;

CREATE OR REPLACE FUNCTION public.find_user_goal(p_user_id UUID, p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_name TEXT := public.normalize_goal_name(p_name);
  v_id UUID;
BEGIN
  IF v_name IS NULL THEN
    SELECT id INTO v_id
    FROM public.financial_goals
    WHERE user_id = p_user_id AND status = 'in_progress'
    ORDER BY updated_at DESC
    LIMIT 1;
    RETURN v_id;
  END IF;

  SELECT id INTO v_id
  FROM public.financial_goals g
  WHERE g.user_id = p_user_id
    AND g.status IN ('in_progress', 'completed')
    AND (
      public.normalize_goal_name(g.name) = v_name
      OR position(v_name IN public.normalize_goal_name(g.name)) > 0
      OR position(public.normalize_goal_name(g.name) IN v_name) > 0
    )
  ORDER BY
    (public.normalize_goal_name(g.name) = v_name) DESC,
    (g.status = 'in_progress') DESC,
    g.updated_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_user_goal(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_goal(UUID, TEXT) TO authenticated, service_role;

-- 6. ATOMIC EXECUTION RPC (012 version + goal rules) ------------------------------------
CREATE OR REPLACE FUNCTION public.execute_pending_ai_action_atomic(
  p_action_id TEXT,
  p_user_id UUID,
  p_telegram_user_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_record public.pending_ai_actions%ROWTYPE;
  v_action JSONB;
  v_action_type TEXT;
  v_tx_type TEXT;
  v_amount NUMERIC(12, 2);
  v_currency VARCHAR(3);
  v_desc TEXT;
  v_cat_id UUID;
  v_cat_id_text TEXT;
  v_cat_name TEXT;
  v_date DATE;
  v_time TEXT;
  v_created_at TIMESTAMPTZ;
  v_source TEXT;
  v_max_amount NUMERIC;
  v_goal_name TEXT;
  v_goal_id UUID;
  v_target_amount NUMERIC(12, 2);
  v_target_date DATE;
  v_goal public.financial_goals%ROWTYPE;
  v_summary_lines TEXT[] := ARRAY[]::TEXT[];
  v_success_count INT := 0;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_today_tashkent DATE := (now() AT TIME ZONE 'Asia/Tashkent')::DATE;
BEGIN
  SELECT * INTO v_record FROM public.pending_ai_actions WHERE action_id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amal topilmadi');
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() <> v_record.user_id OR auth.uid() <> p_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ruxsat berilmagan: faqat amal egasi uni bajara oladi');
    END IF;
  END IF;

  IF v_record.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruxsat berilmagan: foydalanuvchi mos kelmadi');
  END IF;

  IF v_record.telegram_user_id IS NOT NULL THEN
    IF p_telegram_user_id IS NOT NULL AND v_record.telegram_user_id <> p_telegram_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ruxsat berilmagan: Telegram shaxsiyati mos kelmadi');
    END IF;
    IF auth.uid() IS NULL AND (p_telegram_user_id IS NULL OR v_record.telegram_user_id <> p_telegram_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ruxsat berilmagan: Telegram shaxsiyati tasdiqlanmadi');
    END IF;
  END IF;

  IF v_record.status = 'executed' THEN
    RETURN jsonb_build_object('success', true, 'message', v_record.result_message, 'already_executed', true);
  END IF;
  IF v_record.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ushbu amal avval bekor qilingan');
  END IF;
  IF v_record.expires_at < v_now THEN
    UPDATE public.pending_ai_actions SET status = 'expired', updated_at = v_now WHERE id = v_record.id;
    RETURN jsonb_build_object('success', false, 'error', 'Amal muddati o‘tgan (15 daqiqa)');
  END IF;
  IF v_record.status = 'executing' AND v_record.locked_until > v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ushbu amal hozirda bajarilmoqda. Iltimos kuting.');
  END IF;
  IF jsonb_array_length(v_record.actions) > 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bitta xabarda ko‘pi bilan 10 ta amal bo‘lishi mumkin');
  END IF;

  UPDATE public.pending_ai_actions
  SET status = 'executing', execution_started_at = v_now, locked_until = v_now + interval '2 minutes', updated_at = v_now
  WHERE id = v_record.id;

  FOR v_action IN SELECT * FROM jsonb_array_elements(v_record.actions)
  LOOP
    v_action_type := v_action->>'actionType';
    v_amount := (v_action->>'amount')::NUMERIC;
    v_currency := UPPER(COALESCE(NULLIF(v_action->>'currency', ''), 'UZS'));
    v_desc := COALESCE(NULLIF(v_action->>'description', ''), 'Moliyaviy yozuv');
    v_date := COALESCE((v_action->>'date')::DATE, v_today_tashkent);
    v_max_amount := CASE WHEN v_currency = 'USD' THEN 100000 ELSE 1000000000 END;
    v_source := v_action->>'source';
    IF v_source IS NULL OR v_source NOT IN ('manual', 'telegram_ai', 'telegram_voice') THEN
      v_source := CASE WHEN v_record.telegram_user_id IS NOT NULL THEN 'telegram_ai' ELSE 'manual' END;
    END IF;

    IF v_action_type = 'create_transaction' THEN
      IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_max_amount THEN
        RAISE EXCEPTION 'Summa ruxsat etilgan chegaradan tashqarida';
      END IF;

      v_tx_type := CASE WHEN v_action->>'transactionType' = 'income' THEN 'income' ELSE 'expense' END;
      v_cat_name := NULLIF(v_action->>'categoryName', '');
      v_cat_id_text := NULLIF(v_action->>'categoryId', '');
      v_cat_id := NULL;

      IF v_cat_id_text IS NOT NULL AND v_cat_id_text ~* '^[0-9a-f-]{36}$' THEN
        SELECT id INTO v_cat_id FROM public.categories
        WHERE id = v_cat_id_text::UUID AND (user_id = p_user_id OR is_system = true) AND type = v_tx_type;
      END IF;
      IF v_cat_id IS NULL AND v_cat_name IS NOT NULL THEN
        SELECT id INTO v_cat_id FROM public.categories
        WHERE (user_id = p_user_id OR is_system = true) AND type = v_tx_type
          AND LOWER(TRIM(name)) = LOWER(TRIM(v_cat_name))
        ORDER BY (user_id = p_user_id) DESC NULLS LAST
        LIMIT 1;
      END IF;

      v_time := v_action->>'time';
      IF v_time IS NULL OR v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]' THEN
        v_time := '12:00';
      END IF;
      v_created_at := ((v_date::TEXT || ' ' || LEFT(v_time, 5) || ':00')::TIMESTAMP) AT TIME ZONE 'Asia/Tashkent';

      INSERT INTO public.transactions (
        user_id, category_id, description, amount, currency, type, transaction_date, source, created_at
      ) VALUES (
        p_user_id, v_cat_id, v_desc, v_amount, v_currency, v_tx_type, v_date, v_source, v_created_at
      );

      v_summary_lines := array_append(v_summary_lines,
        v_desc || ' (' || to_char(v_amount, 'FM999G999G999G999') || ' ' || v_currency || ' ' ||
        CASE WHEN v_tx_type = 'income' THEN 'daromad' ELSE 'xarajat' END || ')');
      v_success_count := v_success_count + 1;

    ELSIF v_action_type = 'create_goal' THEN
      v_goal_name := COALESCE(NULLIF(v_action->>'goalName', ''), 'Jamg‘arma maqsadi');
      v_target_amount := COALESCE((v_action->>'targetAmount')::NUMERIC, v_amount);
      IF v_target_amount IS NULL OR v_target_amount <= 0 OR v_target_amount > v_max_amount THEN
        RAISE EXCEPTION 'Summa ruxsat etilgan chegaradan tashqarida';
      END IF;
      v_target_date := (v_action->>'targetDate')::DATE;

      INSERT INTO public.financial_goals (user_id, name, target_amount, current_amount, currency, target_date, status)
      VALUES (p_user_id, v_goal_name, v_target_amount, 0.00, v_currency, v_target_date, 'in_progress');

      v_summary_lines := array_append(v_summary_lines,
        '«' || v_goal_name || '» maqsadi (' || to_char(v_target_amount, 'FM999G999G999G999') || ' ' || v_currency || ')');
      v_success_count := v_success_count + 1;

    ELSIF v_action_type = 'update_goal' THEN
      v_goal_name := NULLIF(v_action->>'goalName', '');
      v_target_amount := COALESCE((v_action->>'targetAmount')::NUMERIC, v_amount);
      IF v_target_amount IS NOT NULL AND (v_target_amount <= 0 OR v_target_amount > v_max_amount) THEN
        RAISE EXCEPTION 'Summa ruxsat etilgan chegaradan tashqarida';
      END IF;
      v_target_date := (v_action->>'targetDate')::DATE;

      v_goal_id := public.find_user_goal(p_user_id, v_goal_name);
      IF v_goal_id IS NULL THEN
        RAISE EXCEPTION 'Yangilash uchun «%» nomli maqsad topilmadi', COALESCE(v_goal_name, '');
      END IF;
      SELECT * INTO v_goal FROM public.financial_goals WHERE id = v_goal_id FOR UPDATE;

      UPDATE public.financial_goals
      SET target_amount = COALESCE(v_target_amount, target_amount),
          target_date = COALESCE(v_target_date, target_date),
          status = CASE
            WHEN v_goal.status = 'cancelled' THEN 'cancelled'
            WHEN current_amount >= COALESCE(v_target_amount, target_amount) THEN 'completed'
            ELSE 'in_progress'
          END,
          updated_at = v_now
      WHERE id = v_goal_id;

      v_summary_lines := array_append(v_summary_lines,
        '«' || v_goal.name || '» maqsadi yangilandi (yangi summa: ' ||
        to_char(COALESCE(v_target_amount, v_goal.target_amount), 'FM999G999G999G999') || ' ' || v_goal.currency || ')');
      v_success_count := v_success_count + 1;

    ELSIF v_action_type = 'contribute_goal' THEN
      IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_max_amount THEN
        RAISE EXCEPTION 'Summa ruxsat etilgan chegaradan tashqarida';
      END IF;
      v_goal_name := NULLIF(v_action->>'goalName', '');

      v_goal_id := public.find_user_goal(p_user_id, v_goal_name);
      IF v_goal_id IS NULL THEN
        RAISE EXCEPTION 'Hissa qo‘shish uchun «%» nomli maqsad topilmadi', COALESCE(v_goal_name, '');
      END IF;
      SELECT * INTO v_goal FROM public.financial_goals WHERE id = v_goal_id;

      -- Never add money of one currency to a goal in another currency (#28).
      IF v_goal.currency <> v_currency THEN
        RAISE EXCEPTION '«%» maqsadi % valyutasida, hissa esa % da', v_goal.name, v_goal.currency, v_currency;
      END IF;

      -- The trigger on goal_contributions updates current_amount and status.
      INSERT INTO public.goal_contributions (user_id, goal_id, amount, note, source)
      VALUES (p_user_id, v_goal_id, v_amount, NULLIF(v_action->>'description', ''), v_source);

      SELECT * INTO v_goal FROM public.financial_goals WHERE id = v_goal_id;

      v_summary_lines := array_append(v_summary_lines,
        '«' || v_goal.name || '» maqsadiga ' || to_char(v_amount, 'FM999G999G999G999') || ' ' || v_currency ||
        ' qo‘shildi (jami: ' || to_char(v_goal.current_amount, 'FM999G999G999G999') || ' ' || v_goal.currency || ')');
      v_success_count := v_success_count + 1;

    ELSE
      RAISE EXCEPTION 'Noma’lum amal turi: %', v_action_type;
    END IF;
  END LOOP;

  DECLARE
    v_final_msg TEXT := '✅ Muvaffaqiyatli bajarildi:' || E'\n• ' || array_to_string(v_summary_lines, E'\n• ');
  BEGIN
    UPDATE public.pending_ai_actions
    SET status = 'executed', completed_at = v_now, result_message = v_final_msg, locked_until = NULL, updated_at = v_now
    WHERE id = v_record.id;

    RETURN jsonb_build_object('success', true, 'message', v_final_msg, 'actions_count', v_success_count);
  END;

EXCEPTION WHEN OTHERS THEN
  UPDATE public.pending_ai_actions
  SET status = 'failed', error_details = SQLERRM, locked_until = NULL, updated_at = timezone('utc'::text, now())
  WHERE id = v_record.id;

  RETURN jsonb_build_object('success', false, 'error', 'Moliyaviy amallarni bajarishda xatolik yuz berdi: ' || SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) TO service_role;

COMMIT;
