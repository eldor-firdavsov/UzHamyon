/**
 * Languages (uz / ru / en) — fully offline. Telegram, Gemini and Supabase are faked via fetch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.TELEGRAM_BOT_TOKEN = '111:TEST-token';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = 'gemini-primary-test';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { normalizeLang, langFromTelegram, langForProfile, langFromOnboardingData } = await import('../src/lib/i18n/config.ts');
const { getDict } = await import('../src/lib/i18n/dict/index.ts');
const { botTexts, describeExecutedActions, describeProposal } = await import('../src/lib/i18n/bot.ts');
const { relativeDay, dayAndMonth, categoryLabel, formatMoneyIn, shortDateWithYear } = await import('../src/lib/i18n/format.ts');
const { isUserConfirmation, isUserCancellation } = await import('../src/lib/ai/pendingActionStore.ts');
const { isDeleteDataRequest, buildDeletionPrompt } = await import('../src/lib/telegram/accountDeletion.ts');
const { toRecipient, buildTransactionReminderMessage } = await import('../src/lib/telegram/reminders.ts');
const { dayLabel } = await import('../src/lib/time/dayLabel.ts');
const { extractFinancialActions } = await import('../src/lib/ai/actionExtractionEngine.ts');
const { _resetDisabledModels } = await import('../src/lib/ai/geminiClient.ts');
const { handleTelegramUpdate } = await import('../src/lib/telegram/bot.ts');
const { telegramSessionCache } = await import('../src/lib/telegram/sessionCache.ts');

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
async function withFetch(handler, fn) {
  const saved = globalThis.fetch;
  const silence = [console.error, console.warn, console.log];
  console.error = () => {};
  console.warn = () => {};
  console.log = () => {};
  _resetDisabledModels();
  globalThis.fetch = handler;
  try {
    return await fn();
  } finally {
    globalThis.fetch = saved;
    [console.error, console.warn, console.log] = silence;
    _resetDisabledModels();
  }
}

/** Every key path of an object; functions count as leaves. */
function shape(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? shape(v, `${prefix}${k}.`) : [`${prefix}${k}:${Array.isArray(v) ? `array${v.length}` : typeof v}`]
  ).sort();
}

test('the three app dictionaries have exactly the same keys', () => {
  const uz = shape(getDict('uz'));
  assert.deepEqual(shape(getDict('ru')), uz);
  assert.deepEqual(shape(getDict('en')), uz);
});

test('the three bot text sets have exactly the same keys', () => {
  const uz = shape(botTexts('uz'));
  assert.deepEqual(shape(botTexts('ru')), uz);
  assert.deepEqual(shape(botTexts('en')), uz);
});

test('language helpers: stored choice wins; existing users stay Uzbek; Telegram code only guesses', () => {
  assert.equal(normalizeLang('ru'), 'ru');
  assert.equal(normalizeLang('EN-us'), 'en');
  assert.equal(normalizeLang('de'), null);
  assert.equal(langFromTelegram('ru'), 'ru');
  assert.equal(langFromTelegram('uk'), 'ru');
  assert.equal(langFromTelegram('uz'), 'uz');
  assert.equal(langFromTelegram('de'), 'en');
  assert.equal(langFromTelegram(undefined), 'uz');
  assert.equal(langForProfile({ language: 'en', language_code: 'ru' }), 'en');
  assert.equal(langForProfile({ language_code: 'ru' }), 'uz');
  assert.equal(langForProfile(null), 'uz');
  assert.equal(langFromOnboardingData({ language: 'xx' }), null);
});

test('dates, money and built-in category names follow the language; own categories stay as typed', () => {
  assert.equal(relativeDay('2026-11-24', '2026-11-24', 'ru'), 'Сегодня');
  assert.equal(relativeDay('2026-11-23', '2026-11-24', 'en'), 'Yesterday');
  assert.equal(relativeDay('2026-11-18', '2026-11-24', 'uz'), '18-noy');
  assert.equal(relativeDay('2025-12-31', '2026-11-24', 'en'), 'Dec 31, 2025');
  assert.equal(dayAndMonth('2026-11-18', 'ru'), '18 ноября');
  assert.equal(shortDateWithYear('2026-12-31', 'uz'), '31-dek 2026');
  // dayLabel keeps its old Uzbek output by default
  assert.equal(dayLabel('2026-11-24', '2026-11-24'), 'Bugun');
  assert.equal(dayLabel('2025-01-05', '2026-11-24'), '5-yan 2025');
  assert.equal(formatMoneyIn(45000, 'UZS', 'ru'), '45 000 сум');
  assert.equal(formatMoneyIn(45000, 'UZS', 'uz'), '45 000 so‘m');
  assert.equal(formatMoneyIn(12.5, 'USD', 'en'), '$12.50');
  assert.equal(categoryLabel('Oziq-ovqat', 'ru'), 'Продукты');
  assert.equal(categoryLabel("Ko‘ngilochar", 'en'), 'Entertainment'); // apostrophe variants
  assert.equal(categoryLabel('Groceries', 'uz'), 'Oziq-ovqat'); // English DB row name
  assert.equal(categoryLabel('Mening toifam', 'ru'), 'Mening toifam');
});

test('bot: executed / proposal texts; Uzbek wording is unchanged', () => {
  const tx = [{ actionType: 'create_transaction', transactionType: 'expense', amount: 45000, currency: 'UZS', description: 'Tushlik' }];
  assert.equal(describeProposal(tx, 'uz'), '45 000 so‘m miqdorida xarajatni («Tushlik») qayd etishni tasdiqlaysizmi?');
  assert.equal(describeProposal(tx, 'ru'), 'Записать расход 45 000 сум («Tushlik»)?');
  assert.equal(describeExecutedActions(tx, 'en'), '✅ Done:\n• Tushlik (expense 45 000 UZS)');
  const many = [...tx, { ...tx[0], description: 'Taksi', amount: 15000 }];
  assert.match(describeProposal(many, 'uz'), /^Quyidagi 2 ta operatsiyani qayd etishni tasdiqlaysizmi\?\n\n1\. Tushlik \(Xarajat\): 45 000 so‘m/);
});

