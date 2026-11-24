import type { Lang } from '../config.ts';
import uz, { type Dict } from './uz.ts';
import ru from './ru.ts';
import en from './en.ts';

export type { Dict };

const DICTS: Record<Lang, Dict> = { uz, ru, en };

export function getDict(lang: Lang): Dict {
  return DICTS[lang] ?? uz;
}
