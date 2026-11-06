-- ============================================================================
-- Migration: 011_pending_ai_actions.sql
-- Description: Persistent AI action storage, atomic financial execution RPC,
--              dual-identity binding, and execution lock recovery.
-- Note: Do NOT apply automatically to production without explicit change review.
-- ============================================================================

BEGIN;

-- 1. TABLE: public.pending_ai_actions
CREATE TABLE IF NOT EXISTS public.pending_ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT,
  telegram_chat_id BIGINT,
  intent TEXT NOT NULL DEFAULT 'action_proposal' 
    CHECK (intent IN ('action_proposal', 'clarification', 'financial_query', 'casual_chat')),
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_uzbek TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'executing', 'executed', 'cancelled', 'expired', 'failed')),
  result_message TEXT,
  error_details TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  execution_token TEXT,
  execution_started_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '15 minutes'),
  CONSTRAINT chk_pending_ai_actions_expiry CHECK (expires_at >= created_at)
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_pending_ai_actions_user_status 
  ON public.pending_ai_actions (user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_pending_ai_actions_tg_user 
  ON public.pending_ai_actions (telegram_user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_pending_ai_actions_recovery 
  ON public.pending_ai_actions (status, locked_until)
  WHERE status = 'executing';

-- 3. TRIGGERS: updated_at va user_id himoyasi
DROP TRIGGER IF EXISTS trg_pending_ai_actions_prevent_user_id_change ON public.pending_ai_actions;
CREATE TRIGGER trg_pending_ai_actions_prevent_user_id_change
  BEFORE UPDATE ON public.pending_ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP TRIGGER IF EXISTS trg_pending_ai_actions_updated_at ON public.pending_ai_actions;
CREATE TRIGGER trg_pending_ai_actions_updated_at
  BEFORE UPDATE ON public.pending_ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.pending_ai_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_ai_actions_owner_select" ON public.pending_ai_actions;
CREATE POLICY "pending_ai_actions_owner_select" ON public.pending_ai_actions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pending_ai_actions_owner_insert" ON public.pending_ai_actions;
CREATE POLICY "pending_ai_actions_owner_insert" ON public.pending_ai_actions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pending_ai_actions_owner_update" ON public.pending_ai_actions;
CREATE POLICY "pending_ai_actions_owner_update" ON public.pending_ai_actions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. ATOMIC FINANCIAL EXECUTION RPC FUNCTION
-- Barcha tranzaksiya va maqsad amallarini bitta PostgreSQL tranzaksiyasida bajaradi.
-- Bitta amal muvaffaqiyatsiz bo'lsa, qolganlari ham bekor bo'ladi (no partial writes).
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
  v_cat_name TEXT;
  v_date DATE;
  v_goal_name TEXT;
  v_target_amount NUMERIC(12, 2);
  v_target_date DATE;
  v_existing_goal RECORD;
  v_summary_lines TEXT[] := ARRAY[]::TEXT[];
  v_success_count INT := 0;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  -- 1. Qatorni qulflash va holatni tekshirish (Atomar Lock)
  SELECT * INTO v_record
  FROM public.pending_ai_actions
  WHERE action_id = p_action_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amal topilmadi');
  END IF;

  -- 2. Shaxsiyat tekshiruvi (Identity Binding)
  -- Agar auth.uid() mavjud bo'lsa (authenticated sessiya), u amal egasi va p_user_id bilan bir xil bo'lishi shart
  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() <> v_record.user_id OR auth.uid() <> p_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ruxsat berilmagan: faqat amal egasi uni bajara oladi');
    END IF;
  END IF;

  IF v_record.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruxsat berilmagan: foydalanuvchi mos kelmadi');
  END IF;

  -- Telegram action tekshiruvi: Agar amal Telegram orqali yaratilgan bo'lsa, Telegram shaxsiyati qat'iy tekshiriladi
  IF v_record.telegram_user_id IS NOT NULL THEN
    IF p_telegram_user_id IS NOT NULL AND v_record.telegram_user_id <> p_telegram_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ruxsat berilmagan: Telegram shaxsiyati mos kelmadi');
    END IF;
    -- Agar auth.uid() bo'lmasa (service_role chaqiruvi), p_telegram_user_id majburiy
    IF auth.uid() IS NULL AND (p_telegram_user_id IS NULL OR v_record.telegram_user_id <> p_telegram_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ruxsat berilmagan: Telegram shaxsiyati tasdiqlanmadi');
    END IF;
  END IF;

  -- 3. Idempotentlik tekshiruvi: Agar allaqachon bajarilgan bo'lsa, avvalgi natijani qaytarish
  IF v_record.status = 'executed' THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', v_record.result_message,
      'already_executed', true
    );
  END IF;

  IF v_record.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ushbu amal avval bekor qilingan');
  END IF;

  IF v_record.expires_at < v_now THEN
    UPDATE public.pending_ai_actions 
    SET status = 'expired', updated_at = v_now 
    WHERE id = v_record.id;
    RETURN jsonb_build_object('success', false, 'error', 'Amal muddati o‘tgan (15 daqiqa)');
  END IF;

  -- 4. Bajarish qulfi va tiklanish (Execution Lock & Recovery)
  -- Agar hozirda 'executing' bo'lsa va qulf muddati tugamagan bo'lsa, dublikat deb rad etiladi
  IF v_record.status = 'executing' AND v_record.locked_until > v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ushbu amal hozirda bajarilmoqda. Iltimos kuting.');
  END IF;

  -- Qulfni egallash: 2 daqiqalik lock qo'yiladi
  UPDATE public.pending_ai_actions
  SET status = 'executing',
      execution_started_at = v_now,
      locked_until = v_now + interval '2 minutes',
      updated_at = v_now
  WHERE id = v_record.id;

  -- 5. Har bir moliyaviy amalni bitta tranzaksiyada bajarish
  FOR v_action IN SELECT * FROM jsonb_array_elements(v_record.actions)
  LOOP
    v_action_type := v_action->>'actionType';
    v_amount := (v_action->>'amount')::NUMERIC;
    v_currency := UPPER(COALESCE(v_action->>'currency', 'UZS'));
    v_desc := COALESCE(v_action->>'description', 'Moliyaviy yozuv');
    v_date := COALESCE((v_action->>'date')::DATE, v_now::DATE);

    IF v_action_type = 'create_transaction' THEN
      v_tx_type := COALESCE(v_action->>'transactionType', 'expense');
      v_cat_name := v_action->>'categoryName';
      v_cat_id := NULL;

      -- Kategoriya moslash
      IF v_cat_name IS NOT NULL THEN
        SELECT id INTO v_cat_id 
        FROM public.categories 
        WHERE (user_id = p_user_id OR is_system = true) 
          AND type = v_tx_type 
          AND LOWER(name) = LOWER(v_cat_name)
        LIMIT 1;
      END IF;

      INSERT INTO public.transactions (
        user_id, category_id, description, amount, currency, type, transaction_date, source
      ) VALUES (
        p_user_id, v_cat_id, v_desc, v_amount, v_currency, v_tx_type, v_date, 'manual'
      );

      v_summary_lines := array_append(
        v_summary_lines, 
        v_desc || ' (' || to_char(v_amount, 'FM999G999G999G999') || ' ' || v_currency || ' ' || 
        CASE WHEN v_tx_type = 'income' THEN 'daromad' ELSE 'xarajat' END || ')'
      );
      v_success_count := v_success_count + 1;

    ELSIF v_action_type = 'create_goal' THEN
      v_goal_name := COALESCE(v_action->>'goalName', 'Jamg‘arma maqsadi');
      v_target_amount := COALESCE((v_action->>'targetAmount')::NUMERIC, v_amount);
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
      v_goal_name := v_action->>'goalName';
      v_target_amount := (v_action->>'targetAmount')::NUMERIC;
      IF v_target_amount IS NULL THEN
        v_target_amount := v_amount;
      END IF;
      v_target_date := (v_action->>'targetDate')::DATE;

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
      v_goal_name := v_action->>'goalName';
      
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

  -- 6. Muvaffaqiyatli yakunlash
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

    RETURN jsonb_build_object(
      'success', true,
      'message', v_final_msg,
      'actions_count', v_success_count
    );
  END;

EXCEPTION WHEN OTHERS THEN
  -- Xatolik yuz berganda butun tranzaksiya avtomatik rollback qilinadi
  -- Hech qanday chala tranzaksiya yozilmaydi
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

-- 6. FUNCTION PERMISSIONS
REVOKE EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_pending_ai_action_atomic(TEXT, UUID, BIGINT) TO service_role;

COMMIT;

