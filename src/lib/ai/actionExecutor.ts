/**
 * UzHamyon Financial Action Executor
 *
 * Executes verified pending financial actions via authorized application services.
 * Features:
 * - Scoped strictly to the authenticated user ID
 * - Enforces atomic claiming to prevent duplicate execution
 * - Calls existing application services (createTransaction, createGoal, updateGoal, contributeToGoal)
 * - Verifies database confirmation before reporting success
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createTransaction } from '../transactions/service.ts';
import { createGoal, updateGoal, contributeToGoal } from '../goals/service.ts';
import { matchCategoryRow } from '../categories/catalog.ts';
import { findUserGoal } from '../goals/matchGoal.ts';
import { todayTashkent } from '../time/tashkent.ts';
import { isAmountWithinLimit, AMOUNT_TOO_LARGE_MESSAGE } from './limits.ts';
import {
  claimPendingAction,
  markPendingActionCompleted,
  markPendingActionFailed,
  type PendingActionRecord,
} from './pendingActionStore.ts';
import { formatMoney } from '../formatters/money.ts';

export interface ExecutionResult {
  success: boolean;
  message: string;
  results?: Array<{
    type: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
}



/**
 * Resolves a category ID from Supabase based on name and transaction type
 */
async function resolveCategoryId(
  categoryName: string | undefined,
  type: 'income' | 'expense',
  supabase: SupabaseClient,
  categoryId?: string
): Promise<string | undefined> {
  if (!categoryName && !categoryId) return undefined;

  try {
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('type', type);

    if (categories && categories.length > 0) {
      // Prefer the id resolved when the proposal was made (must still be visible and of this type).
      if (categoryId) {
        const byId = categories.find((c) => c.id === categoryId);
        if (byId) return byId.id;
      }
      // Exact name / Uzbek→system mapping only; unknown → no category.
      return matchCategoryRow(categoryName, categories, type)?.id;
    }
  } catch (err) {
    console.warn('[ActionExecutor] Failed to resolve category ID:', err);
  }

  return undefined;
}

interface GoalSnapshot {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
  target_date?: string | null;
  status?: string;
  currency?: string;
  updated_at?: string | null;
}

/**
 * Resolves an existing financial goal for the user by name or fallback
 */
async function resolveUserGoal(
  goalName: string | undefined,
  userId: string,
  supabase: SupabaseClient
): Promise<GoalSnapshot | null> {
  try {
    const { data: goals } = await supabase
      .from('financial_goals')
      .select('id, name, current_amount, target_amount, target_date, status, currency, updated_at')
      .eq('user_id', userId);

    if (!goals || goals.length === 0) return null;
    // Same rule as SQL public.find_user_goal() (#30).
    return findUserGoal(goals, goalName);
  } catch (err) {
    console.error('[ActionExecutor] Error resolving user goal:', err);
    return null;
  }
}

/**
 * Executes confirmed actions for a given pending action record.
 * 1. Checks caller authorization and dual-identity.
 * 2. Attempts atomic PostgreSQL RPC (execute_pending_ai_action_atomic).
 * 3. Falls back safely to atomic application-level execution with automatic rollback on error.
 */
