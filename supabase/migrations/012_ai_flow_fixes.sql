-- ============================================================================
-- Migration: 012_ai_flow_fixes.sql
-- Description: Phase 1B fixes for the AI transaction flow.
--   1. transactions.source: allow 'telegram_ai' and 'telegram_voice'      (#18)
--   2. New system category 'Internet & Phone' (Uzbek: Aloqa va Internet)  (#14)
--   3. execute_pending_ai_action_atomic (same signature):
--      - uses the resolved categoryId (checked: system or own, same type)  (#14)
--      - saves the Tashkent date + time into created_at                    (#17)
--      - saves source from the action (default telegram_ai for Telegram)   (#18)
--      - rejects more than 10 actions and amounts above the per-currency cap (#25)
-- Requires: 007 and 011.
-- Safe to re-run (idempotent).
-- Note: Do NOT apply automatically to production without explicit change review.
-- ============================================================================

BEGIN;

-- 1. SOURCE VALUES ------------------------------------------------------------
-- 007 created the CHECK inline, so its name is generated. Drop every CHECK on
-- transactions that mentions "source", then add one with a known name.
DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', v_con.conname);
  END LOOP;
END $$;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'csv', 'excel', 'recurring', 'telegram_ai', 'telegram_voice'));

-- 2. SYSTEM CATEGORY FOR "Aloqa va Internet" -----------------------------------
INSERT INTO public.categories (name, type, description, icon, is_system, user_id)
VALUES ('Internet & Phone', 'expense', 'Mobile, internet, phone and communication services', 'wifi', true, NULL)
ON CONFLICT (LOWER(TRIM(name)), type) WHERE user_id IS NULL
DO NOTHING;

-- 3. ATOMIC EXECUTION RPC -------------------------------------------------------
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
  v_target_amount NUMERIC(12, 2);
  v_target_date DATE;
  v_existing_goal RECORD;
  v_summary_lines TEXT[] := ARRAY[]::TEXT[];
  v_success_count INT := 0;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_today_tashkent DATE := (now() AT TIME ZONE 'Asia/Tashkent')::DATE;
BEGIN
  -- 1. Lock the row
  SELECT * INTO v_record
  FROM public.pending_ai_actions
  WHERE action_id = p_action_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amal topilmadi');
  END IF;

  -- 2. Identity binding
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

  -- 3. Idempotency / state checks
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

  -- 4. Execution lock
  UPDATE public.pending_ai_actions
  SET status = 'executing',
      execution_started_at = v_now,
      locked_until = v_now + interval '2 minutes',
      updated_at = v_now
  WHERE id = v_record.id;

  -- 5. Execute every action in this one transaction
  FOR v_action IN SELECT * FROM jsonb_array_elements(v_record.actions)
  LOOP
    v_action_type := v_action->>'actionType';
    v_amount := (v_action->>'amount')::NUMERIC;
    v_currency := UPPER(COALESCE(NULLIF(v_action->>'currency', ''), 'UZS'));
    v_desc := COALESCE(NULLIF(v_action->>'description', ''), 'Moliyaviy yozuv');
    v_date := COALESCE((v_action->>'date')::DATE, v_today_tashkent);
    v_max_amount := CASE WHEN v_currency = 'USD' THEN 100000 ELSE 1000000000 END;

    IF v_action_type = 'create_transaction' THEN
      IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_max_amount THEN
        RAISE EXCEPTION 'Summa ruxsat etilgan chegaradan tashqarida';
      END IF;

      v_tx_type := CASE WHEN v_action->>'transactionType' = 'income' THEN 'income' ELSE 'expense' END;
      v_cat_name := NULLIF(v_action->>'categoryName', '');
      v_cat_id_text := NULLIF(v_action->>'categoryId', '');
      v_cat_id := NULL;

      -- Category: the resolved id first (must be visible to the user and of the same type),
      -- then an exact case-insensitive name match. Unknown → NULL ("Boshqa").
      IF v_cat_id_text IS NOT NULL AND v_cat_id_text ~* '^[0-9a-f-]{36}$' THEN
        SELECT id INTO v_cat_id
        FROM public.categories
        WHERE id = v_cat_id_text::UUID
          AND (user_id = p_user_id OR is_system = true)
          AND type = v_tx_type;
      END IF;

      IF v_cat_id IS NULL AND v_cat_name IS NOT NULL THEN
        SELECT id INTO v_cat_id
        FROM public.categories
        WHERE (user_id = p_user_id OR is_system = true)
          AND type = v_tx_type
          AND LOWER(TRIM(name)) = LOWER(TRIM(v_cat_name))
        ORDER BY (user_id = p_user_id) DESC NULLS LAST
        LIMIT 1;
      END IF;

      -- Time: Tashkent wall clock → correct UTC instant. Missing/invalid → 12:00.
      v_time := v_action->>'time';
      IF v_time IS NULL OR v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]' THEN
        v_time := '12:00';
      END IF;
      v_created_at := ((v_date::TEXT || ' ' || LEFT(v_time, 5) || ':00')::TIMESTAMP) AT TIME ZONE 'Asia/Tashkent';

      v_source := v_action->>'source';
      IF v_source IS NULL OR v_source NOT IN ('manual', 'telegram_ai', 'telegram_voice') THEN
        v_source := CASE WHEN v_record.telegram_user_id IS NOT NULL THEN 'telegram_ai' ELSE 'manual' END;
      END IF;

      INSERT INTO public.transactions (
        user_id, category_id, description, amount, currency, type, transaction_date, source, created_at
      ) VALUES (
        p_user_id, v_cat_id, v_desc, v_amount, v_currency, v_tx_type, v_date, v_source, v_created_at
      );

      v_summary_lines := array_append(
        v_summary_lines,
        v_desc || ' (' || to_char(v_amount, 'FM999G999G999G999') || ' ' || v_currency || ' ' ||
        CASE WHEN v_tx_type = 'income' THEN 'daromad' ELSE 'xarajat' END || ')'
      );
      v_success_count := v_success_count + 1;

    ELSIF v_action_type = 'create_goal' THEN
      v_goal_name := COALESCE(NULLIF(v_action->>'goalName', ''), 'Jamg‘arma maqsadi');
      v_target_amount := COALESCE((v_action->>'targetAmount')::NUMERIC, v_amount);
      IF v_target_amount IS NULL OR v_target_amount <= 0 OR v_target_amount > v_max_amount THEN
        RAISE EXCEPTION 'Summa ruxsat etilgan chegaradan tashqarida';
      END IF;
      v_target_date := (v_action->>'targetDate')::DATE;

      INSERT INTO public.financial_goals (
        user_id, name, target_amount, current_amount, currency, target_date, status
      ) VALUES (
        p_user_id, v_goal_name, v_target_amount, 0.00, v_currency, v_target_date, 'in_progress'
      );

      v_summary_lines := array_append(
        v_summary_lines,
        '«' || v_goal_name || '» maqsadi (' || to_char(v_target_amount, 'FM999G999G999G999') || ' ' || v_currency || ')'
      );
      v_success_count := v_success_count + 1;

    ELSIF v_action_type = 'update_goal' THEN
      v_goal_name := NULLIF(v_action->>'goalName', '');
      v_target_amount := COALESCE((v_action->>'targetAmount')::NUMERIC, v_amount);
      IF v_target_amount IS NOT NULL AND (v_target_amount <= 0 OR v_target_amount > v_max_amount) THEN
        RAISE EXCEPTION 'Summa ruxsat etilgan chegaradan tashqarida';
      END IF;
      v_target_date := (v_action->>'targetDate')::DATE;

      -- Goal matching is unchanged here; Phase 1C unifies it with the app path (#30).
      SELECT * INTO v_existing_goal
      FROM public.financial_goals
      WHERE user_id = p_user_id
        AND status = 'in_progress'
        AND (v_goal_name IS NULL OR LOWER(name) LIKE '%' || LOWER(v_goal_name) || '%')
      ORDER BY updated_at DESC
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Yangilash uchun «%» nomli maqsad topilmadi', COALESCE(v_goal_name, '');
      END IF;

      UPDATE public.financial_goals
      SET target_amount = COALESCE(v_target_amount, target_amount),
          target_date = COALESCE(v_target_date, target_date),
          updated_at = v_now
      WHERE id = v_existing_goal.id;

      v_summary_lines := array_append(
        v_summary_lines,
        '«' || v_existing_goal.name || '» maqsadi yangilandi (yangi summa: ' || to_char(v_target_amount, 'FM999G999G999G999') || ' ' || v_currency || ')'
      );
      v_success_count := v_success_count + 1;

    ELSIF v_action_type = 'contribute_goal' THEN
      IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_max_amount THEN
        RAISE EXCEPTION 'Summa ruxsat etilgan chegaradan tashqarida';
      END IF;
      v_goal_name := NULLIF(v_action->>'goalName', '');

      SELECT * INTO v_existing_goal
      FROM public.financial_goals
      WHERE user_id = p_user_id
        AND status = 'in_progress'
        AND (v_goal_name IS NULL OR LOWER(name) LIKE '%' || LOWER(v_goal_name) || '%')
      ORDER BY updated_at DESC
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Hissa qo‘shish uchun «%» nomli faol maqsad topilmadi', COALESCE(v_goal_name, '');
      END IF;

      UPDATE public.financial_goals
      SET current_amount = current_amount + v_amount,
          status = CASE WHEN (current_amount + v_amount) >= target_amount THEN 'completed' ELSE status END,
          updated_at = v_now
      WHERE id = v_existing_goal.id;

      v_summary_lines := array_append(
        v_summary_lines,
        '«' || v_existing_goal.name || '» maqsadiga ' || to_char(v_amount, 'FM999G999G999G999') || ' ' || v_currency || ' qo‘shildi'
      );
      v_success_count := v_success_count + 1;

    ELSE
      RAISE EXCEPTION 'Noma’lum amal turi: %', v_action_type;
    END IF;
  END LOOP;

  -- 6. Done
  DECLARE
    v_final_msg TEXT := '✅ Muvaffaqiyatli bajarildi:' || E'\n• ' || array_to_string(v_summary_lines, E'\n• ');
  BEGIN
    UPDATE public.pending_ai_actions
    SET status = 'executed',
        completed_at = v_now,
        result_message = v_final_msg,
        locked_until = NULL,
        updated_at = v_now
    WHERE id = v_record.id;

    RETURN jsonb_build_object('success', true, 'message', v_final_msg, 'actions_count', v_success_count);
  END;

EXCEPTION WHEN OTHERS THEN
  -- Everything above is rolled back; only the failure status is written.
  UPDATE public.pending_ai_actions
  SET status = 'failed',
      error_details = SQLERRM,
      locked_until = NULL,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'success', false,
    'error', 'Moliyaviy amallarni bajarishda xatolik yuz berdi: ' || SQLERRM
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) TO service_role;

COMMIT;
