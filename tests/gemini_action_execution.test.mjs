import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { readEnv } from './helpers/env.mjs';
import { extractFinancialActions, sanitizeUserInputForAi } from '../src/lib/ai/actionExtractionEngine.ts';
import {
  savePendingAction,
  getPendingAction,
  claimPendingAction,
  cancelPendingAction,
  getLatestActivePendingAction,
  isUserConfirmation,
  isUserCancellation,
} from '../src/lib/ai/pendingActionStore.ts';
import { executePendingActionRecord } from '../src/lib/ai/actionExecutor.ts';
import { getConfiguredGeminiModel, getConfiguredGeminiFallbackModel } from '../src/lib/ai/geminiClient.ts';

const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

describe('Gemini API Integration & Safe AI Financial Action Execution', () => {
  let adminClient;
  let testUserClient;
  let testUserClientB;
  let testUserId;
  let testUserIdB;

  const emailA = `gemini_action_test_a_${Date.now()}@telegram.uzhamyon.uz`;
  const emailB = `gemini_action_test_b_${Date.now()}@telegram.uzhamyon.uz`;
  const password = `TestPass_${Date.now()}!`;

  before(async () => {
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Setup User A
    testUserClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signA, error: errA } = await testUserClient.auth.signUp({
      email: emailA,
      password,
      options: { data: { first_name: 'Anvar' } },
    });
    assert.strictEqual(errA, null);
    testUserId = signA.user.id;
    await adminClient.auth.admin.updateUserById(testUserId, { email_confirm: true });
    await testUserClient.auth.signInWithPassword({ email: emailA, password });
    await adminClient.from('profiles').upsert({
      id: testUserId,
      email: emailA,
      first_name: 'Anvar',
      role: 'teacher',
      onboarding_completed: true,
    });

    // 2. Setup User B for cross-user isolation checks
    testUserClientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signB, error: errB } = await testUserClientB.auth.signUp({
      email: emailB,
      password,
      options: { data: { first_name: 'Malika' } },
    });
    assert.strictEqual(errB, null);
    testUserIdB = signB.user.id;
    await adminClient.auth.admin.updateUserById(testUserIdB, { email_confirm: true });
    await testUserClientB.auth.signInWithPassword({ email: emailB, password });
    await adminClient.from('profiles').upsert({
      id: testUserIdB,
      email: emailB,
      first_name: 'Malika',
      role: 'teacher',
      onboarding_completed: true,
    });
  });

  after(async () => {
    if (testUserId) {
      await adminClient.from('transactions').delete().eq('user_id', testUserId);
      await adminClient.from('financial_goals').delete().eq('user_id', testUserId);
      await adminClient.from('profiles').delete().eq('id', testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
    if (testUserIdB) {
      await adminClient.from('transactions').delete().eq('user_id', testUserIdB);
      await adminClient.from('financial_goals').delete().eq('user_id', testUserIdB);
      await adminClient.from('profiles').delete().eq('id', testUserIdB);
      await adminClient.auth.admin.deleteUser(testUserIdB);
    }
  });

  test('1. Configuration & Security: Gemini model is configured and API key is protected', () => {
    const model = getConfiguredGeminiModel();
    assert.ok(model === 'gemini-2.5-flash' || typeof model === 'string', 'Configured model must exist');
    assert.ok(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY must be configured in environment');
    assert.strictEqual(process.env.NEXT_PUBLIC_GEMINI_API_KEY, undefined, 'GEMINI_API_KEY must NEVER be in NEXT_PUBLIC');
  });

  test('2. Single Uzbek Expense Extraction: parses amount, type, description', async () => {
    const res = await extractFinancialActions('Bugun tushlikka 45000 so‘m ishlatdim');
    assert.strictEqual(res.intent, 'action_proposal');
    assert.ok(res.actions.length >= 1);
    const act = res.actions[0];
    assert.strictEqual(act.actionType, 'create_transaction');
    assert.strictEqual(act.transactionType, 'expense');
    assert.strictEqual(act.amount, 45000);
    assert.ok(res.summaryUzbek.includes('45 000') || res.summaryUzbek.includes('45000'));
  });

  test('3. Single Uzbek Income Extraction: parses salary and sets income type', async () => {
    const res = await extractFinancialActions('Oylik maoshim 5 000 000 som tushdi');
    assert.strictEqual(res.intent, 'action_proposal');
    assert.ok(res.actions.length >= 1);
    const act = res.actions[0];
    assert.strictEqual(act.actionType, 'create_transaction');
    assert.strictEqual(act.transactionType, 'income');
    assert.strictEqual(act.amount, 5000000);
  });

  test('4. Multiple Transactions in One Message: parses both into distinct action items', async () => {
    const res = await extractFinancialActions('Kechqurun bozorlikka 120 000 som va taksiga 25 000 som ishlatdim');
    assert.strictEqual(res.intent, 'action_proposal');
    assert.strictEqual(res.actions.length, 2, 'Must extract exactly 2 separate transactions');

    const amounts = res.actions.map((a) => a.amount).sort((a, b) => a - b);
    assert.deepStrictEqual(amounts, [25000, 120000]);
    assert.ok(res.summaryUzbek.includes('2 ta') || res.summaryUzbek.includes('operatsiya') || res.summaryUzbek.includes('xarajat'));
  });

  test('5. Ambiguous Input without Amount: prompts for clarification instead of guessing', async () => {
    const res = await extractFinancialActions('Tushlik qildim');
    assert.ok(res.intent === 'clarification' || res.actions.length === 0);
    assert.strictEqual(res.actions.length, 0, 'Must NOT invent or guess missing financial amounts');
  });

  test('6. Goal Creation Extraction: identifies goal name and target amount', async () => {
    const res = await extractFinancialActions('Yangi maqsad: Yangi noutbuk uchun 12 mln so‘m yig‘moqchiman');
    assert.strictEqual(res.intent, 'action_proposal');
    assert.ok(res.actions.length >= 1);
    const act = res.actions[0];
    assert.strictEqual(act.actionType, 'create_goal');
    assert.strictEqual(act.targetAmount, 12000000);
    assert.ok(act.goalName?.toLowerCase().includes('noutbuk'));
  });

  test('7. Savings Contribution Extraction: identifies goal contribution', async () => {
    const res = await extractFinancialActions('Noutbuk maqsadiga 500 000 som jamg‘ardim');
    assert.strictEqual(res.intent, 'action_proposal');
    assert.ok(res.actions.length >= 1);
    const act = res.actions[0];
    assert.strictEqual(act.actionType, 'contribute_goal');
    assert.strictEqual(act.amount, 500000);
  });

  test('8. Safe Confirmation Flow: Pending action requires explicit confirmation before database write', async () => {
    // 1. Propose action and store safely in PendingActionStore
    const saveRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'create_transaction',
          transactionType: 'expense',
          amount: 60000,
          currency: 'UZS',
          description: 'Avtomobil yuvish',
          date: '2026-11-05',
        },
      ],
      'Avtomobil yuvish uchun 60 000 so‘m xarajatni tasdiqlaysizmi?'
    );

    assert.ok(saveRes.record, 'savePendingAction must return a record');
    const pending = saveRes.record;
    assert.strictEqual(pending.status, 'pending');

    // Verify nothing is in DB yet
    const { data: beforeTx } = await testUserClient
      .from('transactions')
      .select('id')
      .eq('description', 'Avtomobil yuvish');
    assert.strictEqual((beforeTx || []).length, 0, 'No transaction should be created while pending');

    // 2. User confirms -> Execute
    const execRes = await executePendingActionRecord(pending, testUserClient);
    assert.strictEqual(execRes.success, true);
    assert.ok(execRes.message.includes('Muvaffaqiyatli'));

    // Verify transaction now exists in database
    const { data: afterTx } = await testUserClient
      .from('transactions')
      .select('id, amount, description')
      .eq('description', 'Avtomobil yuvish');
    assert.strictEqual(afterTx?.length, 1);
    assert.strictEqual(Number(afterTx[0].amount), 60000);
  });

  test('9. Duplicate Callback Idempotency: Multiple clicks/callbacks on same action are rejected', async () => {
    const saveRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'create_transaction',
          transactionType: 'expense',
          amount: 30000,
          currency: 'UZS',
          description: 'Qahva va shirinlik',
          date: '2026-11-05',
        },
      ],
      'Qahva va shirinlik 30 000 so‘m tasdiqlaysizmi?'
    );

    assert.ok(saveRes.record);
    const pending = saveRes.record;

    // First execution succeeds
    const firstExec = await executePendingActionRecord(pending, testUserClient);
    assert.strictEqual(firstExec.success, true);

    // Immediate second execution must be rejected idempotently
    const secondExec = await executePendingActionRecord(pending, testUserClient);
    assert.strictEqual(secondExec.success, false);
    assert.ok(
      secondExec.message.includes('allaqachon bajarilgan') ||
      secondExec.message.includes('imkonsiz')
    );

    // Verify database has only 1 transaction, not 2
    const { data: txs } = await testUserClient
      .from('transactions')
      .select('id')
      .eq('description', 'Qahva va shirinlik');
    assert.strictEqual(txs?.length, 1, 'Idempotency must prevent duplicate transaction creation');
  });

  test('10. Cancellation Flow: User cancellation prevents database insertion', async () => {
    const saveRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'create_transaction',
          transactionType: 'expense',
          amount: 88000,
          currency: 'UZS',
          description: 'Bekor qilinadigan buyurtma',
          date: '2026-11-05',
        },
      ],
      'Tasdiqlaysizmi?'
    );

    assert.ok(saveRes.record);
    const pending = saveRes.record;

    const cancelRes = await cancelPendingAction(pending.actionId, testUserId);
    assert.strictEqual(cancelRes.success, true);

    // Attempt to execute cancelled action must fail
    const execRes = await executePendingActionRecord(pending, testUserClient);
    assert.strictEqual(execRes.success, false);
    assert.ok(execRes.message.includes('bekor qilingan') || execRes.message.includes('imkonsiz'));

    const { data: txs } = await testUserClient
      .from('transactions')
      .select('id')
      .eq('description', 'Bekor qilinadigan buyurtma');
    assert.strictEqual((txs || []).length, 0);
  });

  test('11. Cross-User Data Isolation: User B cannot access or confirm User A pending action', async () => {
    const saveRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'create_transaction',
          transactionType: 'income',
          amount: 2000000,
          currency: 'UZS',
          description: 'User A maxfiy daromadi',
          date: '2026-11-05',
        },
      ],
      'User A tasdiqlashi kerak'
    );

    assert.ok(saveRes.record);
    const pendingA = saveRes.record;

    // User B tries to get User A's pending action
    const lookupB = await getPendingAction(pendingA.actionId, testUserIdB);
    assert.strictEqual(lookupB.error, 'unauthorized');

    // User B tries to claim User A's pending action
    const claimB = await claimPendingAction(pendingA.actionId, testUserIdB);
    assert.strictEqual(claimB.success, false);
    assert.strictEqual(claimB.reason, 'Ruxsat berilmagan');

    // User B tries to execute User A's action using User B's client
    const foreignExec = await executePendingActionRecord(pendingA, testUserClientB);
    assert.strictEqual(foreignExec.success, false);

    // Verify User A's transaction was NOT created
    const { data: txs } = await adminClient
      .from('transactions')
      .select('id')
      .eq('description', 'User A maxfiy daromadi');
    assert.strictEqual((txs || []).length, 0);
  });

  test('12. Goal Creation & Contribution End-to-End Execution via AI Engine', async () => {
    // 1. Create a goal via pending action
    const saveGoalRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'create_goal',
          goalName: 'Umra safari',
          targetAmount: 25000000,
          currency: 'UZS',
          description: 'Umra safari maqsadi',
          date: '2026-11-05',
        },
      ],
      'Umra safari uchun 25 000 000 so‘m maqsad yaratilsinmi?'
    );

    assert.ok(saveGoalRes.record);
    const goalPending = saveGoalRes.record;

    const goalExec = await executePendingActionRecord(goalPending, testUserClient);
    assert.strictEqual(goalExec.success, true);
    assert.ok(goalExec.message.includes('Umra safari'));

    // Verify goal exists in Supabase
    const { data: goals } = await testUserClient
      .from('financial_goals')
      .select('id, name, target_amount, current_amount')
      .eq('name', 'Umra safari');
    assert.strictEqual(goals?.length, 1);
    assert.strictEqual(Number(goals[0].target_amount), 25000000);
    assert.strictEqual(Number(goals[0].current_amount), 0);

    // 2. Add savings contribution via pending action
    const saveContribRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'contribute_goal',
          goalName: 'Umra safari',
          amount: 2500000,
          currency: 'UZS',
          description: 'Umra safari hissa',
          date: '2026-11-05',
        },
      ],
      'Umra safari maqsadiga 2 500 000 so‘m qo‘shilsinmi?'
    );

    assert.ok(saveContribRes.record);
    const contribPending = saveContribRes.record;

    const contribExec = await executePendingActionRecord(contribPending, testUserClient);
    assert.strictEqual(contribExec.success, true);
    assert.ok(contribExec.message.includes('2 500 000') || contribExec.message.includes('qo‘shildi'));

    // Verify updated goal amount in Supabase
    const { data: updatedGoals } = await testUserClient
      .from('financial_goals')
      .select('id, current_amount')
      .eq('name', 'Umra safari');
    assert.strictEqual(Number(updatedGoals[0].current_amount), 2500000);
  });

  test('13. Natural Language Intent Helpers: matches confirmation and cancellation variations', () => {
    assert.strictEqual(isUserConfirmation('Ha'), true);
    assert.strictEqual(isUserConfirmation('tasdiqlayman'), true);
    assert.strictEqual(isUserConfirmation('Ha, tasdiqlayman'), true);
    assert.strictEqual(isUserConfirmation('saqla'), true);
    assert.strictEqual(isUserConfirmation('albatta'), true);

    assert.strictEqual(isUserCancellation('Yo‘q'), true);
    assert.strictEqual(isUserCancellation('bekor qil'), true);
    assert.strictEqual(isUserCancellation('Bekor qilish'), true);
    assert.strictEqual(isUserCancellation('rad etaman'), true);
    assert.strictEqual(isUserCancellation('kerak emas'), true);

    // Random message should not be classified as confirmation or cancellation
    assert.strictEqual(isUserConfirmation('Bugun tushlikka chiqdim'), false);
    assert.strictEqual(isUserCancellation('Bugun tushlikka chiqdim'), false);
  });

  test('14. PII Protection: Sensitive data is stripped before external AI prompt', () => {
    const inputWithPii = 'Mening kartam 8600 1234 5678 9012 va telefonim +998901234567, token Bearer secret_token_xyz. Tushlikka 35000 so‘m ishlatdim.';
    const sanitized = sanitizeUserInputForAi(inputWithPii);

    assert.ok(!sanitized.includes('8600 1234 5678 9012'), '16-digit card number must be removed');
    assert.ok(!sanitized.includes('+998901234567'), 'Phone number must be removed');
    assert.ok(!sanitized.includes('secret_token_xyz'), 'Bearer token must be removed');
    assert.ok(sanitized.includes('[KARTA]'), 'Must replace card with token');
    assert.ok(sanitized.includes('[TELEFON]'), 'Must replace phone with token');
    assert.ok(sanitized.includes('35000'), 'Financial transaction details must be preserved');
  });

  test('15. Model Hierarchy Configuration: Default gemini-3.8-flash and fallback gemini-3.7-flash', () => {
    const primary = getConfiguredGeminiModel();
    const fallback = getConfiguredGeminiFallbackModel();

    assert.strictEqual(primary, 'gemini-3.8-flash', 'Default model must be gemini-3.8-flash');
    assert.strictEqual(fallback, 'gemini-3.7-flash', 'Default fallback must be gemini-3.7-flash');
  });

  test('16. Dual-Identity Binding: Telegram User ID mismatch is strictly rejected', async () => {
    const saveRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'create_transaction',
          transactionType: 'expense',
          amount: 15000,
          currency: 'UZS',
          description: 'Dual identity test',
          date: '2026-11-05',
        },
      ],
      'Tasdiqlaysizmi?',
      { telegramUserId: 111111111, telegramChatId: 999999 }
    );

    assert.ok(saveRes.record);
    const actionId = saveRes.record.actionId;

    // Caller with wrong Telegram User ID must be unauthorized
    const wrongTgLookup = await getPendingAction(actionId, testUserId, 222222222);
    assert.strictEqual(wrongTgLookup.error, 'unauthorized');

    const wrongTgClaim = await claimPendingAction(actionId, testUserId, 222222222);
    assert.strictEqual(wrongTgClaim.success, false);
    assert.strictEqual(wrongTgClaim.reason, 'Ruxsat berilmagan: Telegram shaxsiyati mos kelmadi');

    // Caller with correct Telegram User ID succeeds
    const correctTgLookup = await getPendingAction(actionId, testUserId, 111111111);
    assert.ok(correctTgLookup.record);
    assert.strictEqual(correctTgLookup.record.actionId, actionId);
  });

  test('17. Batch Transaction Atomicity: Rollback prevents partial financial writes on failure', async () => {
    const saveRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'create_transaction',
          transactionType: 'expense',
          amount: 25000,
          currency: 'UZS',
          description: 'Atomar test - muvaffaqiyatli qism',
          date: '2026-11-05',
        },
        {
          actionType: 'update_goal',
          goalName: 'MUTLAQO_MAVJUD_BO_LMAGAN_MAQSAD_XYZ_9999',
          amount: 500000,
          currency: 'UZS',
          description: 'Atomar test - xatoli qism',
          date: '2026-11-05',
        },
      ],
      'Atomar amallar'
    );

    assert.ok(saveRes.record);
    const pending = saveRes.record;

    const execRes = await executePendingActionRecord(pending, testUserClient);
    assert.strictEqual(execRes.success, false, 'Batch with an invalid item must fail completely');

    // Verify first transaction was rolled back and does NOT exist in the database
    const { data: txs } = await testUserClient
      .from('transactions')
      .select('id')
      .eq('description', 'Atomar test - muvaffaqiyatli qism');
    assert.strictEqual((txs || []).length, 0, 'Rolled back transaction must not remain in database (No partial writes)');
  });

  test('18. Missing Migration Safety: Fails safely in production when table is absent', async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const prodRes = await savePendingAction(
        testUserId,
        [
          {
            actionType: 'create_transaction',
            transactionType: 'expense',
            amount: 10000,
            currency: 'UZS',
            description: 'Prod missing migration test',
            date: '2026-11-05',
          },
        ],
        'Tasdiqlaysizmi?'
      );

      // In production mode without the migration applied, it must fail safely without memory fallback
      assert.strictEqual(prodRes.record, undefined, 'Must not store in memory in production mode');
      assert.strictEqual(prodRes.migrationMissing, true);
      assert.ok(prodRes.error?.includes('pending_ai_actions jadvali mavjud emas'));
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  test('19. Lock Expiration Recovery: Stale lock allows safe re-claim and execution', async () => {
    const saveRes = await savePendingAction(
      testUserId,
      [
        {
          actionType: 'create_transaction',
          transactionType: 'expense',
          amount: 5000,
          currency: 'UZS',
          description: 'Lock recovery test',
          date: '2026-11-05',
        },
      ],
      'Tasdiqlaysizmi?'
    );

    assert.ok(saveRes.record);
    const pending = saveRes.record;

    // Simulate action claimed by a crashed process whose lock has expired
    pending.status = 'executing';
    pending.lockedUntil = Date.now() - 5000; // Expired 5 seconds ago

    // Executing the stale locked action must safely recover the lock and succeed
    const execRes = await executePendingActionRecord(pending, testUserClient);
    assert.strictEqual(execRes.success, true);
    assert.ok(execRes.message.includes('Muvaffaqiyatli'));

    // Verify transaction exists in database
    const { data: txs } = await testUserClient
      .from('transactions')
      .select('id')
      .eq('description', 'Lock recovery test');
    assert.strictEqual(txs?.length, 1);
  });
});