test('typed confirm / cancel words work in Russian too; "ok" is not a confirmation', () => {
  assert.ok(isUserConfirmation('Да'));
  assert.ok(isUserConfirmation('подтверждаю'));
  assert.ok(isUserConfirmation('ha'));
  assert.ok(!isUserConfirmation('ok'));
  assert.ok(isUserCancellation('Отмена'));
  assert.ok(isUserCancellation('нет'));
  assert.ok(isUserCancellation('bekor'));
});

test('delete-my-data: Russian / English phrases and a translated prompt', () => {
  assert.ok(isDeleteDataRequest('удалить мои данные'));
  assert.ok(isDeleteDataRequest('Delete my data'));
  assert.ok(isDeleteDataRequest('/delete'));
  const counts = { transactions: 3, goals: 1, budgets: 0, categories: 2 };
  assert.match(buildDeletionPrompt(counts, 'ru'), /Удалить все ваши данные/);
  assert.match(buildDeletionPrompt(counts), /o‘chirmoqchimisiz/);
});

test('reminders go out in each recipient’s language', () => {
  const ru = toRecipient({ id: 'a', email: 'tg_5@telegram.uzhamyon.uz', first_name: 'Иван', onboarding_data: { language: 'ru' } });
  assert.equal(ru.lang, 'ru');
  assert.match(buildTransactionReminderMessage(ru.firstName, ru.lang), /^Привет, <b>Иван<\/b>/);
  const old = toRecipient({ id: 'b', email: 'tg_6@telegram.uzhamyon.uz', first_name: 'Ali', onboarding_data: { language_code: 'en' } });
  assert.equal(old.lang, 'uz');
});

test('extraction asks the AI to write previews in the user’s language', async () => {
  let systemText = '';
  await withFetch(async (url, init) => {
    systemText = JSON.parse(init.body).system_instruction.parts[0].text;
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: 'action_proposal', actions: [{ actionType: 'create_transaction', transactionType: 'expense', amount: 20000, description: 'такси' }] }) }] } }] });
  }, async () => {
    const res = await extractFinancialActions('такси 20000', { language: 'ru' });
    // No AI summary given → the built-in preview, in Russian.
    assert.equal(res.summaryUzbek, 'Записать расход 20 000 сум («такси»)?');
  });
  assert.match(systemText, /^OUTPUT LANGUAGE: the user reads RUSSIAN/);

  await withFetch(async (url, init) => {
    systemText = JSON.parse(init.body).system_instruction.parts[0].text;
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: 'casual_chat', actions: [] }) }] } }] });
  }, async () => {
    await extractFinancialActions('salom');
  });
  assert.doesNotMatch(systemText, /OUTPUT LANGUAGE/);
});

test('bot /start without a chosen language shows the picker; picking one saves it and greets in it', async () => {
  const TG_ID = 9191;
  telegramSessionCache.set(TG_ID, {
    userId: '00000000-0000-0000-0000-000000000009',
    accessToken: 'test-jwt',
    onboardingCompleted: false,
    expiresAtMs: Date.now() + 3600_000,
  });
  const sent = [];
  const edits = [];
  let savedProfile;
  await withFetch(async (url, init) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(init.body) : undefined;
    if (u.endsWith('/sendChatAction') || u.endsWith('/setChatMenuButton') || u.endsWith('/answerCallbackQuery')) return json({ ok: true, result: true });
    if (u.endsWith('/sendMessage')) { sent.push(body); return json({ ok: true, result: { message_id: 5 } }); }
    if (u.endsWith('/editMessageText')) { edits.push(body); return json({ ok: true, result: {} }); }
    if (u.includes('/rest/v1/profiles') && (!init?.method || init.method === 'GET')) return json({ onboarding_data: { telegram_id: TG_ID } });
    if (u.includes('/rest/v1/profiles') && init.method === 'PATCH') { savedProfile = body; return json([]); }
    if (u.includes('/rest/v1/')) return json([]);
    throw new Error('unexpected fetch ' + u);
  }, async () => {
    await handleTelegramUpdate({
      update_id: 1,
      message: { message_id: 1, from: { id: TG_ID, is_bot: false, first_name: 'Anna', language_code: 'en' }, chat: { id: TG_ID, type: 'private' }, date: 0, text: '/start' },
    });
    await handleTelegramUpdate({
      update_id: 2,
      callback_query: {
        id: 'cb1',
        from: { id: TG_ID, is_bot: false, first_name: 'Anna', language_code: 'en' },
        message: { message_id: 5, chat: { id: TG_ID, type: 'private' }, date: 0, text: 'pick' },
        data: 'lang:ru',
      },
    });
  });

  const picker = sent[0];
  assert.match(picker.text, /Tilni tanlang/);
  assert.deepEqual(picker.reply_markup.inline_keyboard[0].map((b) => b.callback_data), ['lang:uz', 'lang:ru', 'lang:en']);
  assert.equal(savedProfile.onboarding_data.language, 'ru');
  assert.equal(savedProfile.onboarding_data.telegram_id, TG_ID); // merged, not replaced
  assert.equal(edits[0].text, '✅ Язык: русский');
  assert.match(sent[1].text, /^<b>Здравствуйте, Anna!<\/b>/);
  assert.equal(sent[1].reply_markup.inline_keyboard[0][0].text, 'Открыть UzHamyon');
  telegramSessionCache.delete(TG_ID);
});
