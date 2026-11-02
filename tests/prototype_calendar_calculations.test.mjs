import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLeapYear,
  getDaysInCalendarMonth,
  parseLocalDate,
  getTransactionsInCalendarMonth,
  calculateChartData,
  getAvailableMonths,
  canNavigatePrevious,
  canNavigateNext,
  getPreviousMonth,
  getNextMonth,
  UZBEK_MONTH_NAMES,
} from '../src/prototype/dateUtils.ts';

test('1. Calendar Month Day Lengths & Leap Year Validation', () => {
  // January: 31 days
  assert.equal(getDaysInCalendarMonth(2026, 1), 31, 'January must have 31 days');

  // February non-leap years: 28 days
  assert.equal(isLeapYear(2025), false, '2025 is not a leap year');
  assert.equal(isLeapYear(2026), false, '2026 is not a leap year');
  assert.equal(getDaysInCalendarMonth(2026, 2), 28, 'February 2026 must have 28 days');

  // February leap years: 29 days
  assert.equal(isLeapYear(2024), true, '2024 is a leap year');
  assert.equal(isLeapYear(2028), true, '2028 is a leap year');
  assert.equal(isLeapYear(2000), true, '2000 is a leap year (divisible by 400)');
  assert.equal(isLeapYear(1900), false, '1900 is not a leap year (divisible by 100 but not 400)');
  assert.equal(getDaysInCalendarMonth(2024, 2), 29, 'February 2024 must have 29 days');
  assert.equal(getDaysInCalendarMonth(2028, 2), 29, 'February 2028 must have 29 days');

  // March: 31 days
  assert.equal(getDaysInCalendarMonth(2026, 3), 31, 'March must have 31 days');

  // April, June, September, November: 30 days
  assert.equal(getDaysInCalendarMonth(2026, 4), 30, 'April must have 30 days');
  assert.equal(getDaysInCalendarMonth(2026, 6), 30, 'June must have 30 days');
  assert.equal(getDaysInCalendarMonth(2026, 9), 30, 'September must have 30 days');
  assert.equal(getDaysInCalendarMonth(2026, 11), 30, 'November must have 30 days');

  // May, July, August, October, December: 31 days
  assert.equal(getDaysInCalendarMonth(2026, 5), 31, 'May must have 31 days');
  assert.equal(getDaysInCalendarMonth(2026, 7), 31, 'July must have 31 days');
  assert.equal(getDaysInCalendarMonth(2026, 8), 31, 'August must have 31 days');
  assert.equal(getDaysInCalendarMonth(2026, 10), 31, 'October must have 31 days');
  assert.equal(getDaysInCalendarMonth(2026, 12), 31, 'December must have 31 days');
});

test('2. Month Navigation Transitions (Jan->Feb, Dec->Jan, Leap Year, Boundaries)', () => {
  const finStart = '2026-05-01';
  const maxDate = '2026-10-31';

  // Available months must strictly start from financial start date (May 2026) to maxDate (October 2026)
  const available = getAvailableMonths(finStart, maxDate);
  assert.equal(available.length, 6, 'Must have exactly 6 available months (May to October 2026)');
  assert.equal(available[0].isoMonth, '2026-05');
  assert.equal(available[5].isoMonth, '2026-10');

  // Boundary checks: May 2026 cannot navigate back
  assert.equal(canNavigatePrevious(2026, 5, finStart), false, 'May 2026 cannot navigate to April');
  assert.equal(getPreviousMonth(2026, 5, finStart), null, 'getPreviousMonth at boundary returns null');

  // October 2026 cannot navigate forward
  assert.equal(canNavigateNext(2026, 10, maxDate), false, 'October 2026 cannot navigate to November');
  assert.equal(getNextMonth(2026, 10, maxDate), null, 'getNextMonth at max boundary returns null');

  // Navigation between August and September
  assert.equal(canNavigateNext(2026, 8, maxDate), true);
  const nextFromAug = getNextMonth(2026, 8, maxDate);
  assert.deepEqual(nextFromAug, { year: 2026, month: 9 });

  const prevFromSep = getPreviousMonth(2026, 9, finStart);
  assert.deepEqual(prevFromSep, { year: 2026, month: 8 });

  // Year transition: December to January next year
  const nextFromDec = getNextMonth(2025, 12, '2026-12-31');
  assert.deepEqual(nextFromDec, { year: 2026, month: 1 }, 'December to January rollover');

  const prevFromJan = getPreviousMonth(2026, 1, '2024-01-01');
  assert.deepEqual(prevFromJan, { year: 2025, month: 12 }, 'January to December previous year rollover');
});

test('3. Month Boundaries, Empty Months & Transaction Filtering', () => {
  const transactions = [
    {
      id: 'tx-may-salary',
      name: 'May oylik',
      category: 'Daromad',
      categoryIcon: 'wallet',
      date: '2026-05-28',
      amount: 5500000,
      type: 'income',
      account: 'Asosiy',
    },
    {
      id: 'tx-sep-30',
      name: 'Sentabr oxirgi kuni',
      category: 'Kafe',
      categoryIcon: 'coffee',
      date: '2026-09-30',
      amount: 150000,
      type: 'expense',
      account: 'Uzcard',
    },
    {
      id: 'tx-oct-01',
      name: 'Oktabr birinchi kuni',
      category: 'Daromad',
      categoryIcon: 'wallet',
      date: '2026-10-01',
      amount: 6000000,
      type: 'income',
      account: 'Humo',
    },
  ];

  // Month with both income and expenses
  const sepTxs = getTransactionsInCalendarMonth(transactions, 2026, 9);
  assert.equal(sepTxs.length, 1);
  assert.equal(sepTxs[0].id, 'tx-sep-30');

  // Month with income only
  const octTxs = getTransactionsInCalendarMonth(transactions, 2026, 10);
  assert.equal(octTxs.length, 1);
  assert.equal(octTxs[0].id, 'tx-oct-01');

  // Month with NO transactions (e.g. August 2026 for this test array)
  const augTxs = getTransactionsInCalendarMonth(transactions, 2026, 8);
  assert.equal(augTxs.length, 0, 'August must return empty array when no transactions exist');

  // Empty month chart calculation
  const augChart = calculateChartData(transactions, '1m', '2026-08-31', '2026-05-01');
  assert.equal(augChart.totalIncome, 0, 'Empty month income must be 0');
  assert.equal(augChart.totalExpense, 0, 'Empty month expense must be 0');
});
