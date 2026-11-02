/**
 * UzHamyon Prototype — Calendar & Financial Date Calculations
 *
 * Implements strict calendar month lengths, leap year rules,
 * Tashkent local timezone handling, and transaction aggregation.
 */

export const UZBEK_MONTH_NAMES = [
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
] as const;

export const UZBEK_MONTH_SHORT = [
  'yan',
  'fev',
  'mar',
  'apr',
  'may',
  'iyn',
  'iyl',
  'avg',
  'sen',
  'okt',
  'noy',
  'dek',
] as const;

/**
 * Determines whether a year is a leap year according to the Gregorian calendar.
 * Leap years are divisible by 4, except for century years not divisible by 400.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the exact number of calendar days in a given year and month (1-indexed: 1 = Yanvar, 12 = Dekabr).
 */
export function getDaysInCalendarMonth(year: number, month1Indexed: number): number {
  if (month1Indexed < 1 || month1Indexed > 12) {
    throw new Error(`Invalid month index: ${month1Indexed}. Must be 1 to 12.`);
  }

  // 30 days: Aprel (4), Iyun (6), Sentabr (9), Noyabr (11)
  if (month1Indexed === 4 || month1Indexed === 6 || month1Indexed === 9 || month1Indexed === 11) {
    return 30;
  }

  // Fevral (2): 29 in leap year, 28 otherwise
  if (month1Indexed === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  // All other months: 31 days (Yanvar, Mart, May, Iyul, Avgust, Oktabr, Dekabr)
  return 31;
}

export interface ParsedDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  isoString: string;
}

/**
 * Parses a date string (YYYY-MM-DD) safely without UTC shift into previous/next day.
 */
export function parseLocalDate(dateStr: string): ParsedDate {
  // Extract YYYY-MM-DD components directly
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    // Fallback: try parsing Date object components
    const d = new Date(dateStr);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      isoString: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  return {
    year,
    month,
    day,
    isoString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

/**
 * Formats a date into human-readable Uzbek format (e.g., '28-oktabr, 2026').
 */
export function formatUzbekCalendarDate(dateStr: string): string {
  const { year, month, day } = parseLocalDate(dateStr);
  const monthName = UZBEK_MONTH_NAMES[month - 1].toLowerCase();
  return `${day}-${monthName}, ${year}`;
}

export interface CalendarMonthSummary {
  year: number;
  month: number; // 1-12
  monthLabel: string; // e.g. "Oktabr 2026"
  shortLabel: string; // e.g. "Okt"
  totalDays: number;
  income: number;
  expense: number;
  netFlow: number;
}

export interface ChartIntervalPoint {
  label: string;
  subLabel?: string;
  startDate: string;
  endDate: string;
  income: number;
  expense: number;
}

export type ChartPeriod = '1m' | '3m' | '6m' | 'year';

export interface BaseTransaction {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'income' | 'expense';
  account: string;
}

/**
 * Filters transactions that strictly fall within a given calendar month [year, month].
 * Does NOT include transactions from adjacent months!
 */
export function getTransactionsInCalendarMonth<T extends BaseTransaction>(
  transactions: T[],
  year: number,
  month: number
): T[] {
  return transactions.filter((tx) => {
    const p = parseLocalDate(tx.date);
    return p.year === year && p.month === month;
  });
}

/**
 * Calculates calendar-accurate chart data for the selected period:
 * - '1m' (Joriy oy): Breaks down the current month into real calendar weekly periods based on actual calendar days (1-7, 8-14, 15-21, 22-28, 29-end of month).
 * - '3m': Exactly 3 consecutive calendar months up to reference month.
 * - '6m': Exactly 6 consecutive calendar months up to reference month.
 * - 'year': Calendar months of the reference year starting from financialStartDate.
 */
export function calculateChartData<T extends BaseTransaction>(
  transactions: T[],
  period: ChartPeriod,
  referenceDateStr: string = '2026-10-31',
  financialStartDateStr: string = '2026-05-01'
): {
  periodLabel: string;
  points: ChartIntervalPoint[];
  totalIncome: number;
  totalExpense: number;
} {
  const ref = parseLocalDate(referenceDateStr);
  const finStart = parseLocalDate(financialStartDateStr);

  if (period === '1m') {
    // Current calendar month breakdown
    const daysInMonth = getDaysInCalendarMonth(ref.year, ref.month);
    const monthShort = UZBEK_MONTH_SHORT[ref.month - 1];

    // Real calendar week intervals: 1-7, 8-14, 15-21, 22-28, 29-daysInMonth
    const intervals: { startDay: number; endDay: number }[] = [
      { startDay: 1, endDay: 7 },
      { startDay: 8, endDay: 14 },
      { startDay: 15, endDay: 21 },
      { startDay: 22, endDay: 28 },
      { startDay: 29, endDay: daysInMonth },
    ];

    let totalIncome = 0;
    let totalExpense = 0;

    const points: ChartIntervalPoint[] = intervals.map((inv) => {
      const startDate = `${ref.year}-${String(ref.month).padStart(2, '0')}-${String(inv.startDay).padStart(2, '0')}`;
      const endDate = `${ref.year}-${String(ref.month).padStart(2, '0')}-${String(inv.endDay).padStart(2, '0')}`;

      let income = 0;
      let expense = 0;

      transactions.forEach((tx) => {
        const p = parseLocalDate(tx.date);
        if (p.year === ref.year && p.month === ref.month && p.day >= inv.startDay && p.day <= inv.endDay) {
          if (tx.type === 'income') income += tx.amount;
          if (tx.type === 'expense') expense += tx.amount;
        }
      });

      totalIncome += income;
      totalExpense += expense;

      return {
        label: `${inv.startDay}-${inv.endDay} ${monthShort}`,
        subLabel: `${inv.startDay} - ${inv.endDay} ${UZBEK_MONTH_NAMES[ref.month - 1]}`,
        startDate,
        endDate,
        income,
        expense,
      };
    });

    return {
      periodLabel: `${UZBEK_MONTH_NAMES[ref.month - 1]} ${ref.year}`,
      points,
      totalIncome,
      totalExpense,
    };
  }

  // Multi-month periods (3m, 6m, year)
  let monthsCount = 3;
  if (period === '6m') monthsCount = 6;
  if (period === 'year') {
    // Months in reference year from finStart to ref.month
    monthsCount = Math.max(1, ref.month - (ref.year === finStart.year ? finStart.month : 1) + 1);
  }

  const monthsList: { year: number; month: number }[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    let m = ref.month - i;
    let y = ref.year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    // Respect financial start date
    if (y < finStart.year || (y === finStart.year && m < finStart.month)) {
      continue;
    }
    monthsList.push({ year: y, month: m });
  }

  let totalIncome = 0;
  let totalExpense = 0;

  const points: ChartIntervalPoint[] = monthsList.map(({ year, month }) => {
    const daysCount = getDaysInCalendarMonth(year, month);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}`;

    const monthTxs = getTransactionsInCalendarMonth(transactions, year, month);
    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    totalIncome += income;
    totalExpense += expense;

    return {
      label: UZBEK_MONTH_NAMES[month - 1],
      subLabel: `${UZBEK_MONTH_NAMES[month - 1]} ${year} (${daysCount} kun)`,
      startDate,
      endDate,
      income,
      expense,
    };
  });

  const periodLabel =
    period === '3m'
      ? 'Oxirgi 3 oy'
      : period === '6m'
      ? 'Oxirgi 6 oy'
      : `${ref.year}-yil hisoboti`;

  return {
    periodLabel,
    points,
    totalIncome,
    totalExpense,
  };
}
