/**
 * Phase 1 — logging streak and quick picks (offline, pure functions).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { computeStreak, weekStart } = await import('../src/lib/streak/compute.ts');
const { computeQuickPicks, shortAmount } = await import('../src/lib/transactions/quickPicks.ts');

// 2026-11-20 is a Friday; its week starts Monday 2026-11-16.
const TODAY = '2026-11-20';

test('weekStart returns the Monday', () => {
  assert.equal(weekStart('2026-11-20'), '2026-11-16');
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
  assert.equal(weekStart('2026-11-22'), '2026-11-16'); // Sunday
});

test('no activity → zero streak, one freeze available', () => {
  const s = computeStreak([], TODAY);
  assert.equal(s.current, 0);
  assert.equal(s.best, 0);
  assert.equal(s.todayDone, false);
  assert.equal(s.freezesLeft, 1);
  assert.equal(s.week.length, 7);
  assert.equal(s.week[4].state, 'today');
  assert.equal(s.week[5].state, 'future');
});

test('consecutive days including today', () => {
  const s = computeStreak(['2026-11-18', '2026-11-19', '2026-11-20'], TODAY);
  assert.equal(s.current, 3);
  assert.equal(s.best, 3);
  assert.equal(s.todayDone, true);
});

test('today pending does not break the streak', () => {
  const s = computeStreak(['2026-11-17', '2026-11-18', '2026-11-19'], TODAY);
  assert.equal(s.current, 3);
  assert.equal(s.todayDone, false);
  assert.equal(s.week[4].state, 'today');
});

test('one missed day is frozen when the next day was logged', () => {
  const s = computeStreak(['2026-11-16', '2026-11-18', '2026-11-19'], TODAY);
  assert.equal(s.current, 3);
  assert.equal(s.week[1].state, 'frozen');
  assert.equal(s.freezesLeft, 0);
});

test('yesterday missed while today pending: frozen, streak still alive', () => {
  const s = computeStreak(['2026-11-17', '2026-11-18'], TODAY);
  assert.equal(s.current, 2);
  assert.equal(s.week[3].state, 'frozen');
});

test('two missed days in a row break the streak', () => {
  const s = computeStreak(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-15', '2026-11-16'], TODAY);
  // 13 and 14 missed → broken; 15 (Sun) 16 (Mon) run = 2, then 17,18,19 missed → broken
  assert.equal(s.current, 0);
  assert.equal(s.best, 3);
});

test('only one freeze per week', () => {
  // Mon 16 done, Tue 17 missed, Wed 18 done, Thu 19 missed, Fri 20 done
  const s = computeStreak(['2026-11-16', '2026-11-18', '2026-11-20'], TODAY);
  assert.equal(s.current, 1);
  assert.equal(s.week[1].state, 'frozen');
  assert.equal(s.week[3].state, 'missed');
});

test('future and malformed dates are ignored', () => {
  const s = computeStreak(['2026-11-21', 'garbage', '', '2026-11-20T10:00:00Z'], TODAY);
  assert.equal(s.current, 1);
  assert.equal(s.todayDone, true);
});

const tx = (desc, amount, date, type = 'ex', cat = 'Transport') => ({ desc, amount, date, type, cat });

test('favourites: repeated items ranked by count with their usual amount', () => {
  const rows = [
    tx('Taksi', 18000, '2026-11-19'),
    tx('taksi ', 18000, '2026-11-18'),
    tx('Taksi', 25000, '2026-11-10'),
    tx('Kofe', 25000, '2026-11-19', 'ex', 'Restoran'),
    tx('Kofe', 25000, '2026-11-17', 'ex', 'Restoran'),
    tx('Korzinka', 320000, '2026-11-20', 'ex', 'Oziq-ovqat'),
    tx('Maosh', 6000000, '2026-11-18', 'in', 'Maosh'),
  ];
  const { favorites, recents } = computeQuickPicks(rows, 'ex', TODAY);
  assert.equal(favorites[0].desc, 'Taksi');
  assert.equal(favorites[0].amount, 18000);
  assert.equal(favorites[0].count, 3);
  assert.equal(favorites[1].desc, 'Kofe');
  assert.equal(favorites.length, 4, 'padded with starters');
  assert.equal(favorites[2].amount, 0, 'starter tiles have no amount');
  assert.ok(!favorites.some((f) => f.desc === 'Taksi' && f.count === 0), 'no duplicate starter');
  assert.deepEqual(recents.map((r) => r.desc), ['Korzinka']);
});

test('quick picks ignore old rows and other types', () => {
  const rows = [tx('Taksi', 18000, '2026-08-01'), tx('Taksi', 18000, '2026-08-02'), tx('Maosh', 5000000, '2026-11-01', 'in')];
  const ex = computeQuickPicks(rows, 'ex', TODAY);
  assert.ok(ex.favorites.every((f) => f.count === 0));
  assert.equal(ex.recents.length, 0);
  const inc = computeQuickPicks(rows, 'in', TODAY);
  assert.equal(inc.favorites[0].desc, 'Maosh');
  assert.equal(inc.favorites[0].amount, 5000000, 'starter takes the real last amount');
});

test('shortAmount', () => {
  assert.equal(shortAmount(18000), '18k');
  assert.equal(shortAmount(25500), '25.5k');
  assert.equal(shortAmount(1500000), '1.5 mln');
  assert.equal(shortAmount(6000000), '6 mln');
  assert.equal(shortAmount(500), '500');
  assert.equal(shortAmount(0), '');
});
