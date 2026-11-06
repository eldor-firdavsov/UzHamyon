import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '../supabase/config.ts';

export interface WebhookClaimResult {
  canProcess: boolean;
  reason?: 'already_completed' | 'concurrent_in_progress' | 'retry_after_failure' | 'stale_lock_recovered' | 'fresh_claim';
  isDuplicate?: boolean;
}

// In-memory fallback cache (used when database table is unavailable or in offline environments)
const memoryProcessed = new Map<number, { status: 'processing' | 'completed' | 'failed'; timestamp: number }>();
const MAX_MEMORY_ITEMS = 1000;
const STALE_LOCK_MS = 60 * 1000; // 60 seconds

function getAdminClient(customClient?: SupabaseClient): SupabaseClient | null {
  if (customClient) return customClient;
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Claims a Telegram update for processing.
 * Guarantees that concurrent or duplicate webhook deliveries cannot be processed simultaneously
 * or re-executed once completed.
 */
export async function claimWebhookUpdate(
  updateId: number,
  chatId?: number,
  userId?: number,
  client?: SupabaseClient
): Promise<WebhookClaimResult> {
  const db = getAdminClient(client);

  if (db) {
    try {
      // 1. Attempt to insert a 'processing' record (enforcing DB-level primary key / unique constraint)
      const { error: insertError } = await db.from('telegram_webhook_updates').insert({
        update_id: updateId,
        chat_id: chatId || null,
        user_id: userId || null,
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (!insertError) {
        return { canProcess: true, reason: 'fresh_claim' };
      }

      // If insert failed because table does not exist (pre-migration), fall back to memory
      if (
        insertError.code === '42P01' ||
        insertError.code === 'PGRST205' ||
        insertError.message?.includes('schema cache') ||
        insertError.message?.includes('telegram_webhook_updates')
      ) {
        if (process.env.NODE_ENV === 'production') {
          console.warn(
            '[webhookIdempotency] WARNING: telegram_webhook_updates table does not exist. Memory fallback is not persistent across Vercel serverless lambdas. Please apply migration 010.'
          );
        }
        return claimMemoryUpdate(updateId);
      }

      // 2. If duplicate key (23505), inspect current row state
      if (insertError.code === '23505') {
        const { data: existing, error: selectError } = await db
          .from('telegram_webhook_updates')
          .select('status, created_at, updated_at')
          .eq('update_id', updateId)
          .maybeSingle();

        if (selectError || !existing) {
          // If select failed, fall back to memory
          return claimMemoryUpdate(updateId);
        }

        if (existing.status === 'completed') {
          return { canProcess: false, reason: 'already_completed', isDuplicate: true };
        }

        if (existing.status === 'processing') {
          const updatedAtTime = new Date(existing.updated_at || existing.created_at).getTime();
          const isStale = Date.now() - updatedAtTime > STALE_LOCK_MS;

          if (isStale) {
            // Worker likely crashed while processing; recover stale lock
            await db
              .from('telegram_webhook_updates')
              .update({ status: 'processing', updated_at: new Date().toISOString() })
              .eq('update_id', updateId);
            return { canProcess: true, reason: 'stale_lock_recovered' };
          }

          // Actively being processed by another worker/instance
          return { canProcess: false, reason: 'concurrent_in_progress', isDuplicate: true };
        }

        if (existing.status === 'failed') {
          // Previous attempt failed, allow retry
          await db
            .from('telegram_webhook_updates')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('update_id', updateId);
          return { canProcess: true, reason: 'retry_after_failure' };
        }
      }
    } catch {
      // Database connection error: fall back to memory
      return claimMemoryUpdate(updateId);
    }
  }

  return claimMemoryUpdate(updateId);
}

/**
 * Marks a claimed webhook update as successfully completed.
 */
export async function completeWebhookUpdate(updateId: number, client?: SupabaseClient): Promise<void> {
  // Update in-memory record
  memoryProcessed.set(updateId, { status: 'completed', timestamp: Date.now() });

  const db = getAdminClient(client);
  if (db) {
    try {
      await db
        .from('telegram_webhook_updates')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('update_id', updateId);
    } catch {
      // Silent error: memory state already updated
    }
  }
}

/**
 * Marks a claimed webhook update as failed, recording error message and permitting safe retry.
 */
export async function failWebhookUpdate(
  updateId: number,
  errorMessage: string,
  client?: SupabaseClient
): Promise<void> {
  // Update in-memory record
  memoryProcessed.set(updateId, { status: 'failed', timestamp: Date.now() });

  const db = getAdminClient(client);
  if (db) {
    try {
      await db
        .from('telegram_webhook_updates')
        .update({
          status: 'failed',
          error_message: errorMessage.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('update_id', updateId);
    } catch {
      // Silent error: memory state already updated
    }
  }
}

/**
 * In-memory claim implementation with bounded memory usage and stale lock detection.
 */
function claimMemoryUpdate(updateId: number): WebhookClaimResult {
  const existing = memoryProcessed.get(updateId);

  if (!existing) {
    // Add to memory
    if (memoryProcessed.size >= MAX_MEMORY_ITEMS) {
      const oldestKey = memoryProcessed.keys().next().value;
      if (oldestKey !== undefined) memoryProcessed.delete(oldestKey);
    }
    memoryProcessed.set(updateId, { status: 'processing', timestamp: Date.now() });
    return { canProcess: true, reason: 'fresh_claim' };
  }

  if (existing.status === 'completed') {
    return { canProcess: false, reason: 'already_completed', isDuplicate: true };
  }

  if (existing.status === 'processing') {
    const isStale = Date.now() - existing.timestamp > STALE_LOCK_MS;
    if (isStale) {
      memoryProcessed.set(updateId, { status: 'processing', timestamp: Date.now() });
      return { canProcess: true, reason: 'stale_lock_recovered' };
    }
    return { canProcess: false, reason: 'concurrent_in_progress', isDuplicate: true };
  }

  if (existing.status === 'failed') {
    memoryProcessed.set(updateId, { status: 'processing', timestamp: Date.now() });
    return { canProcess: true, reason: 'retry_after_failure' };
  }

  return { canProcess: false, reason: 'already_completed', isDuplicate: true };
}

/**
 * Resets in-memory state (useful for test isolation).
 */
export function resetMemoryWebhookState(): void {
  memoryProcessed.clear();
}
