import { cookies } from 'next/headers';
import { DEFAULT_LANG, LANG_COOKIE, normalizeLang, type Lang } from './config';
import { getDict, type Dict } from './dict';

/** The Mini App language for this request (the `uzh_lang` cookie), Uzbek by default. */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return normalizeLang(store.get(LANG_COOKIE)?.value) ?? DEFAULT_LANG;
}

export async function getT(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: getDict(lang) };
}
