import { SupabaseClient } from '@supabase/supabase-js';

export interface EligibleMonthItem {
  key: string; // 'YYYY-MM'
  year: number;
  month: number; // 1-12
  labelUz: string; // e.g. 'Sentabr 2026'
  shortLabelUz: string; // e.g. 'Sen 2026'
  startDate: string; // 'YYYY-MM-01'
  endDate: string; // 'YYYY-MM-DD'
  transactionCount: number;
}

export interface FinancialTimelineSummary {
  financialStartDate: string | null;
  availableMonths: EligibleMonthItem[];
  availableMonthKeys: string[];
  latestMonthKey: string | null;
  oldestMonthKey: string | null;
  hasData: boolean;
  totalTransactions: number;
}

export const MONTH_NAMES_UZ_FULL = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

export const MONTH_NAMES_UZ_SHORT = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyun',
  'Iyul',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

export function getMonthDateRange(year: number, monthIndex0: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(monthIndex0 + 1)}-01`;
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const endDate = `${year}-${pad(monthIndex0 + 1)}-${pad(lastDay)}`;
  return { startDate, endDate };
}

/**
 * Returns user-specific eligible financial months based ONLY on actual recorded transactions.
 * Strict rules:
 * - Only calendar months with >= 1 actual qualifying financial transaction appear.
 * - Both income and expense transactions are counted.
 * - Excludes deleted or invalid transactions (amount <= 0, invalid types).
 * - Never generates empty months between transactions.
 * - Sorts months newest first (descending).
 * - Returns an empty timeline (hasData = false, availableMonths = []) for users with 0 transactions.
 */
export async function getUserFinancialTimeline(
  userId: string,
  supabase: SupabaseClient
): Promise<FinancialTimelineSummary> {
  // 1. Fetch valid financial transactions for this user
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('transaction_date, amount, type')
    .eq('user_id', userId)
    .gt('amount', 0)
    .in('type', ['income', 'expense'])
    .order('transaction_date', { ascending: false });

  if (error || !txs || txs.length === 0) {
    return {
      financialStartDate: null,
      availableMonths: [],
      availableMonthKeys: [],
      latestMonthKey: null,
      oldestMonthKey: null,
      hasData: false,
      totalTransactions: 0,
    };
  }

  // 2. Count transactions per distinct calendar month (YYYY-MM)
  const monthCountMap = new Map<string, number>();
  for (const t of txs) {
    if (!t.transaction_date || typeof t.transaction_date !== 'string') continue;
    const match = t.transaction_date.match(/^(\d{4})-(\d{2})/);
    if (!match) continue;
    const mKey = `${match[1]}-${match[2]}`;
    monthCountMap.set(mKey, (monthCountMap.get(mKey) || 0) + 1);
  }

  // Sort months newest first (e.g. ['2026-11', '2026-09'])
  const sortedKeys = Array.from(monthCountMap.keys()).sort().reverse();

  if (sortedKeys.length === 0) {
    return {
      financialStartDate: null,
      availableMonths: [],
      availableMonthKeys: [],
      latestMonthKey: null,
      oldestMonthKey: null,
      hasData: false,
      totalTransactions: 0,
    };
  }

  const availableMonths: EligibleMonthItem[] = sortedKeys.map((key) => {
    const [yStr, mStr] = key.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const monthIdx0 = month - 1;
    const { startDate, endDate } = getMonthDateRange(year, monthIdx0);

    return {
      key,
      year,
      month,
      labelUz: `${MONTH_NAMES_UZ_FULL[monthIdx0]} ${year}`,
      shortLabelUz: `${MONTH_NAMES_UZ_SHORT[monthIdx0]} ${year}`,
      startDate,
      endDate,
      transactionCount: monthCountMap.get(key) || 0,
    };
  });

  const oldestMonth = availableMonths[availableMonths.length - 1];

  return {
    financialStartDate: oldestMonth ? oldestMonth.startDate : null,
    availableMonths,
    availableMonthKeys: sortedKeys,
    latestMonthKey: sortedKeys[0] || null,
    oldestMonthKey: sortedKeys[sortedKeys.length - 1] || null,
    hasData: availableMonths.length > 0,
    totalTransactions: txs.length,
  };
}
