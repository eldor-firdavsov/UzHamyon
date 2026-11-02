import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLeapYear,
  getDaysInCalendarMonth,
  parseLocalDate,
  getTransactionsInCalendarMonth,
  calculateChartData,
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

test('2. Month Boundary & No UTC Shift Test', () => {
  // Test local parsing of date boundary without timezone shifting
  const lastDaySep = parseLocalDate('2026-09-30');
  assert.equal(lastDaySep.year, 2026);
  assert.equal(lastDaySep.month, 9);
  assert.equal(lastDaySep.day, 30);

  const firstDayOct = parseLocalDate('2026-10-01');
  assert.equal(firstDayOct.year, 2026);
  assert.equal(firstDayOct.month, 10);
  assert.equal(firstDayOct.day, 1);

  const testTransactions = [
    {
      id: 'tx-sep-end',
      name: 'Sentabr oxirgi kuni xarid',
      category: 'Oziq-ovqat',
      categoryIcon: 'cart',
      date: '2026-09-30',
      amount: 150000,
      type: 'expense',
      account: 'Uzcard',
    },
    {
      id: 'tx-oct-start',
      name: 'Oktabr birinchi kuni daromad',
      category: 'Daromad',
      categoryIcon: 'wallet',
      date: '2026-10-01',
      amount: 5000000,
      type: 'income',
      account: 'Humo',
    },
    {
      id: 'tx-oct-end',
      name: 'Oktabr oxirgi kuni xarajat',
      category: 'Kafe',
      categoryIcon: 'coffee',
      date: '2026-10-31',
      amount: 80000,
      type: 'expense',
      account: 'Uzcard',
    },
    {
      id: 'tx-nov-start',
      name: 'Noyabr boshi tushum',
      category: 'Daromad',
      categoryIcon: 'wallet',
      date: '2026-11-01',
      amount: 1200000,
      type: 'income',
      account: 'Humo',
    },
  ];

  // Filtering for September 2026
  const sepTxs = getTransactionsInCalendarMonth(testTransactions, 2026, 9);
  assert.equal(sepTxs.length, 1, 'September should contain exactly 1 transaction');
  assert.equal(sepTxs[0].id, 'tx-sep-end');

  // Filtering for October 2026
  const octTxs = getTransactionsInCalendarMonth(testTransactions, 2026, 10);
  assert.equal(octTxs.length, 2, 'October should contain exactly 2 transactions');
  assert.equal(octTxs[0].id, 'tx-oct-start');
  assert.equal(octTxs[1].id, 'tx-oct-end');

  // Filtering for November 2026
  const novTxs = getTransactionsInCalendarMonth(testTransactions, 2026, 11);
  assert.equal(novTxs.length, 1, 'November should contain exactly 1 transaction');
  assert.equal(novTxs[0].id, 'tx-nov-start');
});

test('3. Dynamic Chart Calculations (Joriy oy, 3 oy, 6 oy, Yil)', () => {
  const transactions = [
    {
      id: 'tx-1',
      name: 'Oylik maosh',
      category: 'Daromad',
      categoryIcon: 'wallet',
      date: '2026-10-28',
      amount: 6000000,
      type: 'income',
      account: 'Humo',
    },
    {
      id: 'tx-2',
      name: 'Kechki ovqat',
      category: 'Kafe',
      categoryIcon: 'coffee',
      date: '2026-10-30',
      amount: 120000,
      type: 'expense',
      account: 'Uzcard',
    },
    {
      id: 'tx-3',
      name: 'Sentabr oylik',
      category: 'Daromad',
      categoryIcon: 'wallet',
      date: '2026-09-28',
      amount: 5500000,
      type: 'income',
      account: 'Humo',
    },
    {
      id: 'tx-4',
      name: 'Sentabr xarajat',
      category: 'Oziq-ovqat',
      categoryIcon: 'cart',
      date: '2026-09-15',
      amount: 2000000,
      type: 'expense',
      account: 'Uzcard',
    },
  ];

  // Test '1m' (Joriy oy - Oktabr 2026: 31 days)
  const currentMonthChart = calculateChartData(transactions, '1m', '2026-10-31', '2026-05-01');
  assert.equal(currentMonthChart.points.length, 5, 'October should have 5 calendar week intervals');
  assert.equal(currentMonthChart.points[4].label, '29-31 okt', 'Final interval must end on exact 31st day');
  assert.equal(currentMonthChart.totalIncome, 6000000, 'October total income must match October transactions only');
  assert.equal(currentMonthChart.totalExpense, 120000, 'October total expense must match October transactions only');

  // Test '3m' (Oxirgi 3 oy: Avgust, Sentabr, Oktabr)
  const threeMonthChart = calculateChartData(transactions, '3m', '2026-10-31', '2026-05-01');
  assert.equal(threeMonthChart.points.length, 3, 'Must contain exactly 3 calendar months');
  assert.equal(threeMonthChart.points[0].label, 'Avgust');
  assert.equal(threeMonthChart.points[1].label, 'Sentabr');
  assert.equal(threeMonthChart.points[2].label, 'Oktabr');
  assert.equal(threeMonthChart.points[1].income, 5500000, 'September income must match September transactions');
  assert.equal(threeMonthChart.points[1].expense, 2000000, 'September expense must match September transactions');
  assert.equal(threeMonthChart.points[2].income, 6000000, 'October income must match October transactions');
  assert.equal(threeMonthChart.points[2].expense, 120000, 'October expense must match October transactions');

  // Test '6m' (Oxirgi 6 oy: May, Iyun, Iyul, Avgust, Sentabr, Oktabr)
  const sixMonthChart = calculateChartData(transactions, '6m', '2026-10-31', '2026-05-01');
  assert.equal(sixMonthChart.points.length, 6, 'Must contain exactly 6 calendar months');
  assert.equal(sixMonthChart.points[0].label, 'May');
  assert.equal(sixMonthChart.points[5].label, 'Oktabr');

  // Test Financial Start Date constraint: months before 2026-05-01 must not be included
  const yearChart = calculateChartData(transactions, 'year', '2026-10-31', '2026-05-01');
  assert.equal(yearChart.points[0].label, 'May', 'Must respect financial start date May 2026');
});
