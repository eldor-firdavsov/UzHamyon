/**
 * Phase 1A security tests — fully offline (no Supabase, Telegram or Gemini calls).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { escapeHtml } from '../src/lib/telegram/html.ts';
import { safeEqual } from '../src/lib/env.ts';
import { isTelegramWebhookAuthorized, isCronAuthorized } from '../src/lib/telegram/requestAuth.ts';
import { deriveTelegramCredentials } from '../src/lib/telegram/auth.ts';
import { describeResolvedPendingAction } from '../src/lib/telegram/bot.ts';

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  const silence = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = silence;
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('#6 escapeHtml escapes &, <, > and quotes', () => {
  assert.equal(escapeHtml('Ali & <Vali> "x"'), 'Ali &amp; &lt;Vali&gt; &quot;x&quot;');
  assert.equal(escapeHtml('<a href="https://evil">click</a>'), '&lt;a href=&quot;https://evil&quot;&gt;click&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(45000), '45000');
  assert.equal(escapeHtml("O‘zbekiston so'm"), "O‘zbekiston so'm");
});

test('safeEqual compares strings exactly', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual(null, 'abc'), false);
  assert.equal(safeEqual(undefined, undefined), false);
});

test('#1 webhook: production rejects every update when the secret is missing', () => {
  withEnv({ NODE_ENV: 'production', TELEGRAM_WEBHOOK_SECRET: undefined }, () => {
    assert.equal(isTelegramWebhookAuthorized(undefined), false);
    assert.equal(isTelegramWebhookAuthorized('anything'), false);
  });
});

test('#1 webhook: wrong or missing header is rejected, correct header accepted', () => {
  withEnv({ NODE_ENV: 'production', TELEGRAM_WEBHOOK_SECRET: 'test_secret_123' }, () => {
    assert.equal(isTelegramWebhookAuthorized(null), false);
    assert.equal(isTelegramWebhookAuthorized('wrong'), false);
    assert.equal(isTelegramWebhookAuthorized('test_secret_123'), true);
  });
});

test('#1 webhook: development without a secret is allowed', () => {
  withEnv({ NODE_ENV: 'development', TELEGRAM_WEBHOOK_SECRET: undefined }, () => {
    assert.equal(isTelegramWebhookAuthorized(null), true);
  });
});

test('#2/#3 cron: no allow-all fallback in production', () => {
  withEnv({ NODE_ENV: 'production', CRON_SECRET: undefined, TELEGRAM_WEBHOOK_SECRET: undefined }, () => {
    assert.equal(isCronAuthorized(null), false);
    assert.equal(isCronAuthorized('Bearer '), false);
  });
});

test('#2/#3 cron: only the exact bearer secret is accepted', () => {
  withEnv({ NODE_ENV: 'production', CRON_SECRET: 'cron_abc' }, () => {
    assert.equal(isCronAuthorized(null), false);
    assert.equal(isCronAuthorized('cron_abc'), false);
    assert.equal(isCronAuthorized('Bearer wrong'), false);
    assert.equal(isCronAuthorized('Bearer cron_abc'), true);
  });
});

test('#4 derived Telegram password formula is unchanged', () => {
  const serviceKey = 'test-service-role-key';
  const botToken = '123456:TEST-bot-token';
  withEnv({ SUPABASE_SERVICE_ROLE_KEY: serviceKey, TELEGRAM_BOT_TOKEN: botToken }, () => {
    const telegramId = 987654321;
    const expected = crypto
      .createHmac('sha256', `${serviceKey}:${botToken}`)
      .update(`tg_user_auth_identity_${telegramId}`)
      .digest('hex');
    const creds = deriveTelegramCredentials(telegramId);
    assert.equal(creds.internalEmail, 'tg_987654321@telegram.uzhamyon.uz');
    assert.equal(creds.internalPassword, expected);
    // Fixed vector: catches any accidental change to the formula itself.
    assert.equal(
      creds.internalPassword,
      crypto.createHmac('sha256', 'test-service-role-key:123456:TEST-bot-token')
        .update('tg_user_auth_identity_987654321').digest('hex')
    );
  });
});

test('#4 no hard-coded salt: missing service role key throws', () => {
  withEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined, TELEGRAM_BOT_TOKEN: '123:abc' }, () => {
    assert.throws(() => deriveTelegramCredentials(1), /SUPABASE_SERVICE_ROLE_KEY/);
  });
});

function record(overrides) {
  return {
    actionId: 'act_1', userId: 'u1', intent: 'action_proposal', actions: [], previewUzbek: '',
    status: 'pending', retryCount: 0, createdAt: 0, updatedAt: 0, expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

test('#11 resolved actions show the real status', () => {
  assert.match(
    describeResolvedPendingAction(record({ status: 'executed', resultMessage: '✅ Muvaffaqiyatli bajarildi:\n• <Tushlik>' })),
    /&lt;Tushlik&gt;/
  );
  assert.match(describeResolvedPendingAction(record({ status: 'executed' })), /allaqachon saqlangan/);
  assert.match(describeResolvedPendingAction(record({ status: 'cancelled' })), /bekor qilingan/);
  assert.match(describeResolvedPendingAction(record({ status: 'pending', expiresAt: Date.now() - 1 })), /muddati tugagan/);
  assert.match(describeResolvedPendingAction(record({ status: 'expired' })), /muddati tugagan/);
  assert.doesNotMatch(describeResolvedPendingAction(record({ status: 'cancelled' })), /saqlandi/);
});