export async function executePendingActionRecord(
  record: PendingActionRecord,
  supabase: SupabaseClient
): Promise<ExecutionResult> {
  // 1. Enforce caller authentication & cross-user isolation
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user || authData.user.id !== record.userId) {
    return {
      success: false,
      message: 'Ruxsat berilmagan: faqat amal egasi uni bajara oladi.',
    };
  }

  // 2. Try atomic PostgreSQL RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('execute_pending_ai_action_atomic', {
      p_action_id: record.actionId,
      p_user_id: record.userId,
      p_telegram_user_id: record.telegramUserId ?? null,
    });

    if (!rpcError && rpcData) {
      if (rpcData.success) {
        if (rpcData.already_executed) {
          // Double tap / retry after success: report the stored result, not an error.
          return {
            success: true,
            message: rpcData.message || '✅ Bu amal allaqachon saqlangan.',
          };
        }
        return {
          success: true,
          message: rpcData.message,
        };
      }
      return {
        success: false,
        message: rpcData.error || 'Amalni bajarishda xatolik yuz berdi',
      };
    }
  } catch {
    // RPC not present in database yet -> proceed to application-level atomic fallback
  }

  // 3. Application-level execution with atomic claim
  const claim = await claimPendingAction(record.actionId, record.userId, record.telegramUserId, supabase);
  if (!claim.success || !claim.record) {
    if (claim.record?.status === 'executed') {
      return {
        success: true,
        message: claim.record.resultMessage || '✅ Bu amal allaqachon saqlangan.',
      };
    }
    return {
      success: false,
      message: claim.reason || 'Ushbu amalni bajarish imkonsiz (allaqachon bajarilgan yoki muddati o‘tgan).',
    };
  }

  const executionToken = claim.record.executionToken;

  const executionResults: Array<{ type: string; success: boolean; data?: unknown; error?: string }> = [];
  const successDescriptions: string[] = [];
  const createdTransactionIds: string[] = [];
  const createdGoalIds: string[] = [];
  // Previous values of goals changed by update_goal / contribute_goal, restored on rollback.
  const goalSnapshots = new Map<string, GoalSnapshot>();
  const defaultSource = record.telegramUserId ? 'telegram_ai' : 'manual';

  // Defense in depth: amounts were validated at extraction time, check again before writing.
  const overLimit = record.actions.find(
    (a) => !isAmountWithinLimit(Number(a.targetAmount || a.amount), a.currency || 'UZS')
  );
  if (overLimit) {
    const failureMessage = `❌ ${AMOUNT_TOO_LARGE_MESSAGE}`;
    await markPendingActionFailed(record.actionId, failureMessage, executionToken, supabase);
    return { success: false, message: failureMessage };
  }

  for (const item of record.actions) {
    try {
      if (item.actionType === 'create_transaction') {
        const txType = item.transactionType || 'expense';
        const categoryId = await resolveCategoryId(item.categoryName, txType, supabase, item.categoryId);

        const txRes = await createTransaction(
          {
            amount: item.amount,
            currency: item.currency || 'UZS',
            type: txType,
            description: item.description,
            transaction_date: item.date || todayTashkent(),
            transaction_time: item.time || undefined,
            category_id: categoryId,
            source: item.source || defaultSource,
          },
          supabase
        );

        if (txRes.error || !txRes.data) {
          executionResults.push({
            type: 'transaction',
            success: false,
            error: txRes.error || 'Tranzaksiya saqlanmadi',
          });
          break; // Stop batch to prevent partial writes
        } else {
          executionResults.push({
            type: 'transaction',
            success: true,
            data: txRes.data,
          });
          if (txRes.data.id) {
            createdTransactionIds.push(txRes.data.id);
          }
          const typeLabel = txType === 'income' ? 'daromad' : 'xarajat';
          successDescriptions.push(`${item.description} (${formatMoney(item.amount, item.currency)} ${typeLabel})`);
        }
      } else if (item.actionType === 'create_goal') {
        const goalRes = await createGoal(
          {
            name: item.goalName || 'Jamg‘arma maqsadi',
            target_amount: item.targetAmount || item.amount,
            currency: item.currency || 'UZS',
            target_date: item.targetDate || undefined,
            tracking_strategy: 'manual',
            status: 'in_progress',
          },
          supabase
        );

        if (goalRes.error || !goalRes.data) {
          executionResults.push({
            type: 'create_goal',
            success: false,
            error: goalRes.error || 'Maqsad saqlanmadi',
          });
          break; // Stop batch to prevent partial writes
        } else {
          executionResults.push({
            type: 'create_goal',
            success: true,
            data: goalRes.data,
          });
          if (goalRes.data.id) {
            createdGoalIds.push(goalRes.data.id);
          }
          successDescriptions.push(`«${item.goalName}» jamg‘arma maqsadi (${formatMoney(item.targetAmount || item.amount, item.currency)})`);
        }
      } else if (item.actionType === 'update_goal') {
        const goal = await resolveUserGoal(item.goalName, record.userId, supabase);
        if (!goal) {
          executionResults.push({
            type: 'update_goal',
            success: false,
            error: `«${item.goalName || ''}» nomli maqsad topilmadi`,
          });
          break; // Stop batch
        }

        if (!goalSnapshots.has(goal.id)) goalSnapshots.set(goal.id, { ...goal });
        const updateRes = await updateGoal(
          goal.id,
          {
            target_amount: item.targetAmount || item.amount,
            target_date: item.targetDate || undefined,
          },
          supabase
        );

        if (updateRes.error || !updateRes.data) {
          executionResults.push({
            type: 'update_goal',
            success: false,
            error: updateRes.error || 'Maqsadni yangilab bo‘lmadi',
          });
          break; // Stop batch
        } else {
          executionResults.push({
            type: 'update_goal',
            success: true,
            data: updateRes.data,
          });
          successDescriptions.push(`«${goal.name}» maqsadi yangilandi (yangi summa: ${formatMoney(item.targetAmount || item.amount, item.currency)})`);
        }
      } else if (item.actionType === 'contribute_goal') {
        const goal = await resolveUserGoal(item.goalName, record.userId, supabase);
        if (!goal) {
          executionResults.push({
            type: 'contribute_goal',
            success: false,
            error: 'Mablag‘ qo‘shish uchun maqsad topilmadi. Avval yangi maqsad yarating.',
          });
          break; // Stop batch
        }

        // Never add one currency's money to a goal kept in another currency (#28).
        if (goal.currency && (item.currency || 'UZS') !== goal.currency) {
          executionResults.push({
            type: 'contribute_goal',
            success: false,
            error: `«${goal.name}» maqsadi ${goal.currency} valyutasida, hissa esa ${item.currency || 'UZS'} da`,
          });
          break;
        }

        if (!goalSnapshots.has(goal.id)) goalSnapshots.set(goal.id, { ...goal });
        const contribSource =
          item.source === 'telegram_voice' ? 'telegram_voice' : record.telegramUserId ? 'telegram_ai' : 'manual';
        const contribRes = await contributeToGoal(
          goal.id,
          { amount: item.amount, note: item.description?.slice(0, 255) },
          supabase,
          contribSource
        );

        if (contribRes.error || !contribRes.data) {
          executionResults.push({
            type: 'contribute_goal',
            success: false,
            error: contribRes.error || 'Hisobga qo‘shishda xatolik',
          });
          break; // Stop batch
        } else {
          executionResults.push({
            type: 'contribute_goal',
            success: true,
            data: contribRes.data,
          });
          const newTotal = (contribRes.data as { current_amount?: number })?.current_amount ?? (Number(goal.current_amount) + item.amount);
          successDescriptions.push(`«${goal.name}» maqsadiga ${formatMoney(item.amount, item.currency)} qo‘shildi (Hozirda jami: ${formatMoney(newTotal, item.currency)})`);
        }
      }
    } catch (itemErr: unknown) {
      const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
      executionResults.push({
        type: item.actionType,
        success: false,
        error: msg,
      });
      break;
    }
  }

  const allSuccess = executionResults.length === record.actions.length && executionResults.every((r) => r.success);

  if (allSuccess && successDescriptions.length > 0) {
    const finalMessage = `✅ Muvaffaqiyatli bajarildi:\n` + successDescriptions.map((d) => `• ${d}`).join('\n');
    await markPendingActionCompleted(record.actionId, finalMessage, executionToken, supabase);
    return {
      success: true,
      message: finalMessage,
      results: executionResults,
    };
  }

  // Rollback on partial failure to prevent partial writes
  for (const txId of createdTransactionIds) {
    try {
      await supabase.from('transactions').delete().eq('id', txId);
    } catch (rbErr) {
      console.error('[ActionExecutor] Failed to rollback transaction:', txId, rbErr);
    }
  }
  for (const goalId of createdGoalIds) {
    try {
      await supabase.from('financial_goals').delete().eq('id', goalId);
    } catch (rbErr) {
      console.error('[ActionExecutor] Failed to rollback goal:', goalId, rbErr);
    }
  }
  // Restore goals changed by update_goal / contribute_goal to their previous values.
  for (const snap of goalSnapshots.values()) {
    if (createdGoalIds.includes(snap.id)) continue;
    try {
      const { error: restoreErr } = await supabase
        .from('financial_goals')
        .update({
          current_amount: snap.current_amount,
          target_amount: snap.target_amount,
          target_date: snap.target_date ?? null,
          ...(snap.status ? { status: snap.status } : {}),
        })
        .eq('id', snap.id)
        .eq('user_id', record.userId);
      if (restoreErr) {
        console.error('[ActionExecutor] Failed to restore goal:', snap.id, restoreErr.message);
      }
    } catch (rbErr) {
      console.error('[ActionExecutor] Failed to restore goal:', snap.id, rbErr);
    }
  }

  const failedItems = executionResults.filter((r) => !r.success).map((r) => `• ${r.error || 'Noma’lum xato'}`).join('\n');
  const failureMessage = `❌ Amallarni saqlash muvaffaqiyatsiz bo‘ldi:\n${failedItems || 'Noma’lum xato'}`;
  await markPendingActionFailed(record.actionId, failureMessage, executionToken, supabase);

  return {
    success: false,
    message: failureMessage,
    results: executionResults,
  };
}
