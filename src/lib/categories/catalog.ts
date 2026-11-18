/**
 * UzHamyon category catalog — the ONE mapping between the Uzbek category names the
 * UI shows and the database category rows.
 *
 * System categories are stored in English (migration 007, plus `Internet & Phone`
 * from migration 012). Users can also own categories with any name.
 *
 * Rules:
 * - The AI may only pick a name from `buildCategoryOptions()` for the right type.
 * - An unknown name resolves to NO category (the UI shows "Boshqa" / "Boshqa daromad").
 *   There is never a "first category" fallback and no fuzzy substring matching.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type CategoryType = 'income' | 'expense';

export interface UzSystemCategory {
  uz: string;
  type: CategoryType;
  /** English system category names in the DB (first one is canonical). */
  dbNames: string[];
}

/** Uzbek display name → English system category rows. */
export const UZ_SYSTEM_CATEGORIES: UzSystemCategory[] = [
  { uz: 'Oziq-ovqat', type: 'expense', dbNames: ['Groceries'] },
  { uz: 'Kafeler va Restoranlar', type: 'expense', dbNames: ['Dining Out'] },
  { uz: 'Transport', type: 'expense', dbNames: ['Transportation'] },
  { uz: 'Uy-joy', type: 'expense', dbNames: ['Housing / Rent'] },
  { uz: 'Kommunal', type: 'expense', dbNames: ['Utilities'] },
  { uz: 'Aloqa va Internet', type: 'expense', dbNames: ['Internet & Phone'] },
  { uz: "Ko'ngilochar", type: 'expense', dbNames: ['Entertainment'] },
  { uz: 'Xaridlar', type: 'expense', dbNames: ['Shopping'] },
  { uz: 'Salomatlik', type: 'expense', dbNames: ['Healthcare'] },
  { uz: "Ta'lim", type: 'expense', dbNames: ['Education'] },
  { uz: 'Shaxsiy parvarish', type: 'expense', dbNames: ['Personal Care'] },
  { uz: 'Maosh', type: 'income', dbNames: ['Salary'] },
  { uz: 'Frilans', type: 'income', dbNames: ['Freelance / Consulting'] },
  { uz: 'Investitsiyalar', type: 'income', dbNames: ['Investments'] },
  { uz: "Sovg'alar", type: 'income', dbNames: ['Gifts & Grants'] },
];

export interface DbCategoryRow {
  id: string;
  name: string;
  type: string;
  is_system?: boolean | null;
  user_id?: string | null;
}

export interface CategoryOption {
  /** Name shown to the user and offered to the AI. */
  displayName: string;
  type: CategoryType;
  categoryId: string;
  /** The row's real name in the database. */
  dbName: string;
  isSystem: boolean;
}

