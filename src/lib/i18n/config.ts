/**
 * Languages UzHamyon speaks: Uzbek (default), Russian, English.
 *
 * The user's choice lives in profiles.onboarding_data.language (no extra column, so no
 * migration). The Mini App mirrors it in the `uzh_lang` cookie so pages render in the right
 * language on the server; the bot reads it from the profile.
 *
 * Plain module (no Next/React imports): the Telegram bot and node tests import it too.
 */

export const LANGS = ['uz', 'ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'uz';
export const LANG_COOKIE = 'uzh_lang';
/** One year. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Names shown in the picker, each in its own language. */
export const LANG_OPTIONS: Array<{ id: Lang; native: string; flag: string }> = [
  { id: 'uz', native: 'O‘zbekcha', flag: '🇺🇿' },
  { id: 'ru', native: 'Русский', flag: '🇷🇺' },
  { id: 'en', native: 'English', flag: '🇬🇧' },
];

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** A stored or requested value → a supported language, or null. */
export function normalizeLang(value: unknown): Lang | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().slice(0, 2);
  return isLang(v) ? v : null;
}

/**
 * Best guess from Telegram's language_code before the user has chosen:
 * Uzbek → uz; Russian and neighbouring languages people in the region read in Russian → ru;
 * anything else → en. No code at all → Uzbek (the app's home audience).
 */
export function langFromTelegram(code: string | null | undefined): Lang {
  const c = (code || '').toLowerCase().slice(0, 2);
  if (!c) return DEFAULT_LANG;
  if (c === 'uz') return 'uz';
  if (['ru', 'uk', 'be', 'kk', 'ky', 'tg', 'tk', 'az', 'hy', 'ka'].includes(c)) return 'ru';
  return 'en';
}

/** The chosen language from a profile's onboarding_data, or null if none was chosen yet. */
export function langFromOnboardingData(data: unknown): Lang | null {
  if (!data || typeof data !== 'object') return null;
  return normalizeLang((data as Record<string, unknown>).language);
}

/**
 * Language for a profile: the explicit choice, else Uzbek. People who signed up before the
 * language choice existed keep Uzbek; Telegram's language_code only pre-selects the picker.
 */
export function langForProfile(data: unknown): Lang {
  return langFromOnboardingData(data) ?? DEFAULT_LANG;
}

/** Telegram's language_code stored at sign-up (onboarding_data.language_code), if any. */
export function storedTelegramCode(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const v = (data as Record<string, unknown>).language_code;
  return typeof v === 'string' ? v : null;
}

/** BCP 47 tag for <html lang> and Intl. */
export function htmlLang(lang: Lang): string {
  return lang === 'uz' ? 'uz' : lang === 'ru' ? 'ru' : 'en';
}
