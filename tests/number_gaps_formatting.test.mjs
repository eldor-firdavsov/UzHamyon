import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumberWithGaps,
  parseNumberFromGaps,
  cleanNumberGaps,
} from '../src/lib/formatters/numberGaps.ts';

test('Number Gaps Formatter — Space Separator (100 000 vs 100000)', async (t) => {
  await t.test('1. Formats standard integers with space gaps', () => {
    assert.equal(formatNumberWithGaps(100), '100');
    assert.equal(formatNumberWithGaps(1000), '1 000');
    assert.equal(formatNumberWithGaps(10000), '10 000');
    assert.equal(formatNumberWithGaps(100000), '100 000');
    assert.equal(formatNumberWithGaps(1000000), '1 000 000');
    assert.equal(formatNumberWithGaps(80000000), '80 000 000');
  });

  await t.test('2. Formats string inputs as the user types digits sequentially', () => {
    // User typing "100000" keystroke by keystroke
    assert.equal(formatNumberWithGaps('1'), '1');
    assert.equal(formatNumberWithGaps('10'), '10');
    assert.equal(formatNumberWithGaps('100'), '100');
    assert.equal(formatNumberWithGaps('1000'), '1 000');
    assert.equal(formatNumberWithGaps('10000'), '10 000');
    assert.equal(formatNumberWithGaps('100000'), '100 000');
    assert.equal(formatNumberWithGaps('1000000'), '1 000 000');
  });

  await t.test('3. Preserves trailing dot while user enters decimals', () => {
    assert.equal(formatNumberWithGaps('100000.'), '100 000.');
    assert.equal(formatNumberWithGaps('100000.5'), '100 000.5');
    assert.equal(formatNumberWithGaps('100000.50'), '100 000.50');
    // Also converts comma to dot
    assert.equal(formatNumberWithGaps('100000,'), '100 000.');
    assert.equal(formatNumberWithGaps('100000,75'), '100 000.75');
  });

  await t.test('4. Handles already formatted strings idempotently', () => {
    assert.equal(formatNumberWithGaps('100 000'), '100 000');
    assert.equal(formatNumberWithGaps('1  000  000'), '1 000 000');
  });

  await t.test('5. Removes unnecessary leading zeros for clean display', () => {
    assert.equal(formatNumberWithGaps('05'), '5');
    assert.equal(formatNumberWithGaps('00050'), '50');
    assert.equal(formatNumberWithGaps('0'), '0');
    assert.equal(formatNumberWithGaps('0.5'), '0.5');
  });

  await t.test('6. parseNumberFromGaps extracts accurate numeric values', () => {
    assert.equal(parseNumberFromGaps('100 000'), 100000);
    assert.equal(parseNumberFromGaps('1 000 000.50'), 1000000.5);
    assert.equal(parseNumberFromGaps('80 000 000'), 80000000);
    assert.equal(parseNumberFromGaps(''), 0);
    assert.equal(parseNumberFromGaps(null), 0);
  });

  await t.test('7. cleanNumberGaps produces unspaced strings for DB storage', () => {
    assert.equal(cleanNumberGaps('100 000'), '100000');
    assert.equal(cleanNumberGaps('100 000.50'), '100000.50');
    assert.equal(cleanNumberGaps(''), '');
  });
});
