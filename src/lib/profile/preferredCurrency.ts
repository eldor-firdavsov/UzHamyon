import type { SupabaseClient } from '@supabase/supabase-js';
import { toDisplayCurrency, type DisplayCurrency } from '../fx/currency.ts';

/**
 * The user's display currency. 'UZS' when the column is missing (migration 017 not yet
 * applied), the profile does not exist, or anything fails — never throws.
 */
export async function getPreferredCurrency(supabase: SupabaseClient, userId: string): Promise<DisplayCurrency> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('preferred_currency')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return 'UZS';
    return toDisplayCurrency((data as { preferred_currency?: string }).preferred_currency);
  } catch {
    return 'UZS';
  }
}

export async function setPreferredCurrency(
  supabase: SupabaseClient,
  userId: string,
  currency: DisplayCurrency
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('profiles').update({ preferred_currency: currency }).eq('id', userId);
  if (error) {
    const missing = error.code === '42703' || error.code === 'PGRST204' || /preferred_currency/.test(error.message || '');
    return { ok: false, error: missing ? 'Valyuta sozlamasi hali yoqilmagan (bazada migratsiya kerak)' : error.message };
  }
  return { ok: true };
}
