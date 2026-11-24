/**
 * Goal actions from chat must be in the goal's own currency (#28):
 *   - no currency named ("Noutbuk maqsadiga 50 qo‘shdim") → the goal's currency;
 *   - another currency named ("$50" to a so'm goal) → converted at today's rate,
 *     and the confirmation says which rate was used.
 * Runs before the pending action is saved, so the ✅ preview already shows the final amount.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { findUserGoal } from '../goals/matchGoal.ts';
import { convertAmount, formatAmount, toDisplayCurrency } from '../fx/currency.ts';
import { getUsdUzsRate } from '../fx/rates.ts';
import { botTexts } from '../i18n/bot.ts';
import { buildActionSummary, type ExtractedActionItem, type ExtractionResult } from './actionExtractionEngine.ts';

interface GoalRow {
  id: string;
  name: string;
  currency?: string | null;
  status?: string | null;
  updated_at?: string | null;
}

const GOAL_ACTIONS = new Set(['contribute_goal', 'update_goal']);

/** Pure part (tests): aligns actions to the given goals at the given rate. */
export function alignGoalActions(
  actions: ExtractedActionItem[],
  goals: GoalRow[],
  usdUzs: number
): { actions: ExtractedActionItem[]; changed: boolean; converted: boolean } {
  let changed = false;
  let converted = false;
  const out = actions.map((a) => {
    if (!GOAL_ACTIONS.has(a.actionType)) return a;
    const goal = findUserGoal(goals, a.goalName);
    if (!goal?.currency) return a;
    const goalCur = String(goal.currency).toUpperCase();
    const actCur = String(a.currency || 'UZS').toUpperCase();
    if (goalCur === actCur) return a;

    if (a.currencyExplicit === false) {
      changed = true;
      return { ...a, currency: goalCur };
    }
    // Named another currency: convert so'm ⇄ dollar; anything else is left for the executor to refuse.
    const bothKnown = ['UZS', 'USD'].includes(goalCur) && ['UZS', 'USD'].includes(actCur);
    if (!bothKnown || !(usdUzs > 0)) return a;
    const conv = (n: number | undefined) => (n ? convertAmount(n, actCur, goalCur, usdUzs) : n);
    changed = true;
    converted = true;
    return {
      ...a,
      amount: conv(a.amount) as number,
      targetAmount: conv(a.targetAmount),
      currency: goalCur,
    };
  });
  return { actions: out, changed, converted };
}

export async function alignGoalCurrencies(
  result: ExtractionResult,
  userId: string,
  supabase: SupabaseClient
): Promise<ExtractionResult> {
  if (!result.actions.some((a) => GOAL_ACTIONS.has(a.actionType))) return result;
  try {
    const { data: goals } = await supabase
      .from('financial_goals')
      .select('id, name, currency, status, updated_at')
      .eq('user_id', userId);
    if (!goals?.length) return result;

    const needsRate = result.actions.some((a) => GOAL_ACTIONS.has(a.actionType) && a.currencyExplicit !== false);
    const usdUzs = needsRate ? (await getUsdUzsRate()).usdUzs : 0;
    const { actions, changed, converted } = alignGoalActions(result.actions, goals as GoalRow[], usdUzs);
    if (!changed) return result;

    let summary = buildActionSummary(actions, result.language) || result.summaryUzbek;
    if (converted) summary += `\n\n${botTexts(result.language).rateNote(formatAmount(usdUzs, toDisplayCurrency('UZS')))}`;
    return { ...result, actions, summaryUzbek: summary };
  } catch (err) {
    console.error('[goalCurrency] align failed:', err);
    return result;
  }
}
