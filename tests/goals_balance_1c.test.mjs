/**
 * Phase 1C tests — fully offline.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeBalances } from '../src/lib/finance/balance.ts';
import { findUserGoal, nextGoalStatus, normalizeGoalName } from '../src/lib/goals/matchGoal.ts';
import {
  buildGoalCompletedMessage, buildGoalDeadlineMessage, telegramIdFromProfile,
} from '../src/lib/goals/notifications.ts';

// ── #27 / #28 balance ────────────────────────────────────────────────────────
test('#27 balance = income − expense − goal savings', () => {
  const b = computeBalances(
    [
      { type: 'income', amount: 5_000_000, currency: 'UZS' },
      { type: 'expense', amount: 1_200_000, currency: 'UZS' },
    ],
    [{ current_amount: 800_000, currency: 'UZS' }]
  );
  assert.equal(b.primary.income, 5_000_000);
  assert.equal(b.primary.expense, 1_200_000);
  assert.equal(b.primary.goalSavings, 800_000);
  assert.equal(b.primary.net, 3_800_000);
  assert.equal(b.primary.balance, 3_000_000);
  assert.deepEqual(b.otherCurrencies, []);
});

test('#28 currencies are never added together', () => {
  const b = computeBalances(
    [
      { type: 'in', amount: 1_000_000 },              // no currency → UZS (Mini App shape)
      { type: 'income', amount: 200, currency: 'usd' },
      { type: 'expense', amount: 35.5, currency: 'USD' },
    ],
    [{ current_amount: 50, currency: 'USD' }, { current_amount: '100000', currency: 'UZS' }]
  );
  assert.equal(b.primary.balance, 900_000);
  assert.deepEqual(b.otherCurrencies, ['USD']);
  assert.equal(b.byCurrency.USD.balance, 114.5);
});

test('balance ignores invalid rows and zero goals', () => {
  const b = computeBalances(
    [{ type: 'income', amount: 'abc' }, { type: 'expense', amount: -5 }, { type: 'transfer', amount: 10 }],
    [{ current_amount: null }, { current_amount: 0 }]
  );
  assert.equal(b.primary.balance, 0);
});

// ── #30 goal matching (same cases as SQL find_user_goal) ──────────────────────
const GOALS = [
  { id: 'g1', name: 'Noutbuk', status: 'completed', updated_at: '2026-11-10T00:00:00Z' },
  { id: 'g2', name: 'Yangi noutbuk', status: 'in_progress', updated_at: '2026-11-01T00:00:00Z' },
  { id: 'g3', name: 'Safar', status: 'in_progress', updated_at: '2026-11-15T00:00:00Z' },
  { id: 'g4', name: 'Mashina', status: 'cancelled', updated_at: '2026-11-16T00:00:00Z' },
  { id: 'g5', name: 'Uy', status: 'in_progress', updated_at: '2026-10-01T00:00:00Z' },
];

test('#30 exact name wins over contains, even if completed', () => {
  assert.equal(findUserGoal(GOALS, 'noutbuk')?.id, 'g1');
});

test('#30 contains: in_progress before completed', () => {
  assert.equal(findUserGoal(GOALS, 'noutb')?.id, 'g2');
});

test('#30 cancelled goals are never matched automatically', () => {
  assert.equal(findUserGoal(GOALS, 'Mashina'), null);
});

test('#30 query containing the goal name matches ("safar uchun")', () => {
  assert.equal(findUserGoal(GOALS, 'safar uchun')?.id, 'g3');
});

test('#30 no name → newest in_progress goal', () => {
  assert.equal(findUserGoal(GOALS, '')?.id, 'g3');
  assert.equal(findUserGoal(GOALS.filter((g) => g.status !== 'in_progress'), null), null);
});

test('goal names normalize apostrophes and spaces', () => {
  assert.equal(normalizeGoalName("  Ta’lim   kursi "), "ta'lim kursi");
});

// ── #31 status ───────────────────────────────────────────────────────────────
test('#31 cancelled stays cancelled; otherwise completed / in_progress', () => {
  assert.equal(nextGoalStatus('cancelled', 1_000, 500), 'cancelled');
  assert.equal(nextGoalStatus('in_progress', 500, 500), 'completed');
  assert.equal(nextGoalStatus('completed', 100, 500), 'in_progress');
});

// ── #33 notices ──────────────────────────────────────────────────────────────
test('#33 notice texts escape the goal name', () => {
  assert.match(buildGoalCompletedMessage('<b>Noutbuk</b> & co'), /«&lt;b&gt;Noutbuk&lt;\/b&gt; &amp; co» maqsadingizga yetdingiz!/);
  assert.match(buildGoalCompletedMessage('Safar'), /^🎉 <b>Tabriklaymiz!<\/b>/);
  const deadline = buildGoalDeadlineMessage('Uy <x>', '2026-10-01');
  assert.match(deadline, /«Uy &lt;x&gt;» maqsadingiz muddati \(2026-10-01\) o‘tdi/);
  assert.match(deadline, /yangi sana/);
});

test('#33 Telegram id comes from the internal email or onboarding_data', () => {
  assert.equal(telegramIdFromProfile({ email: 'tg_12345@telegram.uzhamyon.uz' }), 12345);
  assert.equal(telegramIdFromProfile({ email: 'a@b.uz', onboarding_data: { telegram_id: '777' } }), 777);
  assert.equal(telegramIdFromProfile({ email: 'a@b.uz', onboarding_data: {} }), null);
  assert.equal(telegramIdFromProfile(null), null);
});
