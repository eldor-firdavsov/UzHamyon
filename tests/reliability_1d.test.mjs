/**
 * Phase 1D tests — fully offline (Telegram and Supabase are faked).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { TelegramSessionCache, sessionExpiryMs } from '../src/lib/telegram/sessionCache.ts';
import { callBotApi, isBlockedByUser } from '../src/lib/telegram/botApi.ts';
import { isCommandForThisBot } from '../src/lib/telegram/bot.ts';
import { runReminderLoop, classifySendResult, toRecipient, shouldRemindToday, buildFirstEntryReminderMessage } from '../src/lib/telegram/reminders.ts';
import { findAuthUserIdByEmail } from '../src/lib/telegram/auth.ts';

// ── #34 session cache ────────────────────────────────────────────────────────
test('#34 cached token is reused until 5 minutes before expiry', () => {
  let now = 0;
  const cache = new TelegramSessionCache(10, 5 * 60_000, () => now);
  cache.set(1, { userId: 'u1', accessToken: 't1', onboardingCompleted: true, expiresAtMs: 60 * 60_000 });
  assert.equal(cache.get(1)?.accessToken, 't1');
  now = 54 * 60_000;
  assert.equal(cache.get(1)?.accessToken, 't1');
  now = 55 * 60_000; // inside the refresh margin → sign in again
  assert.equal(cache.get(1), undefined);
  assert.equal(cache.size, 0);
});

test('#34 cache is bounded (least recently used dropped) and skips stale tokens', () => {
  let now = 0;
  const cache = new TelegramSessionCache(2, 0, () => now);
  const s = (t) => ({ userId: t, accessToken: t, onboardingCompleted: false, expiresAtMs: 1e9 });
  cache.set(1, s('a'));
  cache.set(2, s('b'));
  cache.get(1); // 1 is now most recent
  cache.set(3, s('c'));
  assert.equal(cache.get(2), undefined);
  assert.equal(cache.get(1)?.accessToken, 'a');
  assert.equal(cache.get(3)?.accessToken, 'c');
  cache.set(4, { ...s('d'), expiresAtMs: now }); // already expired → not cached
  assert.equal(cache.get(4), undefined);
});

test('#34 expiry comes from expires_at or the JWT exp claim', () => {
  assert.equal(sessionExpiryMs(1_800_000_000, 'x'), 1_800_000_000_000);
  const payload = Buffer.from(JSON.stringify({ exp: 1_900_000_000 })).toString('base64url');
  assert.equal(sessionExpiryMs(undefined, `h.${payload}.s`), 1_900_000_000_000);
  assert.ok(Number.isNaN(sessionExpiryMs(undefined, 'not-a-jwt')));
});

// ── #37 Bot API errors ───────────────────────────────────────────────────────
async function captureConsole(fn) {
  const logs = [];
  const saved = [console.error, console.warn];
  console.error = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  try {
    return { value: await fn(), logs };
  } finally {
    [console.error, console.warn] = saved;
  }
}

test('#37 ok:false is logged with method and description, never the token', async () => {
  const savedFetch = globalThis.fetch;
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = '123456:SECRET-token';
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: can't parse entities" }), { status: 400 });
  try {
    const { value, logs } = await captureConsole(() => callBotApi('sendMessage', { chat_id: 1, text: 'x' }));
    assert.equal(value.ok, false);
    assert.equal(value.error_code, 400);
    assert.ok(logs.some((l) => l.includes('sendMessage') && l.includes("can't parse entities")));
    assert.ok(logs.every((l) => !l.includes('SECRET-token')));

    globalThis.fetch = async () => { throw new TypeError('fetch failed for https://api.telegram.org/bot123456:SECRET-token/sendMessage'); };
    const net = await captureConsole(() => callBotApi('sendMessage', {}));
    assert.equal(net.value, null);
    assert.ok(net.logs.every((l) => !l.includes('SECRET-token')));
  } finally {
    globalThis.fetch = savedFetch;
    if (savedToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = savedToken;
  }
});

test('#36 blocked users are recognised', () => {
  assert.equal(isBlockedByUser({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }), true);
  assert.equal(isBlockedByUser({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }), true);
  assert.equal(isBlockedByUser({ ok: false, error_code: 429, description: 'Too Many Requests' }), false);
  assert.deepEqual(classifySendResult({ ok: false, error_code: 429, parameters: { retry_after: 3 } }), { status: 'failed', retryAfterSec: 3 });
  assert.deepEqual(classifySendResult({ ok: true }), { status: 'sent' });
});

// ── #39 group chats ──────────────────────────────────────────────────────────
test('#39 only commands addressed to this bot get the group note', () => {
  assert.equal(isCommandForThisBot('/start'), true);
  assert.equal(isCommandForThisBot('/help@uz_hamyonbot'), true);
  assert.equal(isCommandForThisBot('/help@Other_bot'), false);
  assert.equal(isCommandForThisBot('tushlik 45 ming'), false);
  assert.equal(isCommandForThisBot('/start payload'), true);
});

// ── #36 reminder loop ────────────────────────────────────────────────────────
function profile(id, tg) {
  return { id, first_name: `User${id}`, email: `tg_${tg}@telegram.uzhamyon.uz`, onboarding_data: {} };
}

test('#36 pages through all users, batches, marks sent and blocked', async () => {
  const pages = [[profile('a', 1), profile('b', 2), profile('c', 3)], [profile('d', 4), profile('e', 2)]];
  const fetched = [];
  const sentTo = [];
  const marked = { sent: [], blocked: [] };
  const sleeps = [];
  const res = await runReminderLoop({
    fetchPage: async (afterId) => {
      fetched.push(afterId);
      return { rows: afterId === undefined ? pages[0] : afterId === 'c' ? pages[1] : [], tracking: true };
    },
    send: async (r) => { sentTo.push(r.telegramId); return { status: r.telegramId === 3 ? 'blocked' : 'sent' }; },
    markSent: async (ids) => { marked.sent.push(...ids); },
    markBlocked: async (ids) => { marked.blocked.push(...ids); },
    sleep: async (ms) => { sleeps.push(ms); },
    now: () => 0,
    pageSize: 3,
    batchSize: 2,
    batchIntervalMs: 1000,
  });
  assert.deepEqual(fetched, [undefined, 'c']);
  assert.deepEqual(sentTo, [1, 2, 3, 4]); // tg 2 appears twice → sent once
  assert.equal(res.sent, 3);
  assert.equal(res.blocked, 1);
  assert.equal(res.remaining, false);
  assert.deepEqual(marked.sent, ['a', 'b', 'd']);
  assert.deepEqual(marked.blocked, ['c']);
  assert.ok(sleeps.every((ms) => ms >= 1000));
});

test('#36 stops at the time budget and reports remaining work', async () => {
  let now = 0;
  const res = await runReminderLoop({
    fetchPage: async () => ({ rows: [profile('a', 1), profile('b', 2), profile('c', 3)], tracking: true }),
    send: async () => { now += 30_000; return { status: 'sent' }; },
    markSent: async () => {},
    markBlocked: async () => {},
    sleep: async () => {},
    now: () => now,
    timeBudgetMs: 45_000,
    batchSize: 1,
    pageSize: 1000,
  });
  assert.equal(res.sent, 2);
  assert.equal(res.remaining, true);
});

test('#36 without migration 014 nothing is marked', async () => {
  let marks = 0;
  const res = await runReminderLoop({
    fetchPage: async () => ({ rows: [profile('a', 1)], tracking: false }),
    send: async () => ({ status: 'blocked' }),
    markSent: async () => { marks++; },
    markBlocked: async () => { marks++; },
    sleep: async () => {},
    now: () => 0,
  });
  assert.equal(res.trackingAvailable, false);
  assert.equal(marks, 0);
});

test('toRecipient reads the Telegram id from email or onboarding_data', () => {
  assert.equal(toRecipient(profile('a', 42)).telegramId, 42);
  assert.equal(toRecipient({ id: 'b', email: 'x@y.uz', onboarding_data: { telegram_id: '77' } }).telegramId, 77);
  assert.equal(toRecipient({ id: 'c', email: 'x@y.uz', onboarding_data: {} }), null);
  assert.equal(toRecipient({ id: 'd', first_name: 'Foydalanuvchi', email: 'tg_5@telegram.uzhamyon.uz' }).firstName, 'aziz foydalanuvchi');
});

// ── #35 user lookup ──────────────────────────────────────────────────────────
function fakeAdmin({ profileId = null, rpc = { data: null, error: { message: 'function missing' } }, pages = [] }) {
  const listCalls = [];
  return {
    listCalls,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profileId ? { id: profileId } : null }) }) }) }),
    rpc: async () => rpc,
    auth: {
      admin: {
        listUsers: async ({ page, perPage }) => {
          listCalls.push({ page, perPage });
          return { data: { users: pages[page - 1] || [] }, error: null };
        },
      },
    },
  };
}

test('#35 finds a user on a later page when the RPC is missing', async () => {
  const pages = [
    [{ id: '1', email: 'a@x' }, { id: '2', email: 'b@x' }],
    [{ id: '3', email: 'c@x' }, { id: '4', email: 'tg_9@telegram.uzhamyon.uz' }],
    [{ id: '5', email: 'e@x' }],
  ];
  const admin = fakeAdmin({ pages });
  assert.equal(await findAuthUserIdByEmail(admin, 'TG_9@telegram.uzhamyon.uz', { perPage: 2 }), '4');
  assert.deepEqual(admin.listCalls.map((c) => c.page), [1, 2]);
  const admin2 = fakeAdmin({ pages });
  assert.equal(await findAuthUserIdByEmail(admin2, 'nobody@x', { perPage: 2 }), undefined);
  assert.deepEqual(admin2.listCalls.map((c) => c.page), [1, 2, 3]);
});

test('#35 uses profiles first, then the RPC, without listing users', async () => {
  const a = fakeAdmin({ profileId: 'p1' });
  assert.equal(await findAuthUserIdByEmail(a, 'x@y'), 'p1');
  const b = fakeAdmin({ rpc: { data: 'r1', error: null } });
  assert.equal(await findAuthUserIdByEmail(b, 'x@y'), 'r1');
  assert.equal(b.listCalls.length, 0);
});

// ── First-entry reminders for people who never logged ─────────────────────────
test('shouldRemindToday: loggers daily; never-logged on day 1, 3, 7, then weekly', () => {
  assert.equal(shouldRemindToday({ hasLogged: true, daysSinceSignup: 2 }), true);
  assert.equal(shouldRemindToday({ hasLogged: undefined, daysSinceSignup: 2 }), true);
  assert.equal(shouldRemindToday({ hasLogged: false, daysSinceSignup: undefined }), true);
  const days = [0, 1, 2, 3, 4, 5, 6, 7, 8, 13, 14, 15, 21, 30];
  assert.deepEqual(
    days.filter((d) => shouldRemindToday({ hasLogged: false, daysSinceSignup: d })),
    [1, 3, 7, 14, 21]
  );
});

test('reminder loop skips left-out recipients without sending or marking them', async () => {
  const sentTo = [];
  const marked = [];
  const rows = [profile('a', 1), { ...profile('b', 2), has_logged: false }];
  const res = await runReminderLoop({
    fetchPage: async () => ({ rows, tracking: true }),
    send: async (r) => { sentTo.push(r.telegramId); return { status: 'sent' }; },
    shouldSend: (r) => r.hasLogged !== false,
    markSent: async (ids) => { marked.push(...ids); },
    markBlocked: async () => {},
    sleep: async () => {},
    now: () => 0,
  });
  assert.deepEqual(sentTo, [1]);
  assert.deepEqual(marked, ['a']);
  assert.equal(res.skipped, 1);
});

test('first-entry message escapes the name and carries an example', () => {
  const m = buildFirstEntryReminderMessage('<Ali>');
  assert.ok(m.includes('&lt;Ali&gt;'));
  assert.ok(m.includes('<code>non 8000</code>'));
});
