'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, htmlLang, langFromOnboardingData, type Lang } from './config';
import { getDict, type Dict } from './dict';
import { saveLanguageAction } from './actions';

interface I18nValue {
  lang: Lang;
  t: Dict;
  /**
   * Switches the language right away (client texts re-render, server-rendered parts refresh).
   * `persist` (default true) also saves it to the profile so the bot speaks it too.
   */
  setLang: (lang: Lang, options?: { persist?: boolean }) => Promise<void>;
}

const I18nContext = createContext<I18nValue | null>(null);

function writeCookie(lang: Lang): void {
  const secure = window.location.protocol === 'https:';
  document.cookie =
    `${LANG_COOKIE}=${lang}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; ` +
    (secure ? 'SameSite=None; Secure' : 'SameSite=Lax');
}

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);
  /** The user picked a language on this page: a late profile read must not undo it. */
  const chosenHere = useRef(false);

  const apply = useCallback(
    (next: Lang) => {
      writeCookie(next);
      document.documentElement.lang = htmlLang(next);
      setLangState(next);
      // Server components (titles, settings page) read the cookie: render them again.
      router.refresh();
    },
    [router]
  );

  const setLang = useCallback(
    async (next: Lang, options: { persist?: boolean } = {}) => {
      chosenHere.current = true;
      if (next !== lang) apply(next);
      if (options.persist !== false) {
        await saveLanguageAction(next).catch(() => ({ success: false }));
      }
    },
    [apply, lang]
  );

  // The profile is the source of truth (the bot or another device may have changed it):
  // once signed in, follow it if it differs from this device's cookie.
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data } = await supabase
          .from('profiles')
          .select('onboarding_data')
          .eq('id', session.user.id)
          .maybeSingle();
        const stored = langFromOnboardingData(data?.onboarding_data);
        if (!cancelled && stored && !chosenHere.current && stored !== lang) apply(stored);
      } catch {
        // keep the current language
      }
    };
    void sync();
    window.addEventListener('uzhamyon:auth-synced', sync);
    return () => {
      cancelled = true;
      window.removeEventListener('uzhamyon:auth-synced', sync);
    };
  }, [apply, lang]);

  const value = useMemo<I18nValue>(() => ({ lang, t: getDict(lang), setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Current language and texts. Outside the provider (tests, previews) → Uzbek. */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return { lang: 'uz', t: getDict('uz'), setLang: async () => {} };
}
