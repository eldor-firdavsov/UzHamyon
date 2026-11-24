/**
 * Language-aware dates, money and category names. Pure functions: used by the Mini App,
 * the Telegram bot and node tests alike.
 */

import type { Lang } from './config.ts';
import { normalizeCategoryName, UZ_SYSTEM_CATEGORIES } from '../categories/catalog.ts';

const MONTHS: Record<Lang, string[]> = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** Genitive for "18 ноября" style day headers. */
const MONTHS_GENITIVE_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const SHORT_MONTHS: Record<Lang, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Monday → Sunday, two letters. */
export const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  uz: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
};

const TODAY: Record<Lang, string> = { uz: 'Bugun', ru: 'Сегодня', en: 'Today' };
const YESTERDAY: Record<Lang, string> = { uz: 'Kecha', ru: 'Вчера', en: 'Yesterday' };

/** "Noyabr" / "Ноябрь" / "November" for month 1–12. */
export function monthName(month: number, lang: Lang): string {
  return MONTHS[lang][month - 1] ?? '';
}

/** Three-letter month for compact chips ("Noy", "Ноя", "Nov"). */
export function monthShortTitle(month: number, lang: Lang): string {
  const name = monthName(month, lang);
  return name.slice(0, 3);
}

/** "18-noy" / "18 ноя" / "Nov 18" for a YYYY-MM-DD date. */
export function shortDate(date: string, lang: Lang): string {
  const m = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  if (!Number.isFinite(d) || m < 0 || m > 11) return date;
  const mon = SHORT_MONTHS[lang][m];
  if (lang === 'uz') return `${d}-${mon}`;
  if (lang === 'ru') return `${d} ${mon}`;
  return `${mon} ${d}`;
}

/** "31-dek 2026" / "31 дек 2026" / "Dec 31, 2026". */
export function shortDateWithYear(date: string, lang: Lang): string {
  const base = shortDate(date, lang);
  if (base === date) return date;
  return lang === 'en' ? `${base}, ${date.slice(0, 4)}` : `${base} ${date.slice(0, 4)}`;
}

/** "18 noyabr" / "18 ноября" / "November 18" for a day header. */
export function dayAndMonth(date: string, lang: Lang): string {
  const m = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  if (!Number.isFinite(d) || m < 0 || m > 11) return date;
  if (lang === 'ru') return `${d} ${MONTHS_GENITIVE_RU[m]}`;
  if (lang === 'en') return `${MONTHS.en[m]} ${d}`;
  return `${d} ${MONTHS.uz[m].toLowerCase()}`;
}

function shiftDate(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return date;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/** "Bugun", "Kecha" or a short date, relative to today (both YYYY-MM-DD, Tashkent). */
export function relativeDay(date: string, today: string, lang: Lang, withOtherYear = true): string {
  if (date === today) return TODAY[lang];
  if (date === shiftDate(today, -1)) return YESTERDAY[lang];
  if (withOtherYear && date.slice(0, 4) !== today.slice(0, 4)) return shortDateWithYear(date, lang);
  return shortDate(date, lang);
}

/** Currency word after an amount in the UI. */
export function somLabel(lang: Lang): string {
  return lang === 'ru' ? 'сум' : lang === 'en' ? 'UZS' : 'so‘m';
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Same rules as formatters/money.ts formatMoney, with the currency word in `lang`. */
export function formatMoneyIn(amount: number | string | null | undefined, currency: string = 'UZS', lang: Lang = 'uz'): string {
  const n = Number(amount) || 0;
  const cur = (currency || 'UZS').toUpperCase();
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (cur === 'UZS') return `${sign}${groupThousands(String(Math.round(abs)))} ${somLabel(lang)}`;
  const fixed = (Math.round(abs * 100) / 100).toFixed(2);
  const [i, d] = fixed.split('.');
  const num = sign + groupThousands(i) + (d === '00' ? '' : `.${d}`);
  if (cur === 'USD') return lang === 'uz' ? `${num} dollar` : `$${num}`;
  return `${num} ${cur}`;
}

/**
 * Display names of the built-in categories. Keys are the internal (Uzbek) category keys the
 * app stores and matches on; a user's own category names are shown as typed.
 */
const CATEGORY_NAMES: Record<string, { ru: string; en: string; uz?: string }> = {
  'Oziq-ovqat': { ru: 'Продукты', en: 'Groceries' },
  'Kafeler va Restoranlar': { ru: 'Кафе и рестораны', en: 'Cafes & restaurants' },
  Transport: { ru: 'Транспорт', en: 'Transport' },
  'Uy-joy': { ru: 'Жильё', en: 'Housing' },
  Uy: { ru: 'Жильё', en: 'Housing', uz: 'Uy-joy' },
  Kommunal: { ru: 'Коммунальные', en: 'Utilities' },
  'Aloqa va Internet': { ru: 'Связь и интернет', en: 'Phone & internet' },
  "Ko'ngilochar": { ru: 'Развлечения', en: 'Entertainment' },
  Xaridlar: { ru: 'Покупки', en: 'Shopping' },
  Salomatlik: { ru: 'Здоровье', en: 'Health' },
  "Ta'lim": { ru: 'Образование', en: 'Education' },
  'Shaxsiy parvarish': { ru: 'Уход и спорт', en: 'Personal care' },
  Maosh: { ru: 'Зарплата', en: 'Salary' },
  Frilans: { ru: 'Фриланс', en: 'Freelance' },
  Investitsiyalar: { ru: 'Инвестиции', en: 'Investments' },
  "Sovg'alar": { ru: 'Подарки', en: 'Gifts', uz: 'Sovg‘alar' },
  'Boshqa daromad': { ru: 'Другой доход', en: 'Other income' },
  Boshqa: { ru: 'Другое', en: 'Other' },
  Boshqalar: { ru: 'Остальное', en: 'Everything else' },
  Auto: { ru: 'Авто', en: 'Auto', uz: 'Avto' },
  Avto: { ru: 'Авто', en: 'Auto' },
};

const BY_NORMALIZED = new Map(
  Object.entries(CATEGORY_NAMES).map(([k, v]) => [normalizeCategoryName(k), { key: k, ...v }])
);

/** English system rows in the DB (migration 007) → internal key. */
const DB_NAME_TO_KEY = new Map<string, string>([
  ...UZ_SYSTEM_CATEGORIES.flatMap((c) => c.dbNames.map((d) => [normalizeCategoryName(d), c.uz] as [string, string])),
  [normalizeCategoryName('Miscellaneous'), 'Boshqa'],
  [normalizeCategoryName('Other Income'), 'Boshqa daromad'],
]);

/**
 * Category name to show: built-in categories (by internal key or English DB name) in `lang`;
 * anything else (the user's own categories) exactly as typed.
 */
export function categoryLabel(name: string | null | undefined, lang: Lang): string {
  if (!name) return '';
  const n = normalizeCategoryName(name);
  const hit = BY_NORMALIZED.get(n) ?? BY_NORMALIZED.get(normalizeCategoryName(DB_NAME_TO_KEY.get(n) ?? ''));
  if (!hit) return name;
  if (lang === 'uz') return hit.uz ?? hit.key;
  return hit[lang];
}
