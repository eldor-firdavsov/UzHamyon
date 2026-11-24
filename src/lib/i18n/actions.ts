'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, normalizeLang } from './config';

/**
 * Saves the language choice: the `uzh_lang` cookie (server-rendered pages) and
 * profiles.onboarding_data.language (the Telegram bot reads it from there).
 * Works before sign-in too (cookie only).
 */
export async function saveLanguageAction(value: string): Promise<{ success: boolean; error?: string }> {
  const lang = normalizeLang(value);
  if (!lang) return { success: false, error: 'unsupported language' };

  const store = await cookies();
  // SameSite=None: the Mini App runs inside Telegram's web client iframe, like the auth cookies.
  store.set(LANG_COOKIE, lang, { path: '/', maxAge: LANG_COOKIE_MAX_AGE, sameSite: 'none', secure: true });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: true };

    const { data: profile, error: readErr } = await supabase
      .from('profiles')
      .select('onboarding_data')
      .eq('id', user.id)
      .maybeSingle();
    if (readErr) return { success: false, error: readErr.message };

    const data = (profile?.onboarding_data as Record<string, unknown> | null) || {};
    if (data.language === lang) return { success: true };

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_data: { ...data, language: lang }, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'save failed' };
  }
}
