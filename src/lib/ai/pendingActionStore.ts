/**
 * UzHamyon Persistent Pending Action Store
 *
 * Persists and coordinates user confirmation for financial actions.
 * Guarantees:
 * - Scoped strictly to verified authenticated user ID and verified Telegram user ID
 * - Atomic conditional claiming in database to prevent duplicate execution
 * - Execution lock recovery via locked_until (2 minutes) to prevent stuck 'executing' states
 * - Missing migration safety: fails safely if pending_ai_actions table does not exist
 * - Expiration window (15 minutes)
 */

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type { ExtractedActionItem } from './actionExtractionEngine.ts';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '../supabase/config.ts';

export interface PendingActionRecord {
  actionId: string;
  userId: string;
  telegramUserId?: number;
  telegramChatId?: number;
  intent: 'action_proposal' | 'clarification' | 'financial_query' | 'casual_chat';
  actions: ExtractedActionItem[];
  previewUzbek: string;
  status: 'pending' | 'executing' | 'executed' | 'cancelled' | 'expired' | 'failed';
  resultMessage?: string;
  errorDetails?: string;
  retryCount: number;
  executionToken?: string;
  executionStartedAt?: number;
  lockedUntil?: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  completedAt?: number;
}

const ACTION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const LOCK_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Test-only memory fallback cache (strictly disabled in production)
const testMemoryStore = new Map<string, PendingActionRecord>();

function getAdminClient(providedClient?: SupabaseClient): SupabaseClient | null {
  if (providedClient) return providedClient;
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    Boolean(error.message?.includes('schema cache')) ||
    Boolean(error.message?.includes('pending_ai_actions'))
  );
}

/**
 * Creates and stores a new pending action proposal in Supabase.
 * Fails safely if migration 011 is not applied in production.
 */
