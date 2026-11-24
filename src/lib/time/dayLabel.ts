import { relativeDay } from '../i18n/format.ts';
import type { Lang } from '../i18n/config.ts';

/** "Bugun", "Kecha" or "18-noy" (in `lang`) for a YYYY-MM-DD date, relative to today (Tashkent). */
export function dayLabel(date: string, today: string, lang: Lang = 'uz'): string {
  return relativeDay(date, today, lang);
}
