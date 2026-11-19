/**
 * Where new users come from (Phase 3A).
 *
 * t.me/uz_hamyonbot?start=<payload> sends "/start <payload>". The first source seen for a
 * user is stored in profiles.signup_source (migration 015) and never overwritten:
 * the UPDATE only matches rows where signup_source IS NULL. Users who existed before
 * tracking are 'before_tracking'. Best-effort: without 015 nothing breaks.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '../supabase/config.ts';

export const SOURCE_PATTERN = /^[a-z0-9_]{1,32}$/;

/** "/start landing_hero" → "landing_hero"; "/start" → "direct"; invalid payload → "direct". */
export function sourceFromStartCommand(text: string): string {
  const m = text.trim().match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?/);
  const payload = m?.[1];
  return payload && SOURCE_PATTERN.test(payload) ? payload : 'direct';
}

function adminClient(): SupabaseClient | null {
  const key = getSupabaseServiceRoleKey();
  if (!key) return null;
  return createClient(getSupabaseUrl(), key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Stores the first source for a profile (by user id). Never overwrites. Never throws. */
export async function recordSignupSource(
  userId: string,
  source: string,
  client: SupabaseClient | null = adminClient()
): Promise<boolean> {
  if (!client || !SOURCE_PATTERN.test(source)) return false;
  try {
    const { data, error } = await client
      .from('profiles')
      .update({ signup_source: source, signup_source_at: new Date().toISOString() })
      .eq('id', userId)
      .is('signup_source', null)
      .select('id');
    if (error) {
      if (!/signup_source/.test(error.message || '')) {
        console.warn('[signupSource] update failed:', error.message);
      }
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}
