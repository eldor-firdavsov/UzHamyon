/**
 * Phase 1B tests — fully offline. Gemini is mocked through globalThis.fetch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  todayTashkent, nowTimeTashkent, yesterdayTashkent, monthRangeTashkent, tashkentToIso, addDaysToDate,
} from '../src/lib/time/tashkent.ts';
import {
  buildCategoryOptions, resolveCategoryOption, matchCategoryRow, attachCategoryIds, pickAllowedName,
  categoryNamesByType,
} from '../src/lib/categories/catalog.ts';
import { AiBudget } from '../src/lib/ai/aiBudget.ts';
import { isAmountWithinLimit, MAX_ACTIONS_PER_MESSAGE } from '../src/lib/ai/limits.ts';
import { buildClaimableStatusFilter } from '../src/lib/ai/pendingActionStore.ts';
import {
  _getModelDisabledUntil, _resetDisabledModels, MODEL_DISABLE_TTL_MS, callGeminiApi,
} from '../src/lib/ai/geminiClient.ts';
import { extractFinancialActions } from '../src/lib/ai/actionExtractionEngine.ts';

// ── #16 Tashkent time ────────────────────────────────────────────────────────
test('#16 00:30 in Tashkent is already "today" although UTC is still yesterday', () => {
  const at = new Date('2026-11-18T19:30:00Z'); // = 2026-11-19 00:30 Tashkent
  assert.equal(todayTashkent(at), '2026-11-19');
  assert.equal(nowTimeTashkent(at), '00:30');
  assert.equal(yesterdayTashkent(at), '2026-11-18');
});

test('#16 month boundaries and date arithmetic', () => {
  assert.deepEqual(monthRangeTashkent(2028, 2), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(monthRangeTashkent(2026, 12), { start: '2026-12-01', end: '2026-12-31' });
  // 31 Dec 21:00 UTC is already 1 Jan in Tashkent
  assert.deepEqual(monthRangeTashkent(undefined, undefined, new Date('2026-12-31T21:00:00Z')), {
    start: '2027-01-01', end: '2027-01-31',
  });
  assert.equal(addDaysToDate('2026-03-01', -1), '2026-02-28');
});

test('#17 Tashkent wall clock is stored with the +05:00 offset', () => {
  assert.equal(tashkentToIso('2026-11-18', '14:30'), '2026-11-18T14:30:00+05:00');
  assert.equal(new Date(tashkentToIso('2026-11-18', '14:30')).toISOString(), '2026-11-18T09:30:00.000Z');
  assert.equal(tashkentToIso('2026-11-18', 'bad'), '2026-11-18T12:00:00+05:00');
});

// ── #14 / #15 categories ─────────────────────────────────────────────────────
const SYSTEM_ROWS = [
  { id: 'c-groc', name: 'Groceries', type: 'expense', is_system: true, user_id: null },
  { id: 'c-house', name: 'Housing / Rent', type: 'expense', is_system: true, user_id: null },
  { id: 'c-trans', name: 'Transportation', type: 'expense', is_system: true, user_id: null },
  { id: 'c-misc', name: 'Miscellaneous', type: 'expense', is_system: true, user_id: null },
  { id: 'c-sal', name: 'Salary', type: 'income', is_system: true, user_id: null },
];

test('#14 options use Uzbek names for system rows and keep the user\'s own categories', () => {
  const options = buildCategoryOptions([
    ...SYSTEM_ROWS,
    { id: 'u-kids', name: 'Bolalar', type: 'expense', is_system: false, user_id: 'u1' },
  ]);
  const names = categoryNamesByType(options);
  assert.deepEqual(names.expense.sort(), ['Bolalar', 'Oziq-ovqat', 'Transport', 'Uy-joy'].sort());
  assert.deepEqual(names.income, ['Maosh']);
  assert.equal(resolveCategoryOption('oziq-ovqat', 'expense', options)?.categoryId, 'c-groc');
  assert.equal(resolveCategoryOption('Maosh', 'expense', options), undefined); // wrong type
});

test('#14 attachCategoryIds stores id + DB name, drops unknown names', () => {
  const options = buildCategoryOptions(SYSTEM_ROWS);
  const [known, unknown] = attachCategoryIds(
    [
      { actionType: 'create_transaction', transactionType: 'expense', categoryName: 'Transport' },
      { actionType: 'create_transaction', transactionType: 'expense', categoryName: 'Ovqat' },
    ],
    options
  );
  assert.equal(known.categoryId, 'c-trans');
  assert.equal(known.categoryName, 'Transportation');
  assert.equal(known.categoryDisplayName, 'Transport');
  assert.equal(unknown.categoryId, undefined);
  assert.equal(unknown.categoryName, undefined);
});

test('#15 matcher never falls back to the first category and has no substring guessing', () => {
  const rows = SYSTEM_ROWS.filter((r) => r.type === 'expense');
  // No "Internet & Phone" row (migration 012 not applied) → no category, NOT Housing.
  assert.equal(matchCategoryRow('Aloqa va Internet', rows), undefined);
  assert.equal(matchCategoryRow('Nimadir', rows), undefined);
  assert.equal(matchCategoryRow('Trans', rows), undefined);
  assert.equal(matchCategoryRow('Uy-joy', rows)?.id, 'c-house');
  assert.equal(matchCategoryRow('Transportation', rows)?.id, 'c-trans');
  assert.equal(matchCategoryRow("Ko‘ngilochar", [{ id: 'e', name: 'Entertainment', type: 'expense' }], 'expense')?.id, 'e');
});

test('pickAllowedName accepts only names from the list (apostrophe variants unified)', () => {
  assert.equal(pickAllowedName("Ta’lim", ["Ta'lim"]), "Ta'lim");
  assert.equal(pickAllowedName('Ovqat', ['Oziq-ovqat']), undefined);
  assert.equal(pickAllowedName(null, ['Oziq-ovqat']), undefined);
});

// ── #21 / #22 / #25 / #12 helpers ────────────────────────────────────────────
test('#21 AiBudget caps every call by the time left', () => {
  let now = 1_000;
  const budget = new AiBudget(25_000, 10_000, () => now);
  assert.equal(budget.timeoutFor(30_000), 10_000);
  now += 20_000;
  assert.equal(budget.timeoutFor(30_000), 5_000);
  assert.equal(budget.canStart(), true);
  now += 4_000;
  assert.equal(budget.canStart(), false);
});

test('#25 amount limits per currency', () => {
  assert.equal(isAmountWithinLimit(1_000_000_000, 'UZS'), true);
  assert.equal(isAmountWithinLimit(1_000_000_001, 'UZS'), false);
  assert.equal(isAmountWithinLimit(100_001, 'USD'), false);
  assert.equal(isAmountWithinLimit(0, 'UZS'), false);
  assert.equal(MAX_ACTIONS_PER_MESSAGE, 10);
});

test('#12 claim filter only matches claimable rows', () => {
  const f = buildClaimableStatusFilter('2026-11-18T10:00:00.000Z');
  assert.equal(f, 'status.in.(pending,failed),and(status.eq.executing,locked_until.lt."2026-11-18T10:00:00.000Z")');
  assert.doesNotMatch(f, /executed|cancelled|expired/);
});

// ── Gemini mocks ─────────────────────────────────────────────────────────────
function geminiReply(obj) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function withMockedGemini(handler, fn) {
  const savedFetch = globalThis.fetch;
  const savedEnv = { k: process.env.GEMINI_API_KEY, o: process.env.OPENROUTER_API_KEY, a: process.env.AI_API_KEY };
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.AI_API_KEY;
  const silence = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  _resetDisabledModels();
  globalThis.fetch = handler;
  try {
    return await fn();
  } finally {
    globalThis.fetch = savedFetch;
    [console.error, console.warn] = silence;
    if (savedEnv.k === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = savedEnv.k;
    if (savedEnv.o !== undefined) process.env.OPENROUTER_API_KEY = savedEnv.o;
    if (savedEnv.a !== undefined) process.env.AI_API_KEY = savedEnv.a;
    _resetDisabledModels();
  }
}

const CATS = { expense: ['Oziq-ovqat', 'Kafeler va Restoranlar', 'Transport'], income: ['Maosh'] };
const NOW = new Date('2026-11-18T19:30:00Z'); // 00:30 on 2026-11-19 in Tashkent

test('#14 extraction keeps only allowed category names; #16/#17 uses Tashkent date and validates time', async () => {
  let seenPrompt = '';
  await withMockedGemini(async (_url, init) => {
    seenPrompt = JSON.parse(init.body).system_instruction.parts[0].text;
    return geminiReply({
      intent: 'action_proposal',
      actions: [
        { actionType: 'create_transaction', transactionType: 'expense', amount: 45000, currency: 'UZS', description: 'Tushlik', categoryName: 'Kafeler va Restoranlar', time: '13:15' },
        { actionType: 'create_transaction', transactionType: 'expense', amount: 15000, currency: 'UZS', description: 'Taksi', categoryName: 'Ovqat', time: '99:99' },
      ],
      summaryUzbek: 'Quyidagi 2 ta xarajat',
    });
  }, async () => {
    const res = await extractFinancialActions('tushlik 45 ming, taksi 15 ming', { categories: CATS, now: NOW });
    assert.equal(res.intent, 'action_proposal');
    assert.equal(res.actions[0].categoryName, 'Kafeler va Restoranlar');
    assert.equal(res.actions[0].time, '13:15');
    assert.equal(res.actions[1].categoryName, undefined);
    assert.equal(res.actions[1].time, '00:30');
    assert.equal(res.actions[1].date, '2026-11-19');
  });
  assert.match(seenPrompt, /Bugungi sana: 2026-11-19/);
  assert.match(seenPrompt, /kechagi sana \(2026-11-18\)/);
  assert.match(seenPrompt, /Xarajat kategoriyalari: Oziq-ovqat, Kafeler va Restoranlar, Transport/);
});

test('#25 more than 10 actions → friendly clarification, nothing proposed', async () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ actionType: 'create_transaction', amount: 1000 + i, description: `x${i}` }));
  await withMockedGemini(async () => geminiReply({ intent: 'action_proposal', actions: many }), async () => {
    const res = await extractFinancialActions('juda ko‘p', { categories: CATS, now: NOW });
    assert.equal(res.intent, 'clarification');
    assert.equal(res.actions.length, 0);
    assert.match(res.clarificationQuestion, /10 ta/);
  });
});

test('#25 an amount above the cap → friendly clarification, no partial proposal', async () => {
  await withMockedGemini(async () => geminiReply({
    intent: 'action_proposal',
    actions: [
      { actionType: 'create_transaction', amount: 45000, description: 'Tushlik' },
      { actionType: 'create_transaction', amount: 5_000_000_000, description: 'Xato' },
    ],
  }), async () => {
    const res = await extractFinancialActions('...', { categories: CATS, now: NOW });
    assert.equal(res.intent, 'clarification');
    assert.equal(res.actions.length, 0);
    assert.match(res.clarificationQuestion, /juda katta/);
  });
});

test('#21 AI failure is reported as an error, not as a real question', async () => {
  await withMockedGemini(async () => { throw new TypeError('network down'); }, async () => {
    const res = await extractFinancialActions('tushlik 45 ming', { categories: CATS, now: NOW, budget: new AiBudget(25_000, 50) });
    assert.equal(res.error, 'ai_unavailable');
    assert.equal(res.actions.length, 0);
  });
});

test('#21 spent budget → budget_exceeded without calling Gemini', async () => {
  let calls = 0;
  await withMockedGemini(async () => { calls++; return geminiReply({}); }, async () => {
    const res = await extractFinancialActions('tushlik 45 ming', { now: NOW, budget: new AiBudget(0) });
    assert.equal(res.error, 'budget_exceeded');
  });
  assert.equal(calls, 0);
});

test('#22 a 429 disables the model for 10 minutes only', async () => {
  const before = Date.now();
  await withMockedGemini(async (url) => {
    if (String(url).includes('gemini-flash-lite-latest')) {
      return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 });
    }
    return geminiReply({ ok: true });
  }, async () => {
    await callGeminiApi({ contents: [] });
    const until = _getModelDisabledUntil('gemini-flash-lite-latest');
    assert.ok(until >= before + MODEL_DISABLE_TTL_MS.rateLimited - 50);
    assert.ok(until <= Date.now() + MODEL_DISABLE_TTL_MS.rateLimited + 50);
  });
});
