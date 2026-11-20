import type { SupabaseClient } from '@supabase/supabase-js';
import { addDaysToDate, todayTashkent } from '../time/tashkent.ts';
import { computeStreak, type StreakSummary } from './compute.ts';

const HISTORY_DAYS = 400;
let warnedMissingTable = false;

/**
 * Streak for one user. Reads activity_days (migration 016). Until that migration
 * is applied, falls back to the dates of logged (non-import) transactions so the
 * feature works, slightly more generously, before the table exists.
 */
export async function getStreakForUser(
  supabase: SupabaseClient,
  userId: string,
  today: string = todayTashkent()
): Promise<StreakSummary> {
  const since = addDaysToDate(today, -HISTORY_DAYS);

  const { data, error } = await supabase
    .from('activity_days')
    .select('day')
    .eq('user_id', userId)
    .gte('day', since)
    .order('day', { ascending: true });

  if (!error) {
    return computeStreak((data || []).map((r: { day: string }) => r.day), today);
  }

  if (!warnedMissingTable) {
    warnedMissingTable = true;
    console.warn('[streak] activity_days unavailable (migration 016 not applied?), using transaction dates:', error.message);
  }

  const { data: txRows } = await supabase
    .from('transactions')
    .select('transaction_date')
    .eq('user_id', userId)
    .gte('transaction_date', since)
    .not('source', 'in', '(csv,excel)')
    .limit(5000);

  return computeStreak(
    (txRows || []).map((r: { transaction_date: string }) => r.transaction_date),
    today
  );
}
