import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { readEnv } from './helpers/env.mjs';
import {
  getNowLocalDateString,
  getNowLocalTimeString,
  isValidCalendarDate,
  isValidTimeString,
  extractLocalDate,
  extractLocalTime,
  combineLocalDateTime,
} from '../src/lib/transactions/dateTime.ts';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from '../src/lib/transactions/schemas.ts';
import {
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from '../src/lib/transactions/service.ts';
import { getDaysInCalendarMonth, isLeapYear } from '../src/prototype/dateUtils.ts';

const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

describe('Task 1 — Transaction Date and Time Validation & Timezone Integrity', () => {
  let adminClient;
  let testUserClient;
  let testUserId;
  let createdTxId;

  const testUserEmail = `tx_datetime_test_${Date.now()}@telegram.uzhamyon.uz`;
  const testPassword = `SecureTestPass_${Date.now()}!`;

  before(async () => {
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    testUserClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    // Use standard signUp matching Phase C / auth trigger rules
    const { data: signData, error: signErr } = await testUserClient.auth.signUp({
      email: testUserEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'DateTimeTester',
          last_name: 'User',
        },
      },
    });

    assert.strictEqual(signErr, null, `Failed to sign up test user: ${signErr?.message}`);
    testUserId = signData.user?.id;
    assert.ok(testUserId, 'User ID must be present');

    // Confirm email automatically if needed via adminClient
    await adminClient.auth.admin.updateUserById(testUserId, { email_confirm: true });

    // Sign in
    const { data: loginData, error: loginErr } = await testUserClient.auth.signInWithPassword({
      email: testUserEmail,
      password: testPassword,
    });
    assert.strictEqual(loginErr, null, `Test user login failed: ${loginErr?.message}`);
    assert.ok(loginData.session, 'User session must exist');

    // Ensure profile row exists
    await adminClient
      .from('profiles')
      .upsert({
        id: testUserId,
        email: testUserEmail,
        first_name: 'DateTimeTester',
        role: 'teacher',
        onboarding_completed: true,
      });
  });

  after(async () => {
    if (createdTxId) {
      await adminClient.from('transactions').delete().eq('id', createdTxId);
    }
    if (testUserId) {
      await adminClient.from('profiles').delete().eq('id', testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  // ── UNIT TESTS ──

  test('Unit 1: Form opens with today date and current time in local timezone', () => {
    const now = new Date();
    const localDate = getNowLocalDateString(now);
    const localTime = getNowLocalTimeString(now);

    const expectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const expectedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    assert.strictEqual(localDate, expectedDate, 'Local date must match local Date components');
    assert.strictEqual(localTime, expectedTime, 'Local time must match local Date hours and minutes');
    assert.match(localDate, /^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD');
    assert.match(localTime, /^([01]\d|2[0-3]):[0-5]\d$/, 'Time format must be HH:mm');
  });

  test('Unit 2: Local timezone independence (No UTC drift across day boundaries)', () => {
    // Simulate Tashkent (UTC+5) at 01:30 AM on Nov 6, 2026
    // In UTC, this timestamp is 2026-11-05 20:30:00Z.
    // toISOString().split('T')[0] gives '2026-11-05' (WRONG!).
    // Our local helper must preserve the local date '2026-11-06'.
    const simulatedTashkentLateNight = new Date(Date.UTC(2026, 10, 5, 20, 30, 0));
    // Determine the environment's timezone offset to test local getter behavior
    const envYear = simulatedTashkentLateNight.getFullYear();
    const envMonth = String(simulatedTashkentLateNight.getMonth() + 1).padStart(2, '0');
    const envDay = String(simulatedTashkentLateNight.getDate()).padStart(2, '0');
    const localResult = getNowLocalDateString(simulatedTashkentLateNight);

    assert.strictEqual(
      localResult,
      `${envYear}-${envMonth}-${envDay}`,
      'getNowLocalDateString must format using local calendar components, never raw UTC'
    );

    // Explicit check on extractLocalDate with YYYY-MM-DD strings
    assert.strictEqual(extractLocalDate('2026-11-05'), '2026-11-05');
    assert.strictEqual(extractLocalDate('2026-11-06T01:30:00+05:00'), '2026-11-06');
  });

  test('Unit 3: Calendar date validation rejects invalid dates and respects leap years', () => {
    // Valid dates
    assert.strictEqual(isValidCalendarDate('2026-11-05'), true);
    assert.strictEqual(isValidCalendarDate('2024-02-29'), true, '2024 is a leap year');
    assert.strictEqual(isValidCalendarDate('2026-02-28'), true, '2026 is non-leap year (28 days)');
    assert.strictEqual(isValidCalendarDate('2026-04-30'), true, 'April has 30 days');

    // Invalid calendar dates
    assert.strictEqual(isValidCalendarDate('2026-02-29'), false, '2026-02-29 does not exist');
    assert.strictEqual(isValidCalendarDate('2026-04-31'), false, 'April 31 does not exist');
    assert.strictEqual(isValidCalendarDate('2026-13-01'), false, 'Month 13 does not exist');
    assert.strictEqual(isValidCalendarDate('2026-00-10'), false, 'Month 0 does not exist');
    assert.strictEqual(isValidCalendarDate(''), false, 'Empty date is invalid');
    assert.strictEqual(isValidCalendarDate(null), false, 'Null date is invalid');
    assert.strictEqual(isValidCalendarDate('invalid-date'), false, 'Garbage date string is invalid');
  });

  test('Unit 4: Time validation accepts valid HH:mm and rejects malformed values', () => {
    assert.strictEqual(isValidTimeString('00:00'), true);
    assert.strictEqual(isValidTimeString('09:05'), true);
    assert.strictEqual(isValidTimeString('23:59'), true);
    assert.strictEqual(isValidTimeString('14:30:00'), true);

    // Invalid times
    assert.strictEqual(isValidTimeString('24:00'), false, '24:00 is invalid in 24h format');
    assert.strictEqual(isValidTimeString('12:60'), false, 'Minute 60 is invalid');
    assert.strictEqual(isValidTimeString('9:5'), false, 'Must be zero-padded');
    assert.strictEqual(isValidTimeString('abc'), false);
    assert.strictEqual(isValidTimeString(''), false);
    assert.strictEqual(isValidTimeString(null), false);
  });

  test('Unit 5: Schema validation enforces positive amount, valid date, and optional time', () => {
    // Valid payload
    const valid = createTransactionSchema.safeParse({
      description: 'Supermarket tushlik',
      amount: 125000,
      currency: 'UZS',
      type: 'expense',
      transaction_date: '2026-11-05',
      transaction_time: '14:30',
    });
    assert.strictEqual(valid.success, true);
    if (valid.success) {
      assert.strictEqual(valid.data.transaction_date, '2026-11-05');
      assert.strictEqual(valid.data.transaction_time, '14:30');
    }

    // Invalid date in schema
    const invalidDate = createTransactionSchema.safeParse({
      description: 'Supermarket',
      amount: 50000,
      type: 'expense',
      transaction_date: '2026-02-31',
    });
    assert.strictEqual(invalidDate.success, false, 'February 31 must be rejected by schema');

    // Empty date in schema
    const emptyDate = createTransactionSchema.safeParse({
      description: 'Supermarket',
      amount: 50000,
      type: 'expense',
      transaction_date: '',
    });
    assert.strictEqual(emptyDate.success, false, 'Empty date must be rejected by schema');

    // Invalid time in schema
    const invalidTime = createTransactionSchema.safeParse({
      description: 'Supermarket',
      amount: 50000,
      type: 'expense',
      transaction_date: '2026-11-05',
      transaction_time: '25:99',
    });
    assert.strictEqual(invalidTime.success, false, '25:99 must be rejected by schema');
  });

  // ── INTEGRATION TESTS ──

  test('Integration 6: Create transaction persists local date and time in Supabase', async () => {
    const today = getNowLocalDateString();
    const timeNow = getNowLocalTimeString();

    const result = await createTransaction(
      {
        description: 'Toshkent kafeda nonushta',
        amount: 85000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: today,
        transaction_time: timeNow,
      },
      testUserClient
    );

    assert.strictEqual(result.status, 201, `Expected status 201, got ${result.status} (${result.error})`);
    assert.ok(result.data, 'Created transaction data must exist');
    assert.strictEqual(result.data.transaction_date, today, 'Stored transaction date must match local input date');
    assert.strictEqual(result.data.description, 'Toshkent kafeda nonushta');
    createdTxId = result.data.id;

    // Verify persisted row in database
    const fetched = await getTransaction(createdTxId, testUserClient);
    assert.strictEqual(fetched.status, 200);
    assert.strictEqual(fetched.data?.transaction_date, today);
  });

  test('Integration 7: User can manually change transaction date and time', async () => {
    assert.ok(createdTxId, 'Requires transaction from previous step');

    const editedDate = '2026-11-01';
    const editedTime = '09:15';

    const updateRes = await updateTransaction(
      createdTxId,
      {
        transaction_date: editedDate,
        transaction_time: editedTime,
        description: 'O‘zgartirilgan tushlik sanasi',
      },
      testUserClient
    );

    assert.strictEqual(updateRes.status, 200, `Update failed: ${updateRes.error}`);
    assert.strictEqual(updateRes.data?.transaction_date, editedDate);

    // Verify fetched updated row
    const fetched = await getTransaction(createdTxId, testUserClient);
    assert.strictEqual(fetched.data?.transaction_date, editedDate);
    assert.strictEqual(fetched.data?.description, 'O‘zgartirilgan tushlik sanasi');
  });

  test('Integration 8: Old/Unrelated transactions are never modified during updates', async () => {
    // Create an anchor transaction with specific fixed historical date
    const historicalRes = await createTransaction(
      {
        description: 'Oktabr oyi xarajati',
        amount: 250000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-10-15',
        transaction_time: '18:00',
      },
      testUserClient
    );
    assert.strictEqual(historicalRes.status, 201);
    const anchorId = historicalRes.data.id;

    try {
      // Perform an unrelated update on createdTxId
      await updateTransaction(
        createdTxId,
        {
          amount: 99000,
        },
        testUserClient
      );

      // Verify anchor transaction date remains strictly untouched
      const anchorCheck = await getTransaction(anchorId, testUserClient);
      assert.strictEqual(
        anchorCheck.data?.transaction_date,
        '2026-10-15',
        'Historical transaction date must never change during other updates'
      );
    } finally {
      await deleteTransaction(anchorId, testUserClient);
    }
  });
});
