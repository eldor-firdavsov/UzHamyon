/**
 * Phase 2 (voice) tests — fully offline. Telegram, Gemini and Supabase are faked via fetch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.TELEGRAM_BOT_TOKEN = '111:TEST-token';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = 'gemini-primary-test';
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

const { validateAudioMeta, normalizeAudioMimeType, downloadTelegramFileBase64, VOICE_MAX_SECONDS, VOICE_MESSAGES } =
  await import('../src/lib/telegram/voice.ts');
const { buildCandidateModels, _resetDisabledModels } = await import('../src/lib/ai/geminiClient.ts');
const { extractFinancialActions } = await import('../src/lib/ai/actionExtractionEngine.ts');
const { handleTelegramUpdate } = await import('../src/lib/telegram/bot.ts');
const { telegramSessionCache } = await import('../src/lib/telegram/sessionCache.ts');

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
function geminiReply(obj) {
  return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
}
async function withFetch(handler, fn) {
  const saved = globalThis.fetch;
  const silence = [console.error, console.warn, console.log];
  console.error = () => {};
  console.warn = () => {};
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

// ── limits ───────────────────────────────────────────────────────────────────
test('voice longer than 60 s, too large or unsupported is rejected before download', () => {
  assert.deepEqual(validateAudioMeta({ file_id: 'f', duration: VOICE_MAX_SECONDS + 1 }, true), { ok: false, reason: 'too_long' });
  assert.deepEqual(validateAudioMeta({ file_id: 'f', duration: 10, file_size: 25 * 1024 * 1024 }, true), { ok: false, reason: 'too_large' });
  assert.deepEqual(validateAudioMeta({ file_id: 'f', duration: 10, mime_type: 'video/mp4' }, false), { ok: false, reason: 'unsupported_type' });
  assert.deepEqual(validateAudioMeta({ file_id: 'f', duration: 10 }, true), { ok: true, mimeType: 'audio/ogg' });
  assert.deepEqual(validateAudioMeta({ file_id: 'f', duration: 10, mime_type: 'audio/ogg' }, true), { ok: true, mimeType: 'audio/ogg' });
});

test('MIME types are mapped to the ones Gemini lists', () => {
  assert.equal(normalizeAudioMimeType('audio/x-m4a', false), 'audio/m4a');
  assert.equal(normalizeAudioMimeType('audio/mpeg', false), 'audio/mpeg');
  assert.equal(normalizeAudioMimeType('application/octet-stream', false), null);
});

// ── model order ──────────────────────────────────────────────────────────────
test('voice tries the fast lite models first, then GEMINI_MODEL; text keeps the cheap order', () => {
  const voice = buildCandidateModels(undefined, 'gemini-primary-test', 'gemini-fallback', 'primary');
  assert.deepEqual(voice.slice(0, 4), ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-primary-test', 'gemini-fallback']);
  const text = buildCandidateModels(undefined, 'gemini-primary-test', 'gemini-fallback', 'cheap');
  assert.equal(text[0], 'gemini-flash-lite-latest');
});

// ── download ─────────────────────────────────────────────────────────────────
test('download stays in memory and checks the real size', async () => {
  const bytes = Buffer.from('OggS-fake-opus-bytes');
  await withFetch(async (url) => {
    const u = String(url);
    if (u.endsWith('/getFile')) return json({ ok: true, result: { file_path: 'voice/file_1.oga', file_size: bytes.length } });
    if (u.includes('/file/bot')) return new Response(bytes);
    throw new Error('unexpected ' + u);
  }, async () => {
    const res = await downloadTelegramFileBase64('fid');
    assert.equal(res.base64, bytes.toString('base64'));
    assert.equal(await downloadTelegramFileBase64('fid', { maxBytes: 5 }), null);
  });
});

// ── extraction with audio ────────────────────────────────────────────────────
test('audio goes inline with the same prompt; transcript returned; same validation', async () => {
  let request;
  await withFetch(async (url, init) => {
    request = { url: String(url), body: JSON.parse(init.body) };
    return geminiReply({
      transcript: 'bugun tushlikka 45 ming sarfladim, taksiga 15 ming',
      intent: 'action_proposal',
      actions: [
        { actionType: 'create_transaction', transactionType: 'expense', amount: 45000, description: 'Tushlik', categoryName: 'Kafeler va Restoranlar' },
        { actionType: 'create_transaction', transactionType: 'expense', amount: 15000, description: 'Taksi', categoryName: 'Taksi' },
      ],
      summaryUzbek: '2 ta xarajat',
    });
  }, async () => {
    const res = await extractFinancialActions('', {
      categories: { expense: ['Kafeler va Restoranlar', 'Transport'], income: ['Maosh'] },
      audio: { mimeType: 'audio/ogg', base64: 'AAAA' },
    });
    assert.equal(res.transcript, 'bugun tushlikka 45 ming sarfladim, taksiga 15 ming');
    assert.equal(res.actions.length, 2);
    assert.equal(res.actions[1].categoryName, undefined); // not in the allowed list
  });
  assert.match(request.url, /models\/gemini-3\.5-flash-lite:generateContent$/);
  const parts = request.body.contents[0].parts;
  assert.match(parts[0].text, /OVOZLI XABAR/);
  assert.deepEqual(parts[1], { inlineData: { mimeType: 'audio/ogg', data: 'AAAA' } });
  assert.match(request.body.system_instruction.parts[0].text, /Xarajat kategoriyalari: Kafeler va Restoranlar, Transport/);
});

test('when every Gemini model fails, audio is never sent to OpenRouter', async () => {
  const urls = [];
  await withFetch(async (url) => {
    urls.push(String(url));
    return json({ error: { message: 'bad audio' } }, 400);
  }, async () => {
    const res = await extractFinancialActions('', { audio: { mimeType: 'audio/ogg', base64: 'AAAA' } });
    assert.equal(res.error, 'ai_unavailable');
  });
  assert.ok(urls.length > 0);
  assert.ok(urls.every((u) => !u.includes('openrouter')));
});

// ── end to end through the bot ───────────────────────────────────────────────
test('voice message → transcript preview with ✅/❌ and source telegram_voice', async () => {
  const TG_ID = 4242;
  telegramSessionCache.set(TG_ID, {
    userId: '00000000-0000-0000-0000-000000000001',
    accessToken: 'test-jwt',
    onboardingCompleted: true,
    expiresAtMs: Date.now() + 3600_000,
  });

  const sent = [];
  const edits = [];
  let savedActions;
  await withFetch(async (url, init) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(init.body) : undefined;
    if (u.endsWith('/sendChatAction')) return json({ ok: true, result: true });
    if (u.endsWith('/getFile')) return json({ ok: true, result: { file_path: 'voice/a.oga', file_size: 10 } });
    if (u.includes('/file/bot')) return new Response(Buffer.from('OggS-voice'));
    if (u.endsWith('/sendMessage')) { sent.push(body); return json({ ok: true, result: { message_id: 77 } }); }
    if (u.endsWith('/editMessageText')) { edits.push(body); return json({ ok: true, result: { message_id: body.message_id } }); }
    if (u.includes('/rest/v1/categories')) {
      return json([{ id: 'c-dining', name: 'Dining Out', type: 'expense', is_system: true, user_id: null }]);
    }
    if (u.includes('/rest/v1/pending_ai_actions')) {
      savedActions = body.actions;
      const now = new Date().toISOString();
      return json({ ...body, id: 'row1', status: 'pending', retry_count: 0, created_at: now, updated_at: now,
        expires_at: new Date(Date.now() + 900_000).toISOString() }, 201);
    }
    if (u.includes('generativelanguage.googleapis.com')) {
      return geminiReply({
        transcript: 'tushlikka 45 ming <sarfladim>',
        intent: 'action_proposal',
        actions: [{ actionType: 'create_transaction', transactionType: 'expense', amount: 45000, description: 'Tushlik', categoryName: 'Kafeler va Restoranlar' }],
        summaryUzbek: 'Tushlik: 45 000 so‘m',
      });
    }
    throw new Error('unexpected fetch ' + u);
  }, async () => {
    await handleTelegramUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        from: { id: TG_ID, is_bot: false, first_name: 'Ali' },
        chat: { id: TG_ID, type: 'private' },
        date: 0,
        voice: { file_id: 'v1', duration: 5, mime_type: 'audio/ogg', file_size: 10 },
      },
    });
  });

  // Instant placeholder first, then the SAME message is edited into the preview (#perf).
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /tinglanmoqda/);
  assert.equal(sent[0].reply_markup, undefined);
  const preview = edits.find((m) => m.reply_markup?.inline_keyboard);
  assert.ok(preview, 'placeholder was edited into the preview with buttons');
  assert.equal(preview.message_id, 77);
  assert.match(preview.text, /^🎤 <i>Siz aytdingiz:<\/i> «tushlikka 45 ming &lt;sarfladim&gt;»/);
  assert.match(preview.text, /Tushlik: 45 000 so‘m/);
  assert.match(preview.reply_markup.inline_keyboard[0][0].callback_data, /^act_confirm:/);
  assert.equal(savedActions[0].source, 'telegram_voice');
  assert.equal(savedActions[0].categoryId, 'c-dining');
  telegramSessionCache.delete(TG_ID);
});

test('voice over 60 s gets a friendly message and nothing is downloaded', async () => {
  const urls = [];
  const sent = [];
  await withFetch(async (url, init) => {
    urls.push(String(url));
    if (String(url).endsWith('/sendMessage')) sent.push(JSON.parse(init.body));
    return json({ ok: true, result: {} });
  }, async () => {
    await handleTelegramUpdate({
      update_id: 2,
      message: {
        message_id: 11,
        from: { id: 5, is_bot: false, first_name: 'Ali' },
        chat: { id: 5, type: 'private' },
        date: 0,
        voice: { file_id: 'v2', duration: 95 },
      },
    });
  });
  assert.ok(urls.every((u) => !u.endsWith('/getFile')));
  assert.match(sent[0].text, /60 soniyadan qisqaroq/);
});

test('round video messages get a short note', async () => {
  const sent = [];
  await withFetch(async (url, init) => {
    if (String(url).endsWith('/sendMessage')) sent.push(JSON.parse(init.body));
    return json({ ok: true, result: {} });
  }, async () => {
    await handleTelegramUpdate({
      update_id: 3,
      message: { message_id: 12, from: { id: 6, is_bot: false, first_name: 'A' }, chat: { id: 6, type: 'private' }, date: 0, video_note: { file_id: 'x' } },
    });
  });
  assert.equal(sent[0].text, VOICE_MESSAGES.videoNote);
});