/** Lower-case, trimmed, with all apostrophe variants unified. */
export function normalizeCategoryName(name: string): string {
  return name
    .normalize('NFC')
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findUzForDbName(dbName: string, type: CategoryType): UzSystemCategory | undefined {
  const n = normalizeCategoryName(dbName);
  return UZ_SYSTEM_CATEGORIES.find(
    (c) => c.type === type && c.dbNames.some((d) => normalizeCategoryName(d) === n)
  );
}

/**
 * Builds the category list for one user: system rows under their Uzbek names, plus the
 * user's own categories under their own names. A user's own category wins over a system
 * row with the same display name.
 */
export function buildCategoryOptions(rows: DbCategoryRow[]): CategoryOption[] {
  const byKey = new Map<string, CategoryOption>();

  for (const row of rows) {
    if (row.type !== 'income' && row.type !== 'expense') continue;
    const type = row.type as CategoryType;
    const isSystem = Boolean(row.is_system) || !row.user_id;

    let displayName: string;
    if (isSystem) {
      const uz = findUzForDbName(row.name, type);
      if (!uz) continue; // e.g. "Miscellaneous" / "Other Income" → shown as Boshqa, not offered
      displayName = uz.uz;
    } else {
      displayName = row.name.trim();
    }

    const key = `${type}:${normalizeCategoryName(displayName)}`;
    const existing = byKey.get(key);
    if (existing && !existing.isSystem) continue; // keep the user's own row
    if (existing && existing.isSystem && isSystem) continue; // first system row wins
    byKey.set(key, { displayName, type, categoryId: row.id, dbName: row.name, isSystem });
  }

  return Array.from(byKey.values());
}

/** Default Uzbek names per type (used when the user's rows are not available). */
export function defaultCategoryNames(type: CategoryType): string[] {
  return UZ_SYSTEM_CATEGORIES.filter((c) => c.type === type).map((c) => c.uz);
}

/** Display names per type, for the AI prompt. */
export function categoryNamesByType(options: CategoryOption[]): { expense: string[]; income: string[] } {
  return {
    expense: options.filter((o) => o.type === 'expense').map((o) => o.displayName),
    income: options.filter((o) => o.type === 'income').map((o) => o.displayName),
  };
}

/** Exact (normalized) match of a display name within one type. Unknown → undefined. */
export function resolveCategoryOption(
  name: string | null | undefined,
  type: CategoryType,
  options: CategoryOption[]
): CategoryOption | undefined {
  if (!name) return undefined;
  const n = normalizeCategoryName(name);
  return options.find((o) => o.type === type && normalizeCategoryName(o.displayName) === n);
}

/** Returns the name from `allowed` that matches `name` exactly (normalized), else undefined. */
export function pickAllowedName(name: unknown, allowed: string[]): string | undefined {
  if (typeof name !== 'string' || !name.trim()) return undefined;
  const n = normalizeCategoryName(name);
  return allowed.find((a) => normalizeCategoryName(a) === n);
}

/** Loads system + own categories visible to this user (RLS) and builds the options. */
export async function loadCategoryOptions(client: SupabaseClient): Promise<CategoryOption[]> {
  try {
    const { data, error } = await client
      .from('categories')
      .select('id, name, type, is_system, user_id');
    if (error || !data) {
      if (error) console.warn('[categories] Failed to load categories:', error.message);
      return [];
    }
    return buildCategoryOptions(data as DbCategoryRow[]);
  } catch (err) {
    console.warn('[categories] Failed to load categories:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Maps a UI/AI category name to a DB category row of the right type:
 * 1. exact (normalized) DB name, 2. Uzbek name → its English system row.
 * Unknown → undefined (no category). Never guesses.
 */
export function matchCategoryRow<T extends { id: string; name: string; type?: string }>(
  name: string | null | undefined,
  rows: T[],
  type?: CategoryType
): T | undefined {
  if (!name || !rows.length) return undefined;
  const n = normalizeCategoryName(name);
  const typed = type ? rows.filter((r) => !r.type || r.type === type) : rows;

  const direct = typed.find((r) => normalizeCategoryName(r.name) === n);
  if (direct) return direct;

  const uz = UZ_SYSTEM_CATEGORIES.find(
    (c) => (!type || c.type === type) && normalizeCategoryName(c.uz) === n
  );
  if (uz) {
    for (const dbName of uz.dbNames) {
      const found = typed.find((r) => normalizeCategoryName(r.name) === normalizeCategoryName(dbName));
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Resolves each create_transaction action's AI category name to the user's real category:
 * sets `categoryId`, keeps the Uzbek name in `categoryDisplayName`, and stores the DB row
 * name in `categoryName` (so an older RPC doing an exact name match also finds it).
 * Unknown names are removed → the transaction is saved without a category.
 */
export function attachCategoryIds<
  T extends {
    actionType: string;
    transactionType?: string;
    categoryName?: string;
    categoryId?: string;
    categoryDisplayName?: string;
  }
>(actions: T[], options: CategoryOption[]): T[] {
  return actions.map((action) => {
    if (action.actionType !== 'create_transaction') return action;
    const type: CategoryType = action.transactionType === 'income' ? 'income' : 'expense';
    const option = resolveCategoryOption(action.categoryName, type, options);
    if (!option) {
      return { ...action, categoryName: undefined, categoryId: undefined, categoryDisplayName: undefined };
    }
    return {
      ...action,
      categoryName: option.dbName,
      categoryId: option.categoryId,
      categoryDisplayName: option.displayName,
    };
  });
}
