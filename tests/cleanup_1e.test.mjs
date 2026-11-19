/**
 * Phase 1E tests — shared money formatter (offline).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatAmountNumber } from '../src/lib/formatters/money.ts';

test('#43 so‘m: whole numbers, space groups, U+2018 apostrophe', () => {
  assert.equal(formatMoney(45000), '45 000 so‘m');
  assert.equal(formatMoney(1234567.6, 'UZS'), '1 234 568 so‘m');
  assert.equal(formatMoney(0), '0 so‘m');
  assert.equal(formatMoney(-2500000), '-2 500 000 so‘m');
  assert.equal(formatMoney('15000'), '15 000 so‘m');
  assert.equal(formatMoney(null), '0 so‘m');
  assert.ok(!formatMoney(45000).includes(' '));
});

test('#43 USD and other currencies keep cents only when needed', () => {
  assert.equal(formatMoney(200, 'USD'), '200 dollar');
  assert.equal(formatMoney(1250.5, 'usd'), '1 250.50 dollar');
  assert.equal(formatMoney(35.456, 'USD'), '35.46 dollar');
  assert.equal(formatMoney(1250, 'EUR'), '1 250 EUR');
  assert.equal(formatAmountNumber(1000000, 0), '1 000 000');
});
