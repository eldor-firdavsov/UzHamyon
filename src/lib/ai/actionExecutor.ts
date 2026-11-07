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
import { matchPredictedToDbCategory } from '../categories/predictCategory.ts';
import {
  claimPendingAction,
  markPendingActionCompleted,
  markPendingActionFailed,
  type PendingActionRecord,
} from './pendingActionStore.ts';

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

function formatUzbekMoney(amount: number, curr = 'UZS'): string {
  if (curr === 'USD') {
    return `${amount >= 1000 ? amount.toLocaleString('en-US') : amount} dollar`;
  }
  return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount)).replace(/[\u00a0\u202f]/g, ' ')} so‘m`;
}

/**
 * Resolves a category ID from Supabase based on name and transaction type
 */
async function resolveCategoryId(
  categoryName: string | undefined,
  type: 'income' | 'expense',
  supabase: SupabaseClient
): Promise<string | undefined> {
  if (!categoryName) return undefined;

  try {
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('type', type);

    if (categories && categories.length > 0) {
      const matched = matchPredictedToDbCategory(categoryName, categories);
      return matched?.id;
    }
  } catch (err) {
    console.warn('[ActionExecutor] Failed to resolve category ID:', err);
  }

  return undefined;
}

/**
 * Resolves an existing financial goal for the user by name or fallback
 */
async function resolveUserGoal(
  goalName: string | undefined,
  userId: string,
  supabase: SupabaseClient
): Promise<{ id: string; name: string; current_amount: number; target_amount: number } | null> {
  try {
    const { data: goals } = await supabase
      .from('financial_goals')
      .select('id, name, current_amount, target_amount, status')
      .eq('user_id', userId);

    if (!goals || goals.length === 0) return null;

    if (goalName) {
      const cleanName = goalName.toLowerCase().trim();
      const direct = goals.find((g) => g.name.toLowerCase() === cleanName);
      if (direct) return direct;

      const partial = goals.find((g) => g.name.toLowerCase().includes(cleanName) || cleanName.includes(g.name.toLowerCase()));
      if (partial) return partial;

      return null;
    }

    // Fallback to active in-progress goal only when no specific goalName is requested
    const active = goals.find((g) => g.status === 'in_progress');
    return active || goals[0];
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
          return {
            success: false,
            message: 'Ushbu amal allaqachon bajarilgan',
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

  for (const item of record.actions) {
    try {
      if (item.actionType === 'create_transaction') {
        const txType = item.transactionType || 'expense';
        const categoryId = await resolveCategoryId(item.categoryName, txType, supabase);

        const txRes = await createTransaction(
          {
            amount: item.amount,
            currency: item.currency || 'UZS',
            type: txType,
            description: item.description,
            transaction_date: item.date || new Date().toISOString().split('T')[0],
            category_id: categoryId,
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
          successDescriptions.push(`${item.description} (${formatUzbekMoney(item.amount, item.currency)} ${typeLabel})`);
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
          successDescriptions.push(`«${item.goalName}» jamg‘arma maqsadi (${formatUzbekMoney(item.targetAmount || item.amount, item.currency)})`);
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
          successDescriptions.push(`«${goal.name}» maqsadi yangilandi (yangi summa: ${formatUzbekMoney(item.targetAmount || item.amount, item.currency)})`);
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

        const contribRes = await contributeToGoal(
          goal.id,
          { amount: item.amount },
          supabase
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
          successDescriptions.push(`«${goal.name}» maqsadiga ${formatUzbekMoney(item.amount, item.currency)} qo‘shildi (Hozirda jami: ${formatUzbekMoney(newTotal, item.currency)})`);
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

  const failedItems = executionResults.filter((r) => !r.success).map((r) => `• ${r.error || 'Noma’lum xato'}`).join('\n');
  const failureMessage = `❌ Amallarni saqlash muvaffaqiyatsiz bo‘ldi:\n${failedItems || 'Noma’lum xato'}`;
  await markPendingActionFailed(record.actionId, failureMessage, executionToken, supabase);

  return {
    success: false,
    message: failureMessage,
    results: executionResults,
  };
}
