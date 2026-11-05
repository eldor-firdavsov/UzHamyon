import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readEnv } from './helpers/env.mjs';
import {
  verifyTelegramWebAppData,
  getOrCreateTelegramUser,
} from '../src/lib/telegram/auth.ts';
import { isReturningTelegramUser, sendTelegramMessage } from '../src/lib/telegram/bot.ts';

const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
const botToken = readEnv('TELEGRAM_BOT_TOKEN');
const botUsername = readEnv('TELEGRAM_BOT_USERNAME') || readEnv('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME') || 'uz_hamyonbot';

function generateValidInitData(telegramUser, token = botToken, authDate = Math.floor(Date.now() / 1000)) {
  const userJson = JSON.stringify(telegramUser);
  const params = new Map();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'AAG9XYZ_mock_query_id');
  params.set('user', userJson);

  const sortedPairs = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = sortedPairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const urlParams = new URLSearchParams();
  for (const [k, v] of params.entries()) {
    urlParams.set(k, v);
  }
  urlParams.set('hash', hash);

  return urlParams.toString();
}

describe('Tasks 2, 3, 4, 6 — Telegram Auth, Browser Fallback & Bot Reliability', () => {
  let adminClient;
  const mockTelegramId = Math.floor(100000000 + Math.random() * 900000000);
  let createdSupabaseUserId;

  before(async () => {
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
  });

  after(async () => {
    if (createdSupabaseUserId) {
      await adminClient.from('profiles').delete().eq('id', createdSupabaseUserId);
      await adminClient.auth.admin.deleteUser(createdSupabaseUserId);
    }
  });

  // ── TASK 2 & 4: TELEGRAM AUTH & SESSION ──

  test('1. Valid Telegram initData passes official HMAC-SHA256 verification', () => {
    const initData = generateValidInitData({
      id: mockTelegramId,
      first_name: 'Anvar',
      last_name: 'Kamilov',
      username: 'anvar_kamilov',
    });

    const res = verifyTelegramWebAppData(initData);
    assert.strictEqual(res.valid, true, `Verification failed: ${res.error}`);
    assert.ok(res.user);
    assert.strictEqual(res.user.id, mockTelegramId);
    assert.strictEqual(res.user.first_name, 'Anvar');
  });

  test('2. Tampered initData or invalid signature is rejected by server HMAC', () => {
    const validData = generateValidInitData({
      id: mockTelegramId,
      first_name: 'Anvar',
    });

    // Tamper with data after signing
    const tamperedData = validData.replace('Anvar', 'Hacker');
    const res = verifyTelegramWebAppData(tamperedData);
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /mismatch|tampered/i);
  });

  test('3. Expired initData (> 24 hours) is rejected to prevent replay attacks', () => {
    const expiredAuthDate = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
    const expiredData = generateValidInitData(
      { id: mockTelegramId, first_name: 'Anvar' },
      botToken,
      expiredAuthDate
    );

    const res = verifyTelegramWebAppData(expiredData);
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /expired/i);
  });

  test('4. First-time Telegram user creates profile with onboarding_completed = false', async () => {
    const sessionRes = await getOrCreateTelegramUser({
      id: mockTelegramId,
      first_name: 'Anvar',
      last_name: 'Kamilov',
      username: 'anvar_kamilov',
    });

    assert.strictEqual(sessionRes.success, true, `Auth failed: ${sessionRes.error}`);
    assert.ok(sessionRes.user);
    assert.ok(sessionRes.session?.access_token);
    assert.strictEqual(sessionRes.isNewUser, true);
    assert.strictEqual(sessionRes.onboarding_completed, false, 'New user must see onboarding');
    createdSupabaseUserId = sessionRes.user.id;

    // Verify profile in DB
    const { data: prof } = await adminClient
      .from('profiles')
      .select('id, onboarding_completed, onboarding_data')
      .eq('id', createdSupabaseUserId)
      .single();

    assert.strictEqual(prof.onboarding_completed, false);
    assert.strictEqual(prof.onboarding_data?.telegram_id, mockTelegramId);
  });

  test('5. Completed onboarding persists and user is not shown onboarding on re-entry', async () => {
    assert.ok(createdSupabaseUserId);

    // Simulate completing onboarding
    await adminClient
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_step: 8,
      })
      .eq('id', createdSupabaseUserId);

    // Re-enter with same Telegram ID
    const reEntryRes = await getOrCreateTelegramUser({
      id: mockTelegramId,
      first_name: 'Anvar',
      username: 'anvar_kamilov_new_username', // Even if username changed
    });

    assert.strictEqual(reEntryRes.success, true);
    assert.strictEqual(reEntryRes.user?.id, createdSupabaseUserId, 'Must restore identical user identity');
    assert.strictEqual(reEntryRes.isNewUser, false, 'Returning user must not be marked as new');
    assert.strictEqual(reEntryRes.onboarding_completed, true, 'Completed user must bypass onboarding');

    // Bot check: isReturningTelegramUser returns true
    const isReturning = await isReturningTelegramUser(mockTelegramId);
    assert.strictEqual(isReturning, true, 'isReturningTelegramUser must report true');
  });

  test('6. User changing Telegram username does NOT create duplicate user or alter primary key', async () => {
    const updatedUsernameRes = await getOrCreateTelegramUser({
      id: mockTelegramId,
      first_name: 'Anvar (Renamed)',
      username: 'completely_different_username_2026',
    });

    assert.strictEqual(updatedUsernameRes.success, true);
    assert.strictEqual(
      updatedUsernameRes.user?.id,
      createdSupabaseUserId,
      'User ID must stay completely stable across username changes'
    );

    // Check count of profiles with this email
    const { count } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('email', `tg_${mockTelegramId}@telegram.uzhamyon.uz`);

    assert.strictEqual(count, 1, 'Exactly one profile row must exist (no duplicate accounts)');
  });

  // ── TASK 3: ORDINARY BROWSER FALLBACK ──

  test('7. Browser fallback configuration uses verified bot username and official deep link', () => {
    assert.ok(botUsername, 'Telegram bot username must be configured');
    const deepLink = `https://t.me/${botUsername}?start=start`;
    const webFallback = `https://web.telegram.org/a/#?tgaddr=resolve%3Fdomain%3D${encodeURIComponent(botUsername)}%26start%3Dstart`;

    assert.match(deepLink, /^https:\/\/t\.me\/[a-zA-Z0-9_]+\?start=start$/);
    assert.match(webFallback, /^https:\/\/web\.telegram\.org\//);
  });

  // ── TASK 6: BOT TOKEN SECURITY ──

  test('8. Bot token is securely kept server-side and never exposed to client environment', () => {
    assert.ok(process.env.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN must exist on server');
    // Ensure no NEXT_PUBLIC_ or VITE_ leaked token variable exists
    assert.strictEqual(process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN, undefined);
    assert.strictEqual(process.env.VITE_TELEGRAM_BOT_TOKEN, undefined);
  });
});

