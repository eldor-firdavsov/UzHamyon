import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserFinancialTimeline,
  getMonthDateRange,
  MONTH_NAMES_UZ_FULL,
} from '../src/lib/timeline/financialTimeline.ts';
import { getTransactionAvailableMonths } from '../src/prototype/dateUtils.ts';

// Mock Supabase factory that simulates database table queries
function createMockSupabase(transactionsTable = []) {
  return {
    from(table) {
      if (table !== 'transactions') {
        throw new Error(`Unexpected table: ${table}`);
      }

      let filtered = [...transactionsTable];

      const queryBuilder = {
        select(cols) {
          return queryBuilder;
        },
        eq(col, val) {
          filtered = filtered.filter((row) => row[col] === val);
          return queryBuilder;
        },
        gt(col, val) {
          filtered = filtered.filter((row) => row[col] > val);
          return queryBuilder;
        },
        in(col, vals) {
          filtered = filtered.filter((row) => vals.includes(row[col]));
          return queryBuilder;
        },
        order(col, { ascending }) {
          filtered.sort((a, b) => {
            if (a[col] < b[col]) return ascending ? -1 : 1;
            if (a[col] > b[col]) return ascending ? 1 : -1;
            return 0;
          });
          return queryBuilder;
        },
        // Supabase builders are thenable; awaiting the chain resolves the rows.
        then(resolve, reject) {
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
        },
      };

      return queryBuilder;
    },
  };
}

