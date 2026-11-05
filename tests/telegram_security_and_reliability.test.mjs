import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  verifyTelegramWebAppData,
  getOrCreateTelegramUser,
} from '../src/lib/telegram/auth.ts';
import {
  claimWebhookUpdate,
  completeWebhookUpdate,
  failWebhookUpdate,
  resetMemoryWebhookState,
} from '../src/lib/telegram/webhookIdempotency.ts';
import { readEnv, getServiceRoleKey } from './helpers/env.mjs';

const SUPABASE_URL = readEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://omzreoaaownshtzpqsdt.supabase.co';
const SERVICE_KEY = getServiceRoleKey();
const ANON_KEY = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

function createSignedInitData(tgUser, botToken, options = {}) {
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
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.append('hash', hash);
  return params.toString();
}

test('Telegram Webhook Idempotency & Concurrency Safety', async (t) => {
  resetMemoryWebhookState();

  await t.test('1. Fresh webhook update claim succeeds', async () => {
    const updateId = 900001;
    const claim = await claimWebhookUpdate(updateId, 12345, 67890);
    assert.equal(claim.canProcess, true, 'Fresh update must be claimable');
    assert.ok(claim.reason === 'fresh_claim' || claim.reason === undefined);
  });

  await t.test('2. Completed webhook update rejects duplicate re-processing', async () => {
    const updateId = 900002;
    const claim1 = await claimWebhookUpdate(updateId, 12345, 67890);
    assert.equal(claim1.canProcess, true);

    await completeWebhookUpdate(updateId);

    // Duplicate delivery arrives from Telegram
    const claim2 = await claimWebhookUpdate(updateId, 12345, 67890);
    assert.equal(claim2.canProcess, false, 'Completed update must not be processed again');
    assert.equal(claim2.isDuplicate, true);
    assert.equal(claim2.reason, 'already_completed');
  });

  await t.test('3. Concurrent delivery while still processing is blocked', async () => {
    const updateId = 900003;
    const claim1 = await claimWebhookUpdate(updateId, 12345, 67890);
    assert.equal(claim1.canProcess, true);

    // Concurrent request arrives while claim1 is in-flight
    const claim2 = await claimWebhookUpdate(updateId, 12345, 67890);
    assert.equal(claim2.canProcess, false, 'In-flight update must not be concurrently processed');
    assert.equal(claim2.reason, 'concurrent_in_progress');
  });

  await t.test('4. Failed processing allows safe retry without permanent update loss', async () => {
    const updateId = 900004;
    const claim1 = await claimWebhookUpdate(updateId, 12345, 67890);
    assert.equal(claim1.canProcess, true);

    // Simulated worker crash / error
    await failWebhookUpdate(updateId, 'Network timeout contacting external service');

    // Telegram retries delivery
    const retryClaim = await claimWebhookUpdate(updateId, 12345, 67890);
    assert.equal(retryClaim.canProcess, true, 'Failed update must be eligible for retry');
    assert.equal(retryClaim.reason, 'retry_after_failure');
  });

  await t.test('5. Stale processing lock is recovered after timeout window', async () => {
    const updateId = 900005;
    const claim1 = await claimWebhookUpdate(updateId, 12345, 67890);
    assert.equal(claim1.canProcess, true);

    // Simulate stale lock by using a mock database client with an expired timestamp
    const mockDb = {
      from(table) {
        return {
          insert: async () => ({ error: { code: '23505' } }),
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  status: 'processing',
                  created_at: new Date(Date.now() - 120 * 1000).toISOString(),
                  updated_at: new Date(Date.now() - 120 * 1000).toISOString(),
                },
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      },
    };

    const staleClaim = await claimWebhookUpdate(updateId, 12345, 67890, mockDb);
    assert.equal(staleClaim.canProcess, true, 'Stale lock (>60s) must be recovered');
    assert.equal(staleClaim.reason, 'stale_lock_recovered');
  });
});

test('Telegram Bot Token Rotation & Account Stability', async (t) => {
  const tokenA = 'mock-test-bot-token-rotation-a';
  const tokenB = 'mock-test-bot-token-rotation-b';

  const testTelegramUser = {
    id: 888777666,
    first_name: 'RotationTest',
    last_name: 'User',
    username: 'rotation_test_user',
  };

  await t.test('1. Valid token verifies initData successfully', () => {
    const initData = createSignedInitData(testTelegramUser, tokenA);
    const result = verifyTelegramWebAppData(initData, tokenA);
    assert.equal(result.valid, true);
    assert.equal(result.user?.id, testTelegramUser.id);
  });

  await t.test('2. Rotated-out old token fails HMAC verification against new token', () => {
    const oldSignedData = createSignedInitData(testTelegramUser, tokenA);
    const result = verifyTelegramWebAppData(oldSignedData, tokenB);
    assert.equal(result.valid, false, 'Payload signed with Token A must be rejected by Token B');
    assert.ok(result.error?.includes('Signature mismatch'));
  });

  await t.test('3. Returning user retains identical Supabase identity across token rotation', async () => {
    if (!SERVICE_KEY) {
      console.log('Skipping live Supabase rotation test: SERVICE_KEY missing');
      return;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const uniqueTgId = Math.floor(100000000 + Math.random() * 800000000);
    const tgUser = {
      id: uniqueTgId,
      first_name: 'RotatedUser',
      last_name: 'E2E',
      username: `rotated_${uniqueTgId}`,
    };

    let userSessionA;
    try {
      // Step A: User first signs in under current token
      userSessionA = await getOrCreateTelegramUser(tgUser);
      assert.ok(userSessionA.user?.id, 'Must produce valid user ID');
      const originalUserId = userSessionA.user.id;

      // Step B: User signs in again (returning user flow)
      const userSessionB = await getOrCreateTelegramUser(tgUser);
      assert.equal(userSessionB.user?.id, originalUserId, 'User ID must remain strictly identical');
      assert.equal(userSessionB.isNewUser, false, 'Must identify as returning user');

      // Verify no duplicate profile was created
      const { data: profiles } = await admin
        .from('profiles')
        .select('id')
        .eq('id', originalUserId);
      assert.equal(profiles?.length, 1, 'Exactly one profile row must exist');
    } finally {
      // Teardown: clean up test user
      if (userSessionA?.user?.id) {
        await admin.from('profiles').delete().eq('id', userSessionA.user.id);
        await admin.auth.admin.deleteUser(userSessionA.user.id);
      }
    }
  });

  await t.test('4. Security: Bot token and passwords are never exposed in verification errors', () => {
    const invalidData = 'auth_date=123&user=%7B%7D&hash=invalidhash00000000000000000000000000000000000000000000000000000000';
    const result = verifyTelegramWebAppData(invalidData, tokenA);
    assert.equal(result.valid, false);
    assert.ok(!result.error?.includes(tokenA), 'Error message must never contain the bot token');
  });
});
