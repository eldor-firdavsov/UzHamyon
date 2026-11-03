import test from 'node:test';
import assert from 'node:assert/strict';

function formatBalance(n) {
  if (n === 0 || !n) return '0';
  const isNeg = n < 0;
  const absFormatted = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return isNeg ? `−${absFormatted}` : absFormatted;
}

function calculateCurrentBalance(transactions) {
  const totalIncome = transactions
    .filter((t) => t.type === 'in' || t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'ex' || t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  return totalIncome - totalExpense;
}

test('Finance Card — Current Balance & Negative Numbers', async (t) => {
  await t.test('1. Card calculates net balance right now, not just total income gained', () => {
    // User earned 12 100 000, spent 30 000
    const txs = [
      { id: '1', type: 'in', amount: 12000000, date: '2026-10-30' },
      { id: '2', type: 'in', amount: 100000, date: '2026-11-02' },
      { id: '3', type: 'ex', amount: 30000, date: '2026-11-02' },
    ];
    const balance = calculateCurrentBalance(txs);
    assert.equal(balance, 12070000, 'Balance must be 12 070 000, NOT 12 100 000 (total gained)');
    assert.equal(formatBalance(balance), '12 070 000');
  });

  await t.test('2. When expenses exceed income, shows negative numbers like a real card', () => {
    // User earned 100 000, but spent 150 000
    const txs = [
      { id: '1', type: 'in', amount: 100000, date: '2026-11-01' },
      { id: '2', type: 'ex', amount: 150000, date: '2026-11-02' },
    ];
    const balance = calculateCurrentBalance(txs);
    assert.equal(balance, -50000, 'Balance must be negative (-50 000)');
    assert.equal(formatBalance(balance), '−50 000', 'Must be formatted with unicode minus and spaces');
    assert.ok(balance < 0, 'Indicates negative balance for card styling');
  });

  await t.test('3. Clean zero account with no transactions displays 0', () => {
    const balance = calculateCurrentBalance([]);
    assert.equal(balance, 0);
    assert.equal(formatBalance(balance), '0');
  });

  await t.test('4. Large negative number formatting preserves spacing', () => {
    const balance = -12500000;
    assert.equal(formatBalance(balance), '−12 500 000');
  });

  await t.test('5. Dynamic update when expense added exceeds available balance', () => {
    const txs = [
      { id: '1', type: 'in', amount: 5000000, date: '2026-11-01' },
    ];
    let balance = calculateCurrentBalance(txs);
    assert.equal(balance, 5000000);

    // Add large expense of 8 000 000
    txs.push({ id: '2', type: 'ex', amount: 8000000, date: '2026-11-03' });
    balance = calculateCurrentBalance(txs);
    assert.equal(balance, -3000000);
    assert.equal(formatBalance(balance), '−3 000 000');
  });
});
