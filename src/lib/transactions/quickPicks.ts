/**
 * "Most used" and "recent" transactions for one-tap entry (Payme-style favourites).
 * Pure function over the transactions the app already loaded; no extra request.
 */
import { addDaysToDate } from '../time/tashkent.ts';

export interface QuickPickSource {
  type: 'in' | 'ex';
  amount: number;
  cat: string;
  desc: string;
  date: string;
  time?: string;
}

export interface QuickPick {
  key: string;
  type: 'in' | 'ex';
  desc: string;
  cat: string;
  /** 0 = no usual amount (a starter suggestion): the user types it. */
  amount: number;
  count: number;
}

export interface QuickPicks {
  favorites: QuickPick[];
  recents: QuickPick[];
}

const WINDOW_DAYS = 60;
const FAVORITES = 4;
const RECENTS = 3;

/**
 * Starter tiles for people with little history; amount stays empty.
 * cat 'Auto' = the category is predicted from the title on save.
 */
const STARTERS: Record<'in' | 'ex', Array<{ desc: string; cat: string }>> = {
  ex: [
    { desc: 'Tushlik', cat: 'Auto' },
    { desc: 'Taksi', cat: 'Auto' },
    { desc: 'Kofe', cat: 'Auto' },
    { desc: 'Bozorlik', cat: 'Auto' },
  ],
  in: [
    { desc: 'Maosh', cat: 'Auto' },
    { desc: 'Frilans', cat: 'Auto' },
  ],
};

function normalizeDesc(desc: string): string {
  return desc.trim().replace(/\s+/g, ' ');
}

function keyOf(type: 'in' | 'ex', desc: string): string {
  return `${type}|${normalizeDesc(desc).toLocaleLowerCase('uz')}`;
}

function sortNewestFirst(a: QuickPickSource, b: QuickPickSource): number {
  const ka = `${a.date} ${a.time || ''}`;
  const kb = `${b.date} ${b.time || ''}`;
  return ka < kb ? 1 : ka > kb ? -1 : 0;
}

/** Most frequent amount; ties go to the most recent one (amounts are newest-first). */
function usualAmount(amountsNewestFirst: number[]): number {
  const counts = new Map<number, number>();
  for (const a of amountsNewestFirst) counts.set(a, (counts.get(a) || 0) + 1);
  let best = amountsNewestFirst[0] || 0;
  let bestCount = 0;
  for (const a of amountsNewestFirst) {
    const c = counts.get(a) || 0;
    if (c > bestCount) {
      best = a;
      bestCount = c;
    }
  }
  return best;
}

export function computeQuickPicks(
  transactions: QuickPickSource[],
  type: 'in' | 'ex',
  today: string
): QuickPicks {
  const since = addDaysToDate(today, -WINDOW_DAYS);
  const rows = transactions
    .filter(
      (t) =>
        t.type === type &&
        t.amount > 0 &&
        normalizeDesc(t.desc || '') !== '' &&
        t.date >= since &&
        t.date <= today
    )
    .sort(sortNewestFirst);

  const groups = new Map<string, { first: QuickPickSource; amounts: number[] }>();
  for (const t of rows) {
    const k = keyOf(type, t.desc);
    const g = groups.get(k);
    if (g) g.amounts.push(t.amount);
    else groups.set(k, { first: t, amounts: [t.amount] });
  }

  const ranked = [...groups.entries()]
    .filter(([, g]) => g.amounts.length >= 2)
    .sort((a, b) => b[1].amounts.length - a[1].amounts.length || sortNewestFirst(a[1].first, b[1].first))
    .slice(0, FAVORITES);

  const favorites: QuickPick[] = ranked.map(([key, g]) => ({
    key,
    type,
    desc: normalizeDesc(g.first.desc),
    cat: g.first.cat,
    amount: usualAmount(g.amounts),
    count: g.amounts.length,
  }));

  const used = new Set(favorites.map((f) => f.key));
  for (const s of STARTERS[type]) {
    if (favorites.length >= FAVORITES) break;
    const key = keyOf(type, s.desc);
    if (used.has(key)) continue;
    used.add(key);
    // A starter the user already logged once takes their real last amount and category.
    const seen = groups.get(key);
    favorites.push(
      seen
        ? { key, type, desc: normalizeDesc(seen.first.desc), cat: seen.first.cat, amount: seen.first.amount, count: seen.amounts.length }
        : { key, type, desc: s.desc, cat: s.cat, amount: 0, count: 0 }
    );
  }

  const recents: QuickPick[] = [];
  for (const t of rows) {
    if (recents.length >= RECENTS) break;
    const key = keyOf(type, t.desc);
    if (used.has(key)) continue;
    used.add(key);
    recents.push({ key, type, desc: normalizeDesc(t.desc), cat: t.cat, amount: t.amount, count: 1 });
  }

  return { favorites, recents };
}

/** 18 000 → "18k", 1 500 000 → "1.5 mln". */
export function shortAmount(n: number): string {
  if (!n || n <= 0) return '';
  if (n >= 1_000_000) {
    const v = Math.round(n / 100_000) / 10;
    return `${String(v).replace(/\.0$/, '')} mln`;
  }
  if (n >= 1_000) {
    const v = Math.round(n / 100) / 10;
    return `${String(v).replace(/\.0$/, '')}k`;
  }
  return String(Math.round(n));
}
