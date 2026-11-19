/**
 * Phase 3A — signup source tracking (offline).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.TELEGRAM_BOT_TOKEN = '111:TEST-token';

const { sourceFromStartCommand } = await import('../src/lib/telegram/signupSource.ts');
const { handleTelegramUpdate } = await import('../src/lib/telegram/bot.ts');
const { telegramSessionCache } = await import('../src/lib/telegram/sessionCache.ts');

test('only [a-z0-9_] up to 32 characters is accepted as a source', () => {
  assert.equal(sourceFromStartCommand('/start landing_hero'), 'landing_hero');
  assert.equal(sourceFromStartCommand('/start'), 'direct');
  assert.equal(sourceFromStartCommand('/start@uz_hamyonbot insta_bio'), 'insta_bio');
  assert.equal(sourceFromStartCommand('/start Landing'), 'direct');
  assert.equal(sourceFromStartCommand('/start a-b'), 'direct');
  assert.equal(sourceFromStartCommand('/start ' + 'x'.repeat(33)), 'direct');
  assert.equal(sourceFromStartCommand('/start ' + 'x'.repeat(32)), 'x'.repeat(32));
});

test('/start <payload> stores the source only where none is stored yet', async () => {
  const TG = 3131;
  const USER = '00000000-0000-0000-0000-000000003131';
  telegramSessionCache.set(TG, { userId: USER, accessToken: 'jwt', onboardingCompleted: false, expiresAtMs: Date.now() + 3600_000 });
  const patches = [];
  const saved = globalThis.fetch;
  const silence = [console.error, console.warn];
  console.error = () => {}; console.warn = () => {};
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    if (u.includes('/rest/v1/profiles') && init?.method === 'PATCH') {
      patches.push({ url: decodeURIComponent(u), body: JSON.parse(init.body) });
      return new Response(JSON.stringify([{ id: USER }]), { status: 200 });
    }
    if (u.includes('/rest/v1/profiles')) return new Response(JSON.stringify(null), { status: 200 });
    throw new Error('unexpected ' + init?.method + ' ' + u);
  };
  try {
    await handleTelegramUpdate({
      update_id: 1,
      message: { message_id: 1, from: { id: TG, is_bot: false, first_name: 'A' }, chat: { id: TG, type: 'private' }, date: 0, text: '/start landing_hero' },
    });
  } finally {
    globalThis.fetch = saved;
    [console.error, console.warn] = silence;
    telegramSessionCache.delete(TG);
  }
  const p = patches.find((x) => x.body.signup_source);
  assert.ok(p, 'source was written');
  assert.equal(p.body.signup_source, 'landing_hero');
  assert.match(p.url, new RegExp(`id=eq\\.${USER}`));
  assert.match(p.url, /signup_source=is\.null/);
});
