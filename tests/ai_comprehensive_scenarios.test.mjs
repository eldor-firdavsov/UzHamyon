import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { readEnv } from './helpers/env.mjs';
import { askFinancialAdvisor } from '../src/lib/ai/advisorService.ts';
import { generateAIContent } from '../src/lib/ai/aiClient.ts';
import { createTransaction } from '../src/lib/transactions/service.ts';
import { createCategory } from '../src/lib/categories/service.ts';

const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

describe('Task 5 — AI System Verification & Comprehensive Real Scenarios', () => {
  let adminClient;
  let clientUserWithData;
  let clientUserEmpty;
  let userIdWithData;
  let userIdEmpty;
  let categoryId;
  let convIdUserWithData;

  const emailWithData = `ai_scenario_active_${Date.now()}@telegram.uzhamyon.uz`;
  const emailEmpty = `ai_scenario_empty_${Date.now()}@telegram.uzhamyon.uz`;
  const password = `SecurePass_${Date.now()}!`;

  before(async () => {
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Setup User With Real Data
    clientUserWithData = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signA, error: errA } = await clientUserWithData.auth.signUp({
      email: emailWithData,
      password,
      options: { data: { first_name: 'Bobur' } },
    });
    assert.strictEqual(errA, null);
    userIdWithData = signA.user.id;
    await adminClient.auth.admin.updateUserById(userIdWithData, { email_confirm: true });
    await clientUserWithData.auth.signInWithPassword({ email: emailWithData, password });
    await adminClient.from('profiles').upsert({
      id: userIdWithData,
      email: emailWithData,
      first_name: 'Bobur',
      role: 'teacher',
      onboarding_completed: true,
    });

    // 2. Setup User With Zero Data (Fresh account)
    clientUserEmpty = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signB, error: errB } = await clientUserEmpty.auth.signUp({
      email: emailEmpty,
      password,
      options: { data: { first_name: 'Nodira' } },
    });
    assert.strictEqual(errB, null);
    userIdEmpty = signB.user.id;
    await adminClient.auth.admin.updateUserById(userIdEmpty, { email_confirm: true });
    await clientUserEmpty.auth.signInWithPassword({ email: emailEmpty, password });
    await adminClient.from('profiles').upsert({
      id: userIdEmpty,
      email: emailEmpty,
      first_name: 'Nodira',
      role: 'teacher',
      onboarding_completed: true,
    });

    // 3. Create Real Category & Transactions for User A
    const catRes = await createCategory(
      { name: 'Oziq-ovqat va Kafe', type: 'expense', color: '#10b981' },
      clientUserWithData
    );
    assert.strictEqual(catRes.status, 201);
    categoryId = catRes.data.id;

    // Transaction 1: 300,000 UZS expense
    const tx1 = await createTransaction(
      {
        description: 'Korzinka oylik bozorlik',
        amount: 300000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-11-02',
        category_id: categoryId,
      },
      clientUserWithData
    );
    assert.strictEqual(tx1.status, 201);

    // Transaction 2: 200,000 UZS expense
    const tx2 = await createTransaction(
      {
        description: 'Rayhon milliy taomlar tushlik',
        amount: 200000,
        currency: 'UZS',
        type: 'expense',
        transaction_date: '2026-11-04',
        category_id: categoryId,
      },
      clientUserWithData
    );
    assert.strictEqual(tx2.status, 201);

    // Transaction 3: 1,500,000 UZS income
    const tx3 = await createTransaction(
      {
        description: 'Frilans loyiha to‘lovi',
        amount: 1500000,
        currency: 'UZS',
        type: 'income',
        transaction_date: '2026-11-01',
      },
      clientUserWithData
    );
    assert.strictEqual(tx3.status, 201);
  });

  after(async () => {
    if (userIdWithData) {
      await adminClient.from('ai_messages').delete().eq('user_id', userIdWithData);
      await adminClient.from('ai_conversations').delete().eq('user_id', userIdWithData);
      await adminClient.from('transactions').delete().eq('user_id', userIdWithData);
      await adminClient.from('categories').delete().eq('user_id', userIdWithData);
      await adminClient.from('profiles').delete().eq('id', userIdWithData);
      await adminClient.auth.admin.deleteUser(userIdWithData);
    }
    if (userIdEmpty) {
      await adminClient.from('ai_messages').delete().eq('user_id', userIdEmpty);
      await adminClient.from('ai_conversations').delete().eq('user_id', userIdEmpty);
      await adminClient.from('profiles').delete().eq('id', userIdEmpty);
      await adminClient.auth.admin.deleteUser(userIdEmpty);
    }
  });

  test('1. Oddiy salomlashuv: AI responds coherently in Uzbek to a simple greeting', async () => {
    const res = await askFinancialAdvisor(
      'Assalomu alaykum! Yaxshimisiz?',
      undefined,
      clientUserWithData
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.data?.answer);
    assert.ok(res.data?.conversationId);
    convIdUserWithData = res.data.conversationId;
    assert.strictEqual(typeof res.data.answer, 'string');
    assert.ok(res.data.answer.length > 5, 'Response must not be empty');
  });

  test('2. Moliyaviy holat haqida savol: AI answers grounded in verified facts', async () => {
    const res = await askFinancialAdvisor(
      'Mening umumiy moliyaviy holatim qanday?',
      convIdUserWithData,
      clientUserWithData
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.data?.answer);
    assert.ok(res.data?.evidence);
    // Verified context should contain 1 500 000 income and 500 000 expense
    const evidenceText = String(res.data.evidence.grounded_context || '');
    assert.ok(evidenceText.includes('1 500 000'), 'Evidence context must reflect 1 500 000 UZS income');
    assert.ok(evidenceText.includes('500 000'), 'Evidence context must reflect 500 000 UZS total expense');
  });

  test('3. Haqiqiy tranzaksiyalar asosida xarajatlar tahlili: accurate sum and transactions', async () => {
    const res = await askFinancialAdvisor(
      'Noyabr oyida qancha pul sarfladim va jami daromadim qancha bo‘ldi?',
      convIdUserWithData,
      clientUserWithData
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.data?.answer);
    // Answer or evidence must accurately reference real values without fabricating
    const answer = res.data.answer.toLowerCase();
    const context = String(res.data.evidence.grounded_context || '');
    assert.ok(
      answer.includes('500 000') || context.includes('500 000'),
      'Must contain verified 500 000 expense figure'
    );
  });

  test('4. Xarajatlarni kategoriyalar bo‘yicha tahlil qilish', async () => {
    const res = await askFinancialAdvisor(
      'Qaysi kategoriyaga eng ko‘p pul sarfladim?',
      convIdUserWithData,
      clientUserWithData
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.data?.answer);
    const text = (res.data.answer + ' ' + (res.data.evidence.grounded_context || '')).toLowerCase();
    assert.ok(
      text.includes('oziq-ovqat') || text.includes('kafe'),
      'Category analysis must identify the real category from DB'
    );
  });

  test('5. Ma’lumot yo‘q foydalanuvchiga to‘g‘ri javob: States zero data honestly without hallucinating', async () => {
    const res = await askFinancialAdvisor(
      'Bu oy qancha xarajat qildim?',
      undefined,
      clientUserEmpty
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.data?.answer);
    const answer = res.data.answer.toLowerCase();
    // Must clearly state that there are 0 transactions or no data
    assert.ok(
      answer.includes('yo‘q') ||
      answer.includes('0') ||
      answer.includes('mavjud emas') ||
      answer.includes('toza') ||
      answer.includes('topilmadi') ||
      answer.includes('kiritilmagan'),
      `Answer must honestly communicate that user has no transactions: "${res.data.answer}"`
    );
  });

  test('6. User Isolation: User B cannot access User A conversation or data', async () => {
    // User B attempts to continue User A's conversation
    const hijackedRes = await askFinancialAdvisor(
      'User A ning pullari qancha?',
      convIdUserWithData, // User A's conversation ID
      clientUserEmpty     // Called as User B
    );

    // Must be rejected with 404 Not Found (ownership check blocks cross-user access)
    assert.strictEqual(hijackedRes.status, 404, 'Must reject foreign conversation access');
    assert.strictEqual(hijackedRes.data, null);
  });

  test('7. API xatoligida to‘g‘ri error handling (400 for empty, 401 for unauthenticated)', async () => {
    // Empty question
    const emptyRes = await askFinancialAdvisor('', undefined, clientUserWithData);
    assert.strictEqual(emptyRes.status, 400);
    assert.strictEqual(emptyRes.data, null);

    // Unauthenticated client (no session)
    const unauthClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const unauthRes = await askFinancialAdvisor('Salom', undefined, unauthClient);
    assert.strictEqual(unauthRes.status, 401);
    assert.strictEqual(unauthRes.data, null);
  });
});

