import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyTelegramWebAppData, getOrCreateTelegramUser } from '../src/lib/telegram/auth.ts';
import { isReturningTelegramUser } from '../src/lib/telegram/bot.ts';

// Never embed the production bot token in source. Integration runs must supply
// the real token via the environment; a dummy is used otherwise so the HMAC
// unit checks can still run offline.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-only-token-not-real';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://omzreoaaownshtzpqsdt.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function generateSignedInitData(tgUser, options = {}) {
  const authDate = options.authDate ?? Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    auth_date: authDate.toString(),
    query_id: 'AAHdF6IQAAAAAN0XohC0-test',
    user: JSON.stringify(tgUser),
  });

  const items = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = items.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', options.tamperHash ? 'tampered_invalid_hash_1234567890' : hash);
  return params.toString();
}

test(
  '1. Telegram Bot Profile & Commands Live API Verification',
  { skip: !process.env.TELEGRAM_BOT_TOKEN && 'TELEGRAM_BOT_TOKEN is not configured' },
  async () => {
  const get = async (method) => {
    for (let i = 0; i < 3; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return await res.json();
      } catch (err) {
        if (i === 2) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  };

  const nameRes = await get('getMyName');
  assert.equal(nameRes.ok, true);
  assert.equal(nameRes.result.name, 'UzHamyon');

  const descRes = await get('getMyDescription');
  assert.equal(descRes.ok, true);
  assert.match(descRes.result.description, /shaxsiy moliyangizni boshqarish/i);

  const shortDescRes = await get('getMyShortDescription');
  assert.equal(shortDescRes.ok, true);
  assert.match(shortDescRes.result.short_description, /Daromad va xarajatlar nazorati/i);

  const cmdRes = await get('getMyCommands');
  assert.equal(cmdRes.ok, true);
  const commands = cmdRes.result.map((c) => c.command);
  assert.ok(commands.includes('start'), 'Should have /start');
  assert.ok(commands.includes('app'), 'Should have /app');
  assert.ok(commands.includes('help'), 'Should have /help');
  assert.ok(commands.includes('about'), 'Should have /about');

  const menuRes = await get('getChatMenuButton');
  assert.equal(menuRes.ok, true);
  assert.equal(menuRes.result.type, 'web_app');
  assert.equal(menuRes.result.web_app.url, 'https://uzhamyon.vercel.app/');
});

test('2. Telegram HMAC-SHA256 Cryptographic Verification', async () => {
  const testUser = { id: 777123456, first_name: 'Alisher', username: 'alisher_uz' };

  // Valid payload
  const validData = generateSignedInitData(testUser);
  const verified = verifyTelegramWebAppData(validData, BOT_TOKEN);
  assert.equal(verified.valid, true);
  assert.equal(verified.user?.id, 777123456);
  assert.equal(verified.user?.first_name, 'Alisher');

  // Tampered payload
  const tamperedData = validData.replace('Alisher', 'Attacker');
  const tamperResult = verifyTelegramWebAppData(tamperedData, BOT_TOKEN);
  assert.equal(tamperResult.valid, false);
  assert.match(tamperResult.error, /mismatch/i);

  // Expired payload (> 24 hours ago)
  const expiredData = generateSignedInitData(testUser, { authDate: Math.floor(Date.now() / 1000) - 90000 });
  const expiredResult = verifyTelegramWebAppData(expiredData, BOT_TOKEN);
  assert.equal(expiredResult.valid, false);
  assert.match(expiredResult.error, /expired/i);

  // Missing hash
  const noHashResult = verifyTelegramWebAppData('auth_date=12345&user={}', BOT_TOKEN);
  assert.equal(noHashResult.valid, false);
  assert.match(noHashResult.error, /hash/i);
});

test(
  '3. Telegram Authentication: New User Flow (No Email/Password Required)',
  { skip: (!SERVICE_KEY || !ANON_KEY) && 'Supabase service/anon keys are not configured' },
  async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const uniqueTgId = Math.floor(100000000 + Math.random() * 900000000);
  const testUser = {
    id: uniqueTgId,
    first_name: 'Dilshod',
    last_name: 'Karimov',
    username: 'dilshod_k',
  };

  let createdUserId = null;

  try {
    // 1. Initial auth -> New User
    const res = await getOrCreateTelegramUser(testUser);
    assert.equal(res.success, true);
    assert.equal(res.isNewUser, true);
    assert.equal(res.onboarding_completed, false);
    assert.ok(res.session?.access_token, 'Must return valid Supabase JWT');
    assert.ok(res.user?.id, 'Must return Supabase user ID');
    createdUserId = res.user.id;

    // Verify user in Supabase auth
    const { data: authUserData } = await admin.auth.admin.getUserById(createdUserId);
    assert.ok(authUserData?.user, 'User must exist in auth.users');
    assert.equal(authUserData.user.user_metadata.telegram_id, uniqueTgId);

    // Verify profile in public.profiles
    const { data: profile } = await admin.from('profiles').select('*').eq('id', createdUserId).single();
    assert.equal(profile.first_name, 'Dilshod');
    assert.equal(profile.onboarding_completed, false);

    // Check returning status before onboarding
    const isRetBefore = await isReturningTelegramUser(uniqueTgId);
    assert.equal(isRetBefore, false, 'Should not be marked returning until onboarding is completed');

    // 2. Complete financial-goals onboarding
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${res.session.access_token}` } },
      auth: { persistSession: false },
    });

    const { error: obErr } = await client
      .from('profiles')
      .update({
        first_name: 'Dilshodbek',
        onboarding_completed: true,
        onboarding_data: {
          telegram_id: uniqueTgId,
          goals: ['track_expenses', 'save_more'],
        },
      })
      .eq('id', createdUserId);
    assert.equal(obErr, null, 'Updating onboarding status must succeed under RLS');

    // 3. Returning User test: same telegram user calls again
    const res2 = await getOrCreateTelegramUser(testUser);
    assert.equal(res2.success, true);
    assert.equal(res2.isNewUser, false, 'Must be identified as returning user');
    assert.equal(res2.user.id, createdUserId, 'Must return identical stable user ID');
    assert.equal(res2.onboarding_completed, true, 'Must preserve onboarding_completed');

    // Check returning status after onboarding
    const isRetAfter = await isReturningTelegramUser(uniqueTgId);
    assert.equal(isRetAfter, true, 'Must be recognized as returning user by bot');
  } finally {
    // 4. Clean up test user so production database remains pristine
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId);
    }
  }
});

test(
  '4. Data Isolation & Row Level Security for Telegram Users',
  { skip: (!SERVICE_KEY || !ANON_KEY) && 'Supabase service/anon keys are not configured' },
  async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tgIdA = Math.floor(100000000 + Math.random() * 900000000);
  const tgIdB = Math.floor(100000000 + Math.random() * 900000000);

  let userAId = null;
  let userBId = null;

  try {
    const userA = await getOrCreateTelegramUser({ id: tgIdA, first_name: 'UserA' });
    const userB = await getOrCreateTelegramUser({ id: tgIdB, first_name: 'UserB' });
    userAId = userA.user.id;
    userBId = userB.user.id;

    // Client for User A
    const clientA = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userA.session.access_token}` } },
      auth: { persistSession: false },
    });

    // Client for User B
    const clientB = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userB.session.access_token}` } },
      auth: { persistSession: false },
    });

    // User A creates a transaction
    const { data: txA, error: txAErr } = await clientA
      .from('transactions')
      .insert({
        user_id: userAId,
        amount: 250000,
        type: 'expense',
        description: 'Telegram Test Expense A',
        transaction_date: '2026-11-02',
      })
      .select()
      .single();

    assert.equal(txAErr, null);
    assert.ok(txA?.id);

    // User B attempts to read User A's transaction
    const { data: readByB } = await clientB
      .from('transactions')
      .select('*')
      .eq('id', txA.id);

    assert.equal(readByB.length, 0, 'User B must NOT see User A transactions under RLS');

    // Clean up transaction
    await clientA.from('transactions').delete().eq('id', txA.id);
  } finally {
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  }
});
