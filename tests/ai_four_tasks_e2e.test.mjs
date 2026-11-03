import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Load .env.local into process.env so live AI tests have access to OPENROUTER_API_KEY
const envText = fs.readFileSync('.env.local', 'utf-8');
for (const line of envText.split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].trim();
  }
}

test('UzHamyon AI — 4 Core Tasks (Xarajat, Daromad, Maqsad, Jamg‘armaga pul qo‘shish)', async (t) => {
  const { processFinancialIntent, executePendingAction } = await import('../src/lib/ai/financialActionEngine.ts');

  // In-memory mock database tracking rows
  const db = {
    transactions: [],
    financial_goals: [
      { id: 'goal-mashina-1', user_id: 'test-user-123', name: 'Mashina', target_amount: 80000000, current_amount: 0, status: 'in_progress', currency: 'UZS' },
    ],
    ai_messages: [],
    categories: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Groceries', type: 'expense', is_system: true, user_id: 'test-user-123' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Dining Out', type: 'expense', is_system: true, user_id: 'test-user-123' },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Salary', type: 'income', is_system: true, user_id: 'test-user-123' },
    ],
    profile: { id: 'test-user-123', financial_start_date: '2026-01-01' },
  };

  const createQueryChain = (currentTable) => {
    let filterId = null;
    let filterUserId = null;
    let filterType = null;

    const chain = {
      select: () => chain,
      eq: (col, val) => {
        if (col === 'id') filterId = val;
        if (col === 'user_id') filterUserId = val;
        if (col === 'type') filterType = val;
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        if (currentTable === 'profiles') {
          return { data: db.profile, error: null };
        }
        if (currentTable === 'categories') {
          const cat = db.categories.find((c) => !filterId || c.id === filterId);
          return { data: cat || null, error: null };
        }
        if (currentTable === 'financial_goals') {
          const item = db.financial_goals.find((g) => !filterId || g.id === filterId);
          return { data: item || null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (currentTable === 'financial_goals') {
          const item = db.financial_goals.find((g) => !filterId || g.id === filterId);
          return { data: item || null, error: null };
        }
        if (currentTable === 'transactions') {
          return { data: db.transactions[db.transactions.length - 1], error: null };
        }
        return { data: null, error: null };
      },
      insert: (rowOrRows) => {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        for (const r of rows) {
          const inserted = { id: `id-${Date.now()}-${Math.random()}`, ...r };
          if (currentTable === 'transactions') db.transactions.push(inserted);
          if (currentTable === 'financial_goals') db.financial_goals.push(inserted);
          if (currentTable === 'ai_messages') db.ai_messages.push(inserted);
        }
        return {
          select: () => ({
            single: async () => {
              const list = currentTable === 'financial_goals' ? db.financial_goals : db.transactions;
              return { data: list[list.length - 1], error: null };
            },
          }),
          single: async () => {
            const list = currentTable === 'financial_goals' ? db.financial_goals : db.transactions;
            return { data: list[list.length - 1], error: null };
          },
        };
      },
      update: (updates) => {
        if (currentTable === 'profiles') {
          Object.assign(db.profile, updates);
        }
        return {
          eq: (col, val) => {
            if (col === 'id') filterId = val;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => {
                    const item = db.financial_goals.find((g) => g.id === filterId);
                    if (item) Object.assign(item, updates);
                    return { data: item, error: null };
                  },
                }),
              }),
              select: () => ({
                single: async () => {
                  const item = db.financial_goals.find((g) => g.id === filterId);
                  if (item) Object.assign(item, updates);
                  return { data: item, error: null };
                },
              }),
            };
          },
        };
      },
      then: (resolve) => {
        if (currentTable === 'categories') {
          const list = filterType ? db.categories.filter((c) => c.type === filterType) : db.categories;
          return resolve({ data: list, error: null });
        }
        if (currentTable === 'financial_goals') {
          return resolve({ data: db.financial_goals, error: null });
        }
        return resolve({ data: [], error: null });
      },
    };

    return chain;
  };

  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user-123' } }, error: null }),
    },
    from: (table) => createQueryChain(table),
  };

  await t.test('Task 1: AI bilan yangi xarajat qo‘shish (create_expense)', async () => {
    const res = await processFinancialIntent(
      'Bugun tushlikka 45 000 soʻm xarajat qildim.',
      'conv-1',
      'test-user-123',
      mockSupabase
    );

    assert.equal(res.handled, true, 'Must handle expense intent');
    assert.ok(res.pendingAction, 'Pending action must be generated');
    assert.equal(res.pendingAction.type, 'create_expense');
    assert.equal(res.pendingAction.params.amount, 45000);

    // Confirm action
    const confirmRes = await executePendingAction(res.pendingAction, mockSupabase);
    assert.equal(confirmRes.success, true);
    assert.ok(confirmRes.message.includes('xarajat muvaffaqiyatli saqlandi'));
    assert.equal(db.transactions.length, 1);
    assert.equal(db.transactions[0].amount, 45000);
    assert.equal(db.transactions[0].type, 'expense');
  });

  await t.test('Task 2: AI bilan yangi daromad qo‘shish (create_income)', async () => {
    const res = await processFinancialIntent(
      'Bugun 6 million soʻm oylik oldim.',
      'conv-1',
      'test-user-123',
      mockSupabase
    );

    assert.equal(res.handled, true, 'Must handle income intent');
    assert.equal(res.actionResult?.success, true);
    assert.equal(res.actionResult?.type, 'create_income');
    assert.equal(db.transactions.length, 2);
    assert.equal(db.transactions[1].amount, 6000000);
    assert.equal(db.transactions[1].type, 'income');
  });

  await t.test('Task 3: AI bilan yangi jamg‘arma maqsadi qo‘shish (create_goal)', async () => {
    const res = await processFinancialIntent(
      'Yangi mashina olish uchun 80 million soʻmlik jamgʻarma maqsadi qoʻshmoqchiman.',
      'conv-1',
      'test-user-123',
      mockSupabase
    );

    assert.equal(res.handled, true, 'Must handle goal intent');
    assert.ok(res.pendingAction);
    assert.equal(res.pendingAction.type, 'create_goal');
    assert.equal(res.pendingAction.params.amount, 80000000);
    assert.ok(res.pendingAction.params.goal_name.toLowerCase().includes('mashina'));

    // Execute goal creation
    const confirmRes = await executePendingAction(res.pendingAction, mockSupabase);
    assert.equal(confirmRes.success, true);
    assert.ok(confirmRes.message.includes('muvaffaqiyatli yaratildi'));
    assert.ok(db.financial_goals.some((g) => g.target_amount === 80000000));
  });

  await t.test('Task 4: AI bilan jamg‘armaga yangi summa qo‘shish (contribute_goal)', async () => {
    const res = await processFinancialIntent(
      'Mashina maqsadiga 3 000 000 soʻm pul qoʻshdim.',
      'conv-1',
      'test-user-123',
      mockSupabase
    );

    assert.equal(res.handled, true, 'Must handle contribution intent');
    assert.ok(res.pendingAction);
    assert.equal(res.pendingAction.type, 'contribute_goal');
    assert.equal(res.pendingAction.params.amount, 3000000);
    assert.ok(res.pendingAction.params.goal_name.toLowerCase().includes('mashina'));

    // Execute contribution
    const confirmRes = await executePendingAction(res.pendingAction, mockSupabase);
    assert.equal(confirmRes.success, true);
    assert.ok(confirmRes.message.includes('muvaffaqiyatli qo‘shildi'));
    const mashinaGoal = db.financial_goals.find((g) => g.name === 'Mashina');
    assert.equal(mashinaGoal.current_amount, 3000000);
  });

  await t.test('Task 5: Model OpenRouter google/gemini-2.5-flash live check', async () => {
    const { generateAIContent } = await import('../src/lib/ai/aiClient.ts');
    const aiRes = await generateAIContent('Menga oylik maoshimdan qancha jamg‘arma qilishni tavsiya qilasiz?');
    assert.equal(aiRes.isFallback, false, 'Must connect to live AI without fallback');
    assert.ok(aiRes.text.length > 20, 'Must produce substantive reply');
    assert.ok(aiRes.model.includes('gemini') || aiRes.model.includes('flash'), 'Must use Gemini 2.5 Flash');
  });
});