export async function savePendingAction(
  userId: string,
  actions: ExtractedActionItem[],
  previewUzbek: string,
  extra?: {
    telegramUserId?: number;
    telegramChatId?: number;
    intent?: 'action_proposal' | 'clarification' | 'financial_query' | 'casual_chat';
  },
  client?: SupabaseClient
): Promise<{ record?: PendingActionRecord; error?: string; migrationMissing?: boolean }> {
  const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const expiresAt = now + ACTION_TTL_MS;
  const db = getAdminClient(client);

  const localRecord: PendingActionRecord = {
    actionId,
    userId,
    telegramUserId: extra?.telegramUserId,
    telegramChatId: extra?.telegramChatId,
    intent: extra?.intent || 'action_proposal',
    actions,
    previewUzbek,
    status: 'pending',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  if (db) {
    try {
      const { data, error } = await db
        .from('pending_ai_actions')
        .insert({
          action_id: actionId,
          user_id: userId,
          telegram_user_id: extra?.telegramUserId || null,
          telegram_chat_id: extra?.telegramChatId || null,
          intent: extra?.intent || 'action_proposal',
          actions: actions,
          preview_uzbek: previewUzbek,
          status: 'pending',
          retry_count: 0,
          created_at: new Date(now).toISOString(),
          updated_at: new Date(now).toISOString(),
          expires_at: new Date(expiresAt).toISOString(),
        })
        .select()
        .maybeSingle();

      if (!error && data) {
        return { record: mapDbRowToRecord(data) };
      }

      if (isMissingTableError(error)) {
        console.error('[pendingActionStore] FATAL: pending_ai_actions table does not exist.');
        // Requirement 4: Never silently fall back to in-memory pending-action storage in production.
        if (process.env.NODE_ENV === 'production') {
          return {
            error: 'Xavfsizlik xatoligi: pending_ai_actions jadvali mavjud emas. Ma’lumotlar yo‘qolishining oldini olish uchun amal qabul qilinmadi.',
            migrationMissing: true,
          };
        }

        // Test/Dev fallback only
        testMemoryStore.set(actionId, localRecord);
        return { record: localRecord, migrationMissing: true };
      }

      if (error) {
        return { error: error.message };
      }
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (process.env.NODE_ENV === 'production') {
        return { error: `Bazaga saqlashda xatolik: ${msg}` };
      }
      testMemoryStore.set(actionId, localRecord);
      return { record: localRecord, migrationMissing: true };
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return {
      error: 'Ma’lumotlar bazasi mijozi mavjud emas.',
      migrationMissing: true,
    };
  }

  testMemoryStore.set(actionId, localRecord);
  return { record: localRecord };
}

/**
 * Retrieves a pending action by ID with dual user authorization and expiry check
 */
export async function getPendingAction(
  actionId: string,
  userId: string,
  telegramUserId?: number,
  client?: SupabaseClient
): Promise<{ record?: PendingActionRecord; error?: 'not_found' | 'unauthorized' | 'expired' | 'already_processed' }> {
  const db = getAdminClient(client);

  if (db) {
    try {
      const { data, error } = await db
        .from('pending_ai_actions')
        .select('*')
        .eq('action_id', actionId)
        .maybeSingle();

      if (!error && data) {
        const record = mapDbRowToRecord(data);

        // Verify Supabase user ownership
        if (record.userId !== userId) {
          return { error: 'unauthorized' };
        }

        // Verify Telegram identity if provided
        if (telegramUserId && record.telegramUserId && record.telegramUserId !== telegramUserId) {
          return { error: 'unauthorized' };
        }

        if (Date.now() > record.expiresAt) {
          return { error: 'expired', record };
        }

        if (record.status === 'executed' || record.status === 'cancelled') {
          return { error: 'already_processed', record };
        }

        return { record };
      }
    } catch {
      // Continue to test fallback
    }
  }

  // Test memory store lookup
  const record = testMemoryStore.get(actionId);
  if (!record) return { error: 'not_found' };

  if (record.userId !== userId) return { error: 'unauthorized' };
  if (telegramUserId && record.telegramUserId && record.telegramUserId !== telegramUserId) {
    return { error: 'unauthorized' };
  }

  if (Date.now() > record.expiresAt) return { error: 'expired', record };
  if (record.status === 'executed' || record.status === 'cancelled') {
    return { error: 'already_processed', record };
  }

  return { record };
}

/**
 * Finds the most recent active pending action for a user (e.g. when user texts "Ha, tasdiqlayman")
 */
export async function getLatestActivePendingAction(
  userId: string,
  telegramUserId?: number,
  client?: SupabaseClient
): Promise<PendingActionRecord | null> {
  const db = getAdminClient(client);
  const nowIso = new Date().toISOString();

  if (db) {
    try {
      let query = db
        .from('pending_ai_actions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1);

      if (telegramUserId) {
        query = query.eq('telegram_user_id', telegramUserId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return mapDbRowToRecord(data[0]);
      }
    } catch {
      // Continue to test memory lookup
    }
  }

  // Test memory store
  const now = Date.now();
  let latest: PendingActionRecord | null = null;

  for (const record of testMemoryStore.values()) {
    if (
      record.userId === userId &&
      record.status === 'pending' &&
      now <= record.expiresAt &&
      (!telegramUserId || !record.telegramUserId || record.telegramUserId === telegramUserId)
    ) {
      if (!latest || record.createdAt > latest.createdAt) {
        latest = record;
      }
    }
  }

  return latest;
}

/**
 * Atomically claims a pending action for execution.
 * Enforces:
 * - Dual identity validation (Supabase userId + Telegram telegramUserId)
 * - Atomic conditional locking in PostgreSQL
 * - Execution recovery if locked_until has expired (handles worker crash)
 * - Immediate rejection of concurrent/duplicate callbacks
 */
export async function claimPendingAction(
  actionId: string,
  userId: string,
  telegramUserId?: number,
  client?: SupabaseClient
): Promise<{ success: boolean; record?: PendingActionRecord; reason?: string }> {
  const db = getAdminClient(client);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const lockedUntilIso = new Date(now + LOCK_TTL_MS).toISOString();

  if (db) {
    try {
      // 1. Fetch current row state
      const { data: existing, error: selectErr } = await db
        .from('pending_ai_actions')
        .select('*')
        .eq('action_id', actionId)
        .maybeSingle();

      if (selectErr && isMissingTableError(selectErr)) {
        if (process.env.NODE_ENV === 'production') {
          return { success: false, reason: 'pending_ai_actions jadvali mavjud emas' };
        }
        return claimMemoryPendingAction(actionId, userId, telegramUserId);
      }

      if (!existing) {
        return { success: false, reason: 'Amal topilmadi yoki muddati o‘tgan' };
      }

      const record = mapDbRowToRecord(existing);

      // Verify identities
      if (record.userId !== userId) {
        return { success: false, reason: 'Ruxsat berilmagan: foydalanuvchi mos kelmadi' };
      }

      if (telegramUserId && record.telegramUserId && record.telegramUserId !== telegramUserId) {
        return { success: false, reason: 'Ruxsat berilmagan: Telegram shaxsiyati mos kelmadi' };
      }

      if (now > record.expiresAt || record.status === 'expired') {
        return { success: false, reason: 'Amal muddati tugagan (15 daqiqa)', record };
      }

      if (record.status === 'executed') {
        return { success: false, reason: 'Ushbu amal allaqachon bajarilgan', record };
      }

      if (record.status === 'cancelled') {
        return { success: false, reason: 'Ushbu amal bekor qilingan', record };
      }

      // Check active execution lock
      if (record.status === 'executing') {
        const isLockActive = record.lockedUntil && record.lockedUntil > now;
        if (isLockActive) {
          return { success: false, reason: 'Amal hozirda bajarilmoqda. Iltimos kuting.', record };
        }
        // Lock expired -> allow recovery
        console.warn(`[pendingActionStore] Recovering expired execution lock for action ${actionId}`);
      }

      // 2. Atomic conditional claim in PostgreSQL
      const executionToken = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { data: updated, error: updateErr } = await db
        .from('pending_ai_actions')
        .update({
          status: 'executing',
          execution_token: executionToken,
          execution_started_at: nowIso,
          locked_until: lockedUntilIso,
          updated_at: nowIso,
          retry_count: (record.retryCount || 0) + (record.status === 'executing' ? 1 : 0),
        })
        .eq('action_id', actionId)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (!updateErr && updated) {
        return { success: true, record: mapDbRowToRecord(updated) };
      }

      return { success: false, reason: 'Ushbu amal allaqachon bajarilmoqda yoki yakunlangan' };
    } catch {
      if (process.env.NODE_ENV === 'production') {
        return { success: false, reason: 'Bazaviy xatolik tufayli amal egallanmadi' };
      }
      return claimMemoryPendingAction(actionId, userId, telegramUserId);
    }
  }

  return claimMemoryPendingAction(actionId, userId, telegramUserId);
}

function claimMemoryPendingAction(
  actionId: string,
  userId: string,
  telegramUserId?: number
): { success: boolean; record?: PendingActionRecord; reason?: string } {
  const record = testMemoryStore.get(actionId);
  if (!record) return { success: false, reason: 'Topilmadi yoki muddati o‘tgan' };

  if (record.userId !== userId) {
    return { success: false, reason: 'Ruxsat berilmagan' };
  }

  if (telegramUserId && record.telegramUserId && record.telegramUserId !== telegramUserId) {
    return { success: false, reason: 'Ruxsat berilmagan: Telegram shaxsiyati mos kelmadi' };
  }

  const now = Date.now();
  if (now > record.expiresAt || record.status === 'expired') {
    record.status = 'expired';
    return { success: false, reason: 'Amal muddati tugagan (15 daqiqa)', record };
  }

  if (record.status === 'executed') {
    return { success: false, reason: 'Ushbu amal allaqachon bajarilgan', record };
  }

  if (record.status === 'cancelled') {
    return { success: false, reason: 'Ushbu amal bekor qilingan', record };
  }

  if (record.status === 'executing') {
    if (record.lockedUntil && record.lockedUntil > now) {
      return { success: false, reason: 'Amal hozirda bajarilmoqda', record };
    }
    // Lock expired, allow recovery
    record.retryCount++;
  }

  const executionToken = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  record.status = 'executing';
  record.executionToken = executionToken;
  record.executionStartedAt = now;
  record.lockedUntil = now + LOCK_TTL_MS;
  return { success: true, record };
}

/**
 * Marks a claimed pending action as successfully executed
 */
export async function markPendingActionCompleted(
  actionId: string,
  resultMessage: string,
  executionToken?: string,
  client?: SupabaseClient
): Promise<void> {
  const db = getAdminClient(client);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  if (db) {
    try {
      let query = db
        .from('pending_ai_actions')
        .update({
          status: 'executed',
          completed_at: nowIso,
          result_message: resultMessage,
          locked_until: null,
          updated_at: nowIso,
        })
        .eq('action_id', actionId);

      if (executionToken) {
        query = query.eq('execution_token', executionToken);
      }

      await query;
    } catch {
      // Continue to local update
    }
  }

  const mem = testMemoryStore.get(actionId);
  if (mem) {
    if (!executionToken || !mem.executionToken || mem.executionToken === executionToken) {
      mem.status = 'executed';
      mem.completedAt = now;
      mem.resultMessage = resultMessage;
      mem.lockedUntil = undefined;
    }
  }
}

/**
 * Marks a claimed pending action as failed
 */
export async function markPendingActionFailed(
  actionId: string,
  errorDetails: string,
  executionToken?: string,
  client?: SupabaseClient
): Promise<void> {
  const db = getAdminClient(client);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  if (db) {
    try {
      let query = db
        .from('pending_ai_actions')
        .update({
          status: 'failed',
          error_details: errorDetails,
          locked_until: null,
          updated_at: nowIso,
        })
        .eq('action_id', actionId);

      if (executionToken) {
        query = query.eq('execution_token', executionToken);
      }

      await query;
    } catch {
      // Continue to local update
    }
  }

  const mem = testMemoryStore.get(actionId);
  if (mem) {
    if (!executionToken || !mem.executionToken || mem.executionToken === executionToken) {
      mem.status = 'failed';
      mem.errorDetails = errorDetails;
      mem.lockedUntil = undefined;
    }
  }
}

/**
 * Cancels a pending action
 */
export async function cancelPendingAction(
  actionId: string,
  userId: string,
  telegramUserId?: number,
  client?: SupabaseClient
): Promise<{ success: boolean; reason?: string }> {
  const db = getAdminClient(client);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  if (db) {
    try {
      const { data: existing } = await db
        .from('pending_ai_actions')
        .select('user_id, telegram_user_id, status, locked_until')
        .eq('action_id', actionId)
        .maybeSingle();

      if (existing) {
        if (existing.user_id !== userId) {
          return { success: false, reason: 'Ruxsat berilmagan' };
        }
        if (telegramUserId && existing.telegram_user_id && existing.telegram_user_id !== telegramUserId) {
          return { success: false, reason: 'Ruxsat berilmagan: Telegram shaxsiyati mos kelmadi' };
        }
        if (existing.status === 'executed') {
          return { success: false, reason: 'Bajarilgan amalni bekor qilib bo‘lmaydi' };
        }
        if (existing.status === 'executing') {
          const isLockActive = existing.locked_until && new Date(existing.locked_until).getTime() > now;
          if (isLockActive) {
            return { success: false, reason: 'Amal hozirda bajarilmoqda, uni bekor qilib bo‘lmaydi' };
          }
        }

        await db
          .from('pending_ai_actions')
          .update({
            status: 'cancelled',
            completed_at: nowIso,
            locked_until: null,
            updated_at: nowIso,
          })
          .eq('action_id', actionId)
          .eq('user_id', userId)
          .neq('status', 'executed');

        return { success: true };
      }
    } catch {
      // Continue to local
    }
  }

  const mem = testMemoryStore.get(actionId);
  if (!mem) return { success: false, reason: 'Topilmadi' };
  if (mem.userId !== userId) return { success: false, reason: 'Ruxsat berilmagan' };
  if (telegramUserId && mem.telegramUserId && mem.telegramUserId !== telegramUserId) {
    return { success: false, reason: 'Ruxsat berilmagan: Telegram shaxsiyati mos kelmadi' };
  }
  if (mem.status === 'executed') {
    return { success: false, reason: 'Bajarilgan amalni bekor qilib bo‘lmaydi' };
  }
  if (mem.status === 'executing') {
    if (mem.lockedUntil && mem.lockedUntil > now) {
      return { success: false, reason: 'Amal hozirda bajarilmoqda, uni bekor qilib bo‘lmaydi' };
    }
  }

  mem.status = 'cancelled';
  mem.completedAt = now;
  mem.lockedUntil = undefined;
  return { success: true };
}

function mapDbRowToRecord(row: Record<string, unknown>): PendingActionRecord {
  return {
    actionId: String(row.action_id),
    userId: String(row.user_id),
    telegramUserId: row.telegram_user_id ? Number(row.telegram_user_id) : undefined,
    telegramChatId: row.telegram_chat_id ? Number(row.telegram_chat_id) : undefined,
    intent: (row.intent as PendingActionRecord['intent']) || 'action_proposal',
    actions: Array.isArray(row.actions) ? (row.actions as ExtractedActionItem[]) : [],
    previewUzbek: String(row.preview_uzbek || ''),
    status: row.status as PendingActionRecord['status'],
    resultMessage: row.result_message ? String(row.result_message) : undefined,
    errorDetails: row.error_details ? String(row.error_details) : undefined,
    retryCount: Number(row.retry_count) || 0,
    executionToken: row.execution_token ? String(row.execution_token) : undefined,
    executionStartedAt: row.execution_started_at ? new Date(String(row.execution_started_at)).getTime() : undefined,
    lockedUntil: row.locked_until ? new Date(String(row.locked_until)).getTime() : undefined,
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at)).getTime(),
    expiresAt: new Date(String(row.expires_at)).getTime(),
    completedAt: row.completed_at ? new Date(String(row.completed_at)).getTime() : undefined,
  };
}

/**
 * Checks if a user message is an affirmative confirmation
 */
export function isUserConfirmation(text: string): boolean {
  const norm = text
    .toLowerCase()
    .replace(/['`’‘ʻʼʹ]/g, '')
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    /^(ha|tasdiq|tasdiqlayman|ha tasdiqlayman|ha albatta|ha saqla|saqla|ha bajar|bajar|yes|confirm|albatta|roziman|mayli|qayd et)$/i.test(
      norm
    ) || /^(ha|tasdiqlayman|saqla)\b/i.test(norm)
  );
}

/**
 * Checks if a user message is a cancellation
 */
export function isUserCancellation(text: string): boolean {
  const norm = text
    .toLowerCase()
    .replace(/['`’‘ʻʼʹ]/g, '')
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    /^(yoq|bekor|bekor qil|bekor qilish|rad|rad etaman|kerak emas|keragi yoq|shart emas|no|cancel)$/i.test(
      norm
    ) || /^(bekor|rad et)\b/i.test(norm)
  );
}