describe('UzHamyon Month Selector — Only Months With Actual Transactions', () => {
  // Scenario 1: New user with zero transactions: no months displayed
  test('Scenario 1: New user with zero transactions has empty availableMonths and hasData=false', async () => {
    const mockDb = createMockSupabase([]);
    const timeline = await getUserFinancialTimeline('user_new_001', mockDb);

    assert.equal(timeline.hasData, false, 'hasData must be false for new user');
    assert.equal(timeline.availableMonths.length, 0, 'availableMonths must be empty array');
    assert.deepEqual(timeline.availableMonthKeys, [], 'availableMonthKeys must be empty');
    assert.equal(timeline.latestMonthKey, null, 'latestMonthKey must be null');
    assert.equal(timeline.oldestMonthKey, null, 'oldestMonthKey must be null');
    assert.equal(timeline.totalTransactions, 0, 'totalTransactions must be 0');

    // Frontend helper also returns empty array
    const feMonths = getTransactionAvailableMonths([]);
    assert.equal(feMonths.length, 0, 'Frontend getTransactionAvailableMonths must return empty array');
  });

  // Scenario 2: User with transactions only in November: only November displayed
  test('Scenario 2: User with transactions only in November displays only November (Sep/Oct excluded)', async () => {
    const txs = [
      { id: '1', user_id: 'user_nov', amount: 50000, type: 'expense', transaction_date: '2026-11-02' },
      { id: '2', user_id: 'user_nov', amount: 1200000, type: 'income', transaction_date: '2026-11-05' },
      { id: '3', user_id: 'user_nov', amount: 35000, type: 'expense', transaction_date: '2026-11-10' },
    ];
    const mockDb = createMockSupabase(txs);
    const timeline = await getUserFinancialTimeline('user_nov', mockDb);

    assert.equal(timeline.hasData, true);
    assert.equal(timeline.availableMonths.length, 1, 'Only November should be present');
    assert.equal(timeline.availableMonths[0].key, '2026-11');
    assert.equal(timeline.availableMonths[0].labelUz, 'Noyabr 2026');
    assert.equal(timeline.availableMonths[0].transactionCount, 3);
    assert.equal(timeline.latestMonthKey, '2026-11');

    // Verify September and October are NOT present
    assert.ok(!timeline.availableMonthKeys.includes('2026-09'), 'September must NOT be present');
    assert.ok(!timeline.availableMonthKeys.includes('2026-10'), 'October must NOT be present');

    // Frontend helper check
    const feMonths = getTransactionAvailableMonths(txs);
    assert.equal(feMonths.length, 1);
    assert.equal(feMonths[0].isoMonth, '2026-11');
  });

  // Scenario 3: User with transactions in September and November: September and November displayed, October excluded
  test('Scenario 3: User with transactions in September and November: October is strictly excluded', async () => {
    const txs = [
      { id: '1', user_id: 'user_sep_nov', amount: 200000, type: 'expense', transaction_date: '2026-09-15' },
      { id: '2', user_id: 'user_sep_nov', amount: 150000, type: 'income', transaction_date: '2026-09-20' },
      // Zero transactions in October 2026
      { id: '3', user_id: 'user_sep_nov', amount: 80000, type: 'expense', transaction_date: '2026-11-01' },
    ];
    const mockDb = createMockSupabase(txs);
    const timeline = await getUserFinancialTimeline('user_sep_nov', mockDb);

    assert.equal(timeline.availableMonths.length, 2, 'Must have exactly 2 months');
    assert.equal(timeline.availableMonths[0].key, '2026-11', 'Newest month first');
    assert.equal(timeline.availableMonths[1].key, '2026-09', 'Oldest month second');
    assert.deepEqual(timeline.availableMonthKeys, ['2026-11', '2026-09']);
    assert.ok(!timeline.availableMonthKeys.includes('2026-10'), 'October must NOT be inserted');

    // Frontend helper check
    const feMonths = getTransactionAvailableMonths(txs);
    assert.equal(feMonths.length, 2);
    assert.equal(feMonths[0].isoMonth, '2026-11');
    assert.equal(feMonths[1].isoMonth, '2026-09');
  });

  // Scenario 4: User deletes the last transaction in a month: that month disappears
  test('Scenario 4: User deletes the last transaction in a month: that month disappears from selector', async () => {
    let txs = [
      { id: '1', user_id: 'user_del', amount: 100000, type: 'expense', transaction_date: '2026-10-15' },
      { id: '2', user_id: 'user_del', amount: 50000, type: 'expense', transaction_date: '2026-11-02' },
    ];

    // Initial: both Oct and Nov present
    let mockDb = createMockSupabase(txs);
    let timeline = await getUserFinancialTimeline('user_del', mockDb);
    assert.equal(timeline.availableMonths.length, 2);
    assert.deepEqual(timeline.availableMonthKeys, ['2026-11', '2026-10']);

    // Delete tx #1 (the only transaction in October)
    txs = txs.filter((t) => t.id !== '1');
    mockDb = createMockSupabase(txs);
    timeline = await getUserFinancialTimeline('user_del', mockDb);

    assert.equal(timeline.availableMonths.length, 1);
    assert.equal(timeline.availableMonths[0].key, '2026-11');
    assert.ok(!timeline.availableMonthKeys.includes('2026-10'), 'October must disappear immediately');
  });

  // Scenario 5: User adds a transaction to a previously empty month: that month appears
  test('Scenario 5: User adds a transaction to a previously empty month: that month appears in selector', async () => {
    let txs = [
      { id: '1', user_id: 'user_add', amount: 50000, type: 'expense', transaction_date: '2026-11-02' },
    ];
    let mockDb = createMockSupabase(txs);
    let timeline = await getUserFinancialTimeline('user_add', mockDb);
    assert.deepEqual(timeline.availableMonthKeys, ['2026-11']);

    // Add transaction in December 2026
    txs.push({
      id: '2',
      user_id: 'user_add',
      amount: 150000,
      type: 'income',
      transaction_date: '2026-12-05',
    });
    mockDb = createMockSupabase(txs);
    timeline = await getUserFinancialTimeline('user_add', mockDb);

    assert.equal(timeline.availableMonths.length, 2);
    assert.equal(timeline.availableMonths[0].key, '2026-12', 'Newer month December must be first');
    assert.equal(timeline.availableMonths[1].key, '2026-11', 'November must be second');
  });

  // Scenario 6: User edits a transaction date into another month: month list updates correctly
  test('Scenario 6: User edits transaction date into another month: month list updates correctly', async () => {
    let txs = [
      { id: '1', user_id: 'user_edit', amount: 50000, type: 'expense', transaction_date: '2026-11-02' },
    ];
    let mockDb = createMockSupabase(txs);
    let timeline = await getUserFinancialTimeline('user_edit', mockDb);
    assert.deepEqual(timeline.availableMonthKeys, ['2026-11']);

    // Edit transaction date from November to December
    txs[0].transaction_date = '2026-12-01';
    mockDb = createMockSupabase(txs);
    timeline = await getUserFinancialTimeline('user_edit', mockDb);

    assert.equal(timeline.availableMonths.length, 1);
    assert.equal(timeline.availableMonths[0].key, '2026-12');
    assert.ok(!timeline.availableMonthKeys.includes('2026-11'), 'November has 0 transactions and must disappear');
  });

  // Scenario 7: Different users see only months based on their own transactions
  test('Scenario 7: User isolation - User A transactions never show up in User B timeline', async () => {
    const allTxs = [
      { id: '1', user_id: 'user_A', amount: 50000, type: 'expense', transaction_date: '2026-09-10' },
      { id: '2', user_id: 'user_A', amount: 90000, type: 'expense', transaction_date: '2026-10-10' },
      { id: '3', user_id: 'user_B', amount: 70000, type: 'income', transaction_date: '2026-11-05' },
    ];
    const mockDb = createMockSupabase(allTxs);

    const timelineA = await getUserFinancialTimeline('user_A', mockDb);
    const timelineB = await getUserFinancialTimeline('user_B', mockDb);

    assert.deepEqual(timelineA.availableMonthKeys, ['2026-10', '2026-09']);
    assert.ok(!timelineA.availableMonthKeys.includes('2026-11'));

    assert.deepEqual(timelineB.availableMonthKeys, ['2026-11']);
    assert.ok(!timelineB.availableMonthKeys.includes('2026-09'));
    assert.ok(!timelineB.availableMonthKeys.includes('2026-10'));
  });

  // Scenario 8: December to January transition & Leap year accuracy
  test('Scenario 8: December to January transition & Leap year calendar range accuracy', () => {
    // 1. December to January
    const decRange = getMonthDateRange(2026, 11); // December (monthIndex0 = 11)
    assert.equal(decRange.startDate, '2026-12-01');
    assert.equal(decRange.endDate, '2026-12-31');

    const janRange = getMonthDateRange(2027, 0); // January (monthIndex0 = 0)
    assert.equal(janRange.startDate, '2027-01-01');
    assert.equal(janRange.endDate, '2027-01-31');

    // 2. Leap year: 2024 is a leap year (February has 29 days)
    const febLeapRange = getMonthDateRange(2024, 1); // February 2024
    assert.equal(febLeapRange.startDate, '2024-02-01');
    assert.equal(febLeapRange.endDate, '2024-02-29');

    // 3. Non-leap year: 2025 (February has 28 days)
    const febNonLeapRange = getMonthDateRange(2025, 1); // February 2025
    assert.equal(febNonLeapRange.startDate, '2025-02-01');
    assert.equal(febNonLeapRange.endDate, '2025-02-28');
  });

  // Scenario 9: Non-qualifying records (goals, budgets, amount <= 0, deleted txs) excluded
  test('Scenario 9: Only valid income and expense transactions count (zero amount or invalid types excluded)', async () => {
    const mixedTxs = [
      { id: '1', user_id: 'user_filter', amount: 0, type: 'expense', transaction_date: '2026-08-10' }, // amount 0 -> excluded
      { id: '2', user_id: 'user_filter', amount: -500, type: 'expense', transaction_date: '2026-08-12' }, // negative -> excluded
      { id: '3', user_id: 'user_filter', amount: 1000, type: 'transfer', transaction_date: '2026-07-01' }, // not income/expense -> excluded
      { id: '4', user_id: 'user_filter', amount: 45000, type: 'income', transaction_date: '2026-11-03' }, // valid
    ];
    const mockDb = createMockSupabase(mixedTxs);
    const timeline = await getUserFinancialTimeline('user_filter', mockDb);

    assert.equal(timeline.availableMonths.length, 1);
    assert.equal(timeline.availableMonths[0].key, '2026-11');
    assert.ok(!timeline.availableMonthKeys.includes('2026-08'), 'August must be excluded due to zero/negative amount');
    assert.ok(!timeline.availableMonthKeys.includes('2026-07'), 'July must be excluded due to invalid type');
  });
});
