/**
 * Fast replies + "delete my data" — fully offline (Telegram, Gemini, Supabase faked).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.TELEGRAM_BOT_TOKEN = '111:TEST-token';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = 'gemini-3.8-flash';
delete process.env.OPENROUTER_API_KEY;

const { shouldSendLowThinking, bodyForModel, callGeminiApi, _resetDisabledModels } =
  await import('../src/lib/ai/geminiClient.ts');
const {
  createDeletionToken, verifyDeletionToken, isDeleteDataRequest, buildDeletionPrompt, DELETE_CONFIRM_TTL_MS,
} = await import('../src/lib/telegram/accountDeletion.ts');
const { handleTelegramUpdate } = await import('../src/lib/telegram/bot.ts');
const { telegramSessionCache } = await import('../src/lib/telegram/sessionCache.ts');

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
function geminiReply(obj) {
  return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
}
async function withFetch(handler, fn) {
  const saved = globalThis.fetch;
  const silence = [console.error, console.warn, console.log];
  console.error = () => {}; console.warn = () => {}; console.log = () => {};
  _resetDisabledModels();
  globalThis.fetch = handler;
  try { return await fn(); } finally {
    globalThis.fetch = saved;
    [console.error, console.warn, console.log] = silence;
    _resetDisabledModels();
  }
}
function seedSession(tgId, userId = '00000000-0000-0000-0000-0000000000aa') {
  telegramSessionCache.set(tgId, { userId, accessToken: 'jwt', onboardingCompleted: true, expiresAtMs: Date.now() + 3600_000 });
}

// ── thinking level ───────────────────────────────────────────────────────────
test('low thinking only for explicit gemini-3.* models', () => {
  assert.equal(shouldSendLowThinking('gemini-3.8-flash'), true);
  assert.equal(shouldSendLowThinking('gemini-3.5-flash-lite'), true);
  assert.equal(shouldSendLowThinking('gemini-flash-lite-latest'), false);
  assert.equal(shouldSendLowThinking('gemini-2.5-flash'), false);
  const body = { contents: [], generationConfig: { temperature: 0.1 } };
  const withThinking = bodyForModel(body, 'gemini-3.8-flash', true);
  assert.deepEqual(withThinking.generationConfig, { temperature: 0.1, thinkingConfig: { thinkingLevel: 'LOW' } });
  assert.equal(body.generationConfig.thinkingConfig, undefined); // original untouched
  assert.equal(bodyForModel(body, 'gemini-3.8-flash', false), body);
});

test('a model that rejects thinkingConfig is retried once without it', async () => {
  const bodies = [];
  await withFetch(async (url, init) => {
    const b = JSON.parse(init.body);
    bodies.push(b);
    if (b.generationConfig?.thinkingConfig) {
      return json({ error: { message: 'Invalid JSON payload: Unknown name "thinkingConfig"' } }, 400);
    }
    return geminiReply({ ok: 1 });
  }, async () => {
    const res = await callGeminiApi({ contents: [], generationConfig: {} }, 'gemini-3.9-test', 5000, { modelOrder: 'primary' });
    assert.equal(res.model, 'gemini-3.9-test');
  });
  assert.ok(bodies[0].generationConfig.thinkingConfig);
  assert.equal(bodies[1].generationConfig.thinkingConfig, undefined);
});

// ── instant reply ─────────────────────────────────────────────────────────────
test('text: instant "⏳" message, then the same message becomes the preview with ✅/❌', async () => {
  const TG = 9001;
  seedSession(TG);
  const calls = [];
  await withFetch(async (url, init) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push(u.replace(/^https:\/\/[^/]+/, ''));
    if (u.endsWith('/sendChatAction')) return json({ ok: true, result: true });
    if (u.endsWith('/sendMessage')) return json({ ok: true, result: { message_id: 55, text: body.text } });
    if (u.endsWith('/editMessageText')) { calls.push({ edit: body }); return json({ ok: true, result: {} }); }
    if (u.includes('/rest/v1/categories')) return json([{ id: 'c1', name: 'Dining Out', type: 'expense', is_system: true, user_id: null }]);
    if (u.includes('/rest/v1/pending_ai_actions')) {
      const now = new Date().toISOString();
      return json({ ...body, id: 'r', status: 'pending', retry_count: 0, created_at: now, updated_at: now, expires_at: new Date(Date.now() + 9e5).toISOString() }, 201);
    }
    if (u.includes('generativelanguage')) {
      return geminiReply({ intent: 'action_proposal', actions: [{ actionType: 'create_transaction', amount: 45000, description: 'Tushlik', categoryName: 'Kafeler va Restoranlar' }], summaryUzbek: 'Tushlik: 45 000 so‘m' });
    }
    throw new Error('unexpected ' + u);
  }, async () => {
    await handleTelegramUpdate({
      update_id: 10,
      message: { message_id: 1, from: { id: TG, is_bot: false, first_name: 'A' }, chat: { id: TG, type: 'private' }, date: 0, text: 'tushlik 45 ming' },
    });
  });
  const firstSend = calls.findIndex((c) => c === '/bot111:TEST-token/sendMessage');
  const firstGemini = calls.findIndex((c) => typeof c === 'string' && c.includes(':generateContent'));
  assert.ok(firstSend >= 0 && firstSend < firstGemini, 'the "⏳" message goes out before the AI call');
  const edit = calls.find((c) => c.edit)?.edit;
  assert.equal(edit.message_id, 55);
  assert.match(edit.text, /Tushlik: 45 000 so‘m/);
  assert.match(edit.reply_markup.inline_keyboard[0][0].callback_data, /^act_confirm:/);
  assert.ok(!calls.some((c) => typeof c === 'string' && c.includes('/rest/v1/transactions')), 'nothing saved before ✅');
  telegramSessionCache.delete(TG);
});

// ── delete my data ────────────────────────────────────────────────────────────
test('deletion token: valid 5 minutes, only for the same user, tamper-proof', () => {
  const now = 1_800_000_000_000;
  const token = createDeletionToken(42, now);
  assert.ok(`acct_del:${token}`.length <= 64);
  assert.equal(verifyDeletionToken(token, 42, now + 1000), 'ok');
  assert.equal(verifyDeletionToken(token, 42, now + DELETE_CONFIRM_TTL_MS + 1), 'expired');
  assert.equal(verifyDeletionToken(token, 43, now), 'invalid');
  assert.equal(verifyDeletionToken(token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 42, now), 'invalid');
  assert.equal(verifyDeletionToken('garbage', 42, now), 'invalid');
});

test('delete request detection and prompt', () => {
  assert.equal(isDeleteDataRequest('/delete'), true);
  assert.equal(isDeleteDataRequest('/delete@uz_hamyonbot'), true);
  assert.equal(isDeleteDataRequest("Ma'lumotlarimni o'chir"), true);
  assert.equal(isDeleteDataRequest('oxirgi xarajatni o‘chir'), false);
  const p = buildDeletionPrompt({ transactions: 12, goals: 2, budgets: 1, categories: 0 });
  assert.match(p, /12 ta tranzaksiya/);
  assert.match(p, /qaytarib bo‘lmaydi/);
});

test('/delete → counts + buttons; ✅ deletes the auth user; ❌ keeps everything', async () => {
  const TG = 7007;
  seedSession(TG, '00000000-0000-0000-0000-000000007007');
  const sent = [];
  const edits = [];
  const deletes = [];
  const fake = async (url, init) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(init.body) : undefined;
    if (u.endsWith('/sendChatAction') || u.endsWith('/answerCallbackQuery')) return json({ ok: true, result: true });
    if (u.endsWith('/sendMessage')) { sent.push(body); return json({ ok: true, result: { message_id: 3 } }); }
    if (u.endsWith('/editMessageText')) { edits.push(body); return json({ ok: true, result: {} }); }
    if (u.includes('/rest/v1/') && init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '0-0/3' } });
    if (u.includes('/rest/v1/profiles')) return json({ id: '00000000-0000-0000-0000-000000007007' });
    if (u.includes('/auth/v1/admin/users/00000000-0000-0000-0000-000000007007') && init?.method === 'DELETE') { deletes.push(u); return json({}); }
    throw new Error('unexpected ' + init?.method + ' ' + u);
  };

  await withFetch(fake, () => handleTelegramUpdate({
    update_id: 20,
    message: { message_id: 2, from: { id: TG, is_bot: false, first_name: 'A' }, chat: { id: TG, type: 'private' }, date: 0, text: '/delete' },
  }));
  assert.match(sent[0].text, /3 ta tranzaksiya/);
  const confirmData = sent[0].reply_markup.inline_keyboard[0][0].callback_data;
  assert.match(confirmData, /^acct_del:/);
  assert.equal(sent[0].reply_markup.inline_keyboard[1][0].callback_data, 'acct_del_no');
  assert.equal(deletes.length, 0, 'nothing deleted before confirmation');

  // Someone else pressing the button cannot delete this account.
  await withFetch(fake, () => handleTelegramUpdate({
    update_id: 21,
    callback_query: { id: 'cb0', from: { id: 1234, is_bot: false, first_name: 'X' }, message: { message_id: 3, chat: { id: TG, type: 'private' }, date: 0 }, data: confirmData },
  }));
  assert.equal(deletes.length, 0);
  assert.match(edits.at(-1).text, /tegishli emas/);

  await withFetch(fake, () => handleTelegramUpdate({
    update_id: 22,
    callback_query: { id: 'cb1', from: { id: TG, is_bot: false, first_name: 'A' }, message: { message_id: 3, chat: { id: TG, type: 'private' }, date: 0 }, data: confirmData },
  }));
  assert.equal(deletes.length, 1);
  assert.match(edits.at(-2).text, /o‘chirilmoqda/);
  assert.match(edits.at(-1).text, /Barcha ma’lumotlaringiz o‘chirildi/);
  assert.equal(telegramSessionCache.get(TG), undefined, 'cached session forgotten');

  await withFetch(fake, () => handleTelegramUpdate({
    update_id: 23,
    callback_query: { id: 'cb2', from: { id: TG, is_bot: false, first_name: 'A' }, message: { message_id: 3, chat: { id: TG, type: 'private' }, date: 0 }, data: 'acct_del_no' },
  }));
  assert.match(edits.at(-1).text, /Bekor qilindi/);
  assert.equal(deletes.length, 1);
});
