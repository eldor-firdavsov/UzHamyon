import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertAmount,
  formatAmount,
  formatWithUnit,
  mentionedCurrency,
  parseDotDate,
  toDisplayCurrency,
} from '../src/lib/fx/currency.ts';
import { applyDefaultCurrency, buildActionSummary } from '../src/lib/ai/actionExtractionEngine.ts';

const RATE = 12_650;

test('convertAmount: so‘m ⇄ dollar at the rate, same currency unchanged', () => {
  assert.equal(convertAmount(126_500, 'UZS', 'USD', RATE), 10);
  assert.equal(convertAmount(10, 'USD', 'UZS', RATE), 126_500);
  assert.equal(convertAmount(45_000, 'UZS', 'USD', RATE), 3.56);
  assert.equal(convertAmount(3.5, 'USD', 'USD', RATE), 3.5);
  assert.equal(convertAmount(100, 'EUR', 'UZS', RATE), 100, 'no rate for EUR: unchanged');
  assert.equal(convertAmount(100, 'UZS', 'USD', 0), 100, 'invalid rate: unchanged');
});

test('formatAmount / formatWithUnit', () => {
  assert.equal(formatAmount(1_250_000, 'UZS'), '1 250 000');
  assert.equal(formatAmount(1250.5, 'USD'), '1 250.50');
  assert.equal(formatAmount(12, 'USD'), '12');
  assert.equal(formatAmount(-45_000, 'UZS'), '45 000');
  assert.equal(formatWithUnit(45_000, 'UZS'), '45 000 so‘m');
  assert.equal(formatWithUnit(3.56, 'USD'), '$3.56');
});

test('toDisplayCurrency only knows UZS and USD', () => {
  assert.equal(toDisplayCurrency('usd'), 'USD');
  assert.equal(toDisplayCurrency('EUR'), 'UZS');
  assert.equal(toDisplayCurrency(null), 'UZS');
});

test('mentionedCurrency detects what the user named', () => {
  assert.equal(mentionedCurrency('kofe $4'), 'USD');
  assert.equal(mentionedCurrency('frilans 200 dollar'), 'USD');
  assert.equal(mentionedCurrency('taksi 20 ming'), 'UZS');
  assert.equal(mentionedCurrency('tushlik 45000 so‘m'), 'UZS');
  assert.equal(mentionedCurrency("tushlik 45000 so'm"), 'UZS');
  assert.equal(mentionedCurrency('2.5 mln maosh'), 'UZS');
  assert.equal(mentionedCurrency('taksi 20000'), null);
  assert.equal(mentionedCurrency('kofe 4'), null);
});

test('parseDotDate', () => {
  assert.equal(parseDotDate('23.11.2026'), '2026-11-23');
  assert.equal(parseDotDate('bad'), '');
});

function tx(amount, extra = {}) {
  return { actionType: 'create_transaction', transactionType: 'expense', amount, currency: 'UZS', currencyExplicit: false, description: 'Kofe', ...extra };
}

test('applyDefaultCurrency: dollar user, no currency named → dollars', () => {
  const res = applyDefaultCurrency({ intent: 'action_proposal', actions: [tx(4)], summaryUzbek: '4 so‘m kofe?' }, 'USD');
  assert.equal(res.actions[0].currency, 'USD');
  assert.match(res.summaryUzbek, /4 dollar/);
});

test('applyDefaultCurrency keeps named currencies, big plain amounts, goal contributions and so‘m users', () => {
  const named = applyDefaultCurrency({ intent: 'action_proposal', actions: [tx(45000, { currencyExplicit: true })], summaryUzbek: 's' }, 'USD');
  assert.equal(named.actions[0].currency, 'UZS');

  const big = applyDefaultCurrency({ intent: 'action_proposal', actions: [tx(20000)], summaryUzbek: 's' }, 'USD');
  assert.equal(big.actions[0].currency, 'UZS', '"taksi 20000" is so‘m even for a dollar user');

  const contrib = applyDefaultCurrency(
    { intent: 'action_proposal', actions: [tx(50, { actionType: 'contribute_goal', goalName: 'Noutbuk' })], summaryUzbek: 's' },
    'USD'
  );
  assert.equal(contrib.actions[0].currency, 'UZS', 'contributions follow the goal rules, not the display currency');

  const uzs = applyDefaultCurrency({ intent: 'action_proposal', actions: [tx(4)], summaryUzbek: 's' }, 'UZS');
  assert.equal(uzs.actions[0].currency, 'UZS');
  assert.equal(uzs.summaryUzbek, 's');
});

test('buildActionSummary lists several actions with their currencies', () => {
  const text = buildActionSummary([tx(4, { currency: 'USD' }), tx(20000, { description: 'Taksi' })]);
  assert.match(text, /Kofe \(Xarajat\): 4 dollar/);
  assert.match(text, /Taksi \(Xarajat\): 20 000 so‘m/);
});

import { alignGoalActions } from '../src/lib/ai/goalCurrency.ts';

const GOALS = [
  { id: 'g1', name: 'Noutbuk', currency: 'UZS', status: 'in_progress', updated_at: '2026-11-01T00:00:00Z' },
  { id: 'g2', name: 'Safar', currency: 'USD', status: 'in_progress', updated_at: '2026-10-01T00:00:00Z' },
];
const contrib = (goalName, amount, currency, currencyExplicit) => ({
  actionType: 'contribute_goal', goalName, amount, currency, currencyExplicit, description: 'Hissa',
});

test('goal contribution without a named currency takes the goal currency', () => {
  const r = alignGoalActions([contrib('Safar', 50, 'UZS', false)], GOALS, RATE);
  assert.equal(r.actions[0].currency, 'USD');
  assert.equal(r.actions[0].amount, 50);
  assert.equal(r.converted, false);
});

test('goal contribution in another named currency is converted at the rate', () => {
  const r = alignGoalActions([contrib('Noutbuk', 10, 'USD', true)], GOALS, RATE);
  assert.equal(r.actions[0].currency, 'UZS');
  assert.equal(r.actions[0].amount, 126_500);
  assert.equal(r.converted, true);
});

test('matching currency and plain transactions are untouched', () => {
  const same = alignGoalActions([contrib('Noutbuk', 500_000, 'UZS', true)], GOALS, RATE);
  assert.equal(same.changed, false);
  const txOnly = alignGoalActions([tx(4, { currency: 'USD' })], GOALS, RATE);
  assert.equal(txOnly.changed, false);
});
