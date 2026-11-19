import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey } from '../supabase/config.ts';
import { getOrCreateTelegramUser } from './auth.ts';
import { extractFinancialActions } from '../ai/actionExtractionEngine.ts';
import {
  savePendingAction,
  getPendingAction,
  getLatestActivePendingAction,
  cancelPendingAction,
  isUserConfirmation,
  isUserCancellation,
} from '../ai/pendingActionStore.ts';
import { executePendingActionRecord } from '../ai/actionExecutor.ts';
import { askFinancialAdvisor } from '../ai/advisorService.ts';
import type { PendingActionRecord } from '../ai/pendingActionStore.ts';
import { escapeHtml } from './html.ts';
import { callBotApi, getBotToken } from './botApi.ts';
import { telegramSessionCache, sessionExpiryMs } from './sessionCache.ts';
import { AiBudget, TELEGRAM_AI_BUDGET_MS } from '../ai/aiBudget.ts';

/** Per-call Gemini timeout for audio requests. */
export const VOICE_PER_CALL_TIMEOUT_MS = 15_000;
/** Per-call Gemini timeout for text: a hanging model fails fast and the next one answers. */
export const TEXT_PER_CALL_TIMEOUT_MS = 8_000;
import {
  loadCategoryOptions,
  categoryNamesByType,
  attachCategoryIds,
  type CategoryOption,
} from '../categories/catalog.ts';
import { notifyCompletedGoals } from '../goals/notifications.ts';
import {
  type TelegramAudioLike,
  validateAudioMeta,
  rejectMessageFor,
  downloadTelegramFileBase64,
  VOICE_MESSAGES,
} from './voice.ts';
import type { ExtractionResult } from '../ai/actionExtractionEngine.ts';
import {
  isDeleteDataRequest,
  countUserData,
  buildDeletionPrompt,
  buildDeletionKeyboard,
  verifyDeletionToken,
  deleteTelegramAccount,
  DELETE_CALLBACK_PREFIX,
  DELETE_CANCEL_CALLBACK,
  DELETION_MESSAGES,
} from './accountDeletion.ts';

/** Shown when the AI could not answer in time or is unavailable (#21). */
export const AI_RETRY_MESSAGE =
  '⏳ Kechirasiz, hozir xabaringizni tahlil qila olmadim. Iltimos, birozdan so‘ng qayta yozib ko‘ring.';

export const MINIAPP_URL = process.env.TELEGRAM_MINIAPP_URL || 'https://uzhamyon.vercel.app/';

/**
 * Sets the Telegram Chat Menu Button to open the Web App.
 * When set, Telegram shows a dedicated Mini App button on the bottom-left of the chat interface.
 * If chatId is provided, sets it specifically for that chat; otherwise sets default for all users.
 */
export async function setTelegramChatMenuButton(chatId?: number): Promise<{ ok: boolean; error?: string }> {
  const payload: Record<string, unknown> = {
    menu_button: {
      type: 'web_app',
      text: 'UzHamyon',
      web_app: { url: MINIAPP_URL },
    },
  };
  if (chatId) {
    payload.chat_id = chatId;
  }
  const data = await callBotApi('setChatMenuButton', payload);
  return { ok: Boolean(data?.ok), error: data?.description };
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
      first_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
    voice?: TelegramAudioLike;
    audio?: TelegramAudioLike & { title?: string; performer?: string; file_name?: string };
    video_note?: { file_id: string; duration?: number; file_size?: number };
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: string;
      };
      date: number;
      text?: string;
    };
    data?: string;
  };
}

/**
 * Sends a message via Telegram Bot API with optional WebApp inline keyboard.
 */
export async function sendTelegramMessage(chatId: number, text: string, buttonText?: string, webAppUrl?: string) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (buttonText && webAppUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: buttonText, web_app: { url: webAppUrl } }]],
    };
  }

  return callBotApi('sendMessage', payload);
}

/**
 * Sends a message with Telegram inline keyboard buttons
 */
export async function sendTelegramInlineButtons(
  chatId: number,
  text: string,
  inlineKeyboard: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>>
) {
  return callBotApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: inlineKeyboard },
  });
}

/**
 * Acknowledges a Telegram callback query
 */
export async function answerTelegramCallbackQuery(callbackQueryId: string, text?: string) {
  const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
  if (text) payload.text = text;
  return callBotApi('answerCallbackQuery', payload);
}

/**
 * Edits the text of an existing Telegram message
 */
export async function editTelegramMessageText(
  chatId: number,
  messageId: number,
  text: string,
  inlineKeyboard?: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>>
) {
  // Without reply_markup Telegram removes the inline keyboard from the edited message.
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  };
  if (inlineKeyboard) {
    payload.reply_markup = { inline_keyboard: inlineKeyboard };
  }

  return callBotApi('editMessageText', payload);
}

/**
 * Broadcasts a chat action (e.g. 'typing') to inform the user the bot is actively processing.
 */
export async function sendTelegramChatAction(chatId: number, action: string = 'typing'): Promise<boolean> {
  const data = await callBotApi('sendChatAction', { chat_id: chatId, action }, { timeoutMs: 5_000 });
  return Boolean(data?.ok);
}

/**
 * Resolves or establishes an authenticated Supabase client for a Telegram user
 */
export async function getTelegramUserSupabaseClient(tgUser: {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}): Promise<{ client: SupabaseClient; userId: string; onboardingCompleted: boolean } | null> {
  const buildClient = (accessToken: string) =>
    createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

  // 1. Reuse a fresh cached session (no Supabase Auth call) — #34.
  const cached = telegramSessionCache.get(tgUser.id);
  if (cached) {
    return {
      client: buildClient(cached.accessToken),
      userId: cached.userId,
      onboardingCompleted: cached.onboardingCompleted,
    };
  }

  // 2. Otherwise sign in (or create the user) and cache the session.
  try {
    const authSession = await getOrCreateTelegramUser({
      id: tgUser.id,
      first_name: tgUser.first_name || 'Foydalanuvchi',
      last_name: tgUser.last_name,
      username: tgUser.username,
    });

    if (!authSession?.session?.access_token || !authSession?.user?.id) {
      return null;
    }

    telegramSessionCache.set(tgUser.id, {
      userId: authSession.user.id,
      accessToken: authSession.session.access_token,
      onboardingCompleted: authSession.onboarding_completed,
      expiresAtMs: sessionExpiryMs(authSession.session.expires_at, authSession.session.access_token),
    });

    return {
      client: buildClient(authSession.session.access_token),
      userId: authSession.user.id,
      onboardingCompleted: authSession.onboarding_completed,
    };
  } catch (err) {
    console.error(
      '[Telegram Bot] Failed to resolve Supabase user client for Telegram ID:',
      tgUser.id,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Checks if a Telegram user has completed onboarding in UzHamyon
 */
export async function isReturningTelegramUser(telegramId: number): Promise<boolean> {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    if (!serviceRoleKey) return false;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Query profile by internal email or jsonb telegram_id
    const internalEmail = `tg_${telegramId}@telegram.uzhamyon.uz`;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, onboarding_completed, onboarding_data')
      .or(`email.eq.${internalEmail},onboarding_data->>telegram_id.eq.${telegramId}`)
      .maybeSingle();

    if (profile && profile.onboarding_completed) {
      return true;
    }

    return false;
  } catch (e) {
    console.error('Error checking returning user:', e);
    return false;
  }
}

export const BOT_USERNAME = 'uz_hamyonbot';

export const GROUP_CHAT_NOTE =
  `Men faqat shaxsiy chatda ishlayman — moliyaviy ma’lumotlaringiz xavfsizligi uchun. 🙂\n👉 t.me/${BOT_USERNAME}`;

/** "/start", "/help@uz_hamyonbot" → true; "/help@other_bot" or plain text → false. */
export function isCommandForThisBot(text: string, botUsername: string = BOT_USERNAME): boolean {
  const m = text.trim().match(/^\/[A-Za-z0-9_]+(?:@([A-Za-z0-9_]+))?(?:\s|$)/);
  if (!m) return false;
  return !m[1] || m[1].toLowerCase() === botUsername.toLowerCase();
}

/** Clears profiles.telegram_blocked_at (migration 014). Silent if the column is missing. */
async function clearTelegramBlockedFlag(telegramId: number): Promise<void> {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) return;
  const admin = createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await admin
    .from('profiles')
    .update({ telegram_blocked_at: null })
    .eq('email', `tg_${telegramId}@telegram.uzhamyon.uz`)
    .not('telegram_blocked_at', 'is', null);
}

function buildConfirmKeyboard(actionId: string) {
  return [
    [
      { text: '✅ Tasdiqlash', callback_data: `act_confirm:${actionId}` },
      { text: '❌ Bekor qilish', callback_data: `act_cancel:${actionId}` },
    ],
  ];
}

const CANCELLED_TEXT = '❌ Amal bekor qilindi. Hech qanday moliyaviy yozuv kiritilmadi.';

/**
 * Human-readable (HTML-safe) text for a proposal that can no longer be confirmed or cancelled.
 * Always reflects the REAL status stored in the database.
 */
export function describeResolvedPendingAction(record: PendingActionRecord, now: number = Date.now()): string {
  switch (record.status) {
    case 'executed':
      return record.resultMessage
        ? escapeHtml(record.resultMessage)
        : '✅ Bu amal allaqachon saqlangan.';
    case 'cancelled':
      return '❌ Bu amal bekor qilingan. Hech qanday moliyaviy yozuv kiritilmadi.';
    case 'executing':
      return '⏳ Bu amal hozir saqlanmoqda. Birozdan so‘ng ilovada tekshirib ko‘ring.';
    case 'failed':
      if (now <= record.expiresAt) {
        return '⚠️ Bu amalni saqlab bo‘lmagan edi. Iltimos, qayta urinib ko‘ring.';
      }
      return '⌛ Bu taklifning muddati tugagan (15 daqiqa). Iltimos, xabaringizni qayta yuboring.';
    default:
      return '⌛ Bu taklifning muddati tugagan (15 daqiqa). Iltimos, xabaringizni qayta yuboring.';
  }
}

/**
 * Processes an incoming Telegram update (messages and inline button callback queries).
 */
export async function handleTelegramUpdate(update: TelegramUpdate) {
  // ── 1. Handle Inline Button Callback Queries (Tasdiqlash / Bekor qilish) ──
  if (update.callback_query) {
    const cb = update.callback_query;
    const from = cb.from;
    const message = cb.message;
    const data = cb.data || '';

    if (!from || !message || typeof from.id !== 'number' || from.id <= 0) return;

    await answerTelegramCallbackQuery(cb.id);
    // Financial actions only in private chats (#39).
    if (message.chat.type !== 'private') return;

    // "Delete my data" confirmation (signed, 5 minutes, this user only).
    if (data === DELETE_CANCEL_CALLBACK) {
      await editTelegramMessageText(message.chat.id, message.message_id, DELETION_MESSAGES.cancelled);
      return;
    }
    if (data.startsWith(DELETE_CALLBACK_PREFIX)) {
      const verdict = verifyDeletionToken(data.slice(DELETE_CALLBACK_PREFIX.length), from.id);
      if (verdict !== 'ok') {
        await editTelegramMessageText(
          message.chat.id,
          message.message_id,
          verdict === 'expired' ? DELETION_MESSAGES.expired : DELETION_MESSAGES.invalid
        );
        return;
      }
      await editTelegramMessageText(message.chat.id, message.message_id, DELETION_MESSAGES.deleting);
      const result = await deleteTelegramAccount(from.id);
      forgetTelegramUserCaches(from.id);
      if (result.ok) {
        console.log(`[AccountDeletion] Telegram user ${from.id} deleted their data`);
        await editTelegramMessageText(message.chat.id, message.message_id, DELETION_MESSAGES.done);
      } else if (result.reason === 'not_found') {
        await editTelegramMessageText(message.chat.id, message.message_id, DELETION_MESSAGES.notFound);
      } else {
        console.error(`[AccountDeletion] failed for Telegram user ${from.id}:`, result.detail);
        await editTelegramMessageText(message.chat.id, message.message_id, DELETION_MESSAGES.failed);
      }
      return;
    }

    if (data.startsWith('act_confirm:')) {
      const actionId = data.replace('act_confirm:', '');
      const chatId = message.chat.id;
      const messageId = message.message_id;

      // 1. Honest progress state (no optimistic "saved"). Removing the buttons here also
      //    prevents double taps while the action is being executed.
      const originalText = message.text || '';
      await editTelegramMessageText(
        chatId,
        messageId,
        `${originalText ? `${escapeHtml(originalText)}\n\n` : ''}⏳ <i>Saqlanmoqda...</i>`
      );

      const userAuth = await getTelegramUserSupabaseClient(from);
      if (!userAuth) {
        await editTelegramMessageText(chatId, messageId, '⚠️ Foydalanuvchi hisobi topilmadi. Avval ilovani oching.');
        return;
      }

      const pending = await getPendingAction(actionId, userAuth.userId, from.id, userAuth.client);

      // 2. Already executed / cancelled / expired: show the REAL stored status.
      if (pending.record && (pending.error === 'already_processed' || pending.error === 'expired')) {
        await editTelegramMessageText(chatId, messageId, describeResolvedPendingAction(pending.record));
        return;
      }
      if (!pending.record || pending.error) {
        const errorMsg =
          pending.error === 'unauthorized'
            ? '⛔ Ruxsat berilmagan: bu amal boshqa foydalanuvchiga tegishli.'
            : '⚠️ Tasdiqlanuvchi amal topilmadi.';
        await editTelegramMessageText(chatId, messageId, errorMsg);
        return;
      }

      // 3. Execute and show the real result.
      const execRes = await executePendingActionRecord(pending.record, userAuth.client);
      if (execRes.success) {
        await editTelegramMessageText(chatId, messageId, escapeHtml(execRes.message || '✅ Saqlandi.'));
        // A contribution may have just completed a goal: congratulate once (#33).
        await notifyCompletedGoals(userAuth.client, { userId: userAuth.userId, chatId });
      } else {
        // A parallel tap may have executed it already: show the real stored status then.
        const after = await getPendingAction(actionId, userAuth.userId, from.id, userAuth.client);
        if (after.record && after.record.status === 'executed') {
          await editTelegramMessageText(chatId, messageId, describeResolvedPendingAction(after.record));
          return;
        }
        // Otherwise keep the buttons so the user can retry a failed action.
        await editTelegramMessageText(
          chatId,
          messageId,
          `${originalText ? `${escapeHtml(originalText)}\n\n` : ''}⚠️ Xatolik yuz berdi: ${escapeHtml(execRes.message || 'Saqlab bo‘lmadi')}`,
          buildConfirmKeyboard(actionId)
        );
      }
      return;
    }

    if (data.startsWith('act_cancel:')) {
      const actionId = data.replace('act_cancel:', '');
      const chatId = message.chat.id;
      const messageId = message.message_id;

      const userAuth = await getTelegramUserSupabaseClient(from);
      if (!userAuth) {
        await editTelegramMessageText(chatId, messageId, '⚠️ Foydalanuvchi hisobi topilmadi. Avval ilovani oching.');
        return;
      }

      // Cancel first, then show the real outcome (an executed action cannot be cancelled).
      const cancelRes = await cancelPendingAction(actionId, userAuth.userId, from.id, userAuth.client);
      if (cancelRes.success) {
        await editTelegramMessageText(chatId, messageId, CANCELLED_TEXT);
        return;
      }

      const pending = await getPendingAction(actionId, userAuth.userId, from.id, userAuth.client);
      if (pending.record && pending.error !== 'unauthorized') {
        await editTelegramMessageText(chatId, messageId, describeResolvedPendingAction(pending.record));
      } else if (pending.error === 'unauthorized') {
        await editTelegramMessageText(chatId, messageId, '⛔ Ruxsat berilmagan: bu amal boshqa foydalanuvchiga tegishli.');
      } else {
        await editTelegramMessageText(chatId, messageId, '⚠️ Bekor qilinadigan amal topilmadi.');
      }
      return;
    }

    return;
  }

  // ── 2. Handle Text Messages ──
  const message = update.message;
  if (!message || !message.from || typeof message.from.id !== 'number' || message.from.id <= 0) return;

  // Groups / channels: finance data must never be shown there (#39). Ignore everything
  // except a command addressed to the bot, which gets one short note.
  if (message.chat.type !== 'private') {
    if (message.text && isCommandForThisBot(message.text)) {
      await sendTelegramMessage(message.chat.id, GROUP_CHAT_NOTE);
    }
    return;
  }

  // ── Voice / audio messages (Phase 2): same extraction, validation and ✅/❌ flow ──
  if (!message.text) {
    if (message.voice || message.audio) {
      await handleVoiceMessage(message.chat.id, message.from, (message.voice || message.audio)!, Boolean(message.voice));
    } else if (message.video_note) {
      await sendTelegramMessage(message.chat.id, VOICE_MESSAGES.videoNote);
    }
    return;
  }

  // One AI time budget for everything this update does (#21); text calls get 8 s each.
  const budget = new AiBudget(TELEGRAM_AI_BUDGET_MS, TEXT_PER_CALL_TIMEOUT_MS);

  const chatId = message.chat.id;
  const from = message.from;
  const text = message.text.trim();
  const firstName = escapeHtml(from.first_name || 'aziz foydalanuvchi');

  // Immediately broadcast 'typing' chat action so user sees loading feedback right away
  sendTelegramChatAction(chatId, 'typing').catch(() => {});

  // 2.1 Slash command: /start
  if (text.startsWith('/start')) {
    // Menu button only here (#38); the global default is set by scripts/set_webhook.mjs.
    setTelegramChatMenuButton(chatId).catch(() => {});
    // A user who unblocked the bot usually presses Start: allow reminders again (#36).
    clearTelegramBlockedFlag(from.id).catch(() => {});
    const isReturning = await isReturningTelegramUser(from.id);

    if (isReturning) {
      const returningMsg = `<b>Qaytganingizdan xursandmiz, ${firstName}!</b>\n\nUzHamyon tayyor. Moliyaviy holatingizni davom ettiring.\n\n🎤 Ovozli xabar yuborishingiz ham mumkin — masalan: «bugun tushlikka 45 ming sarfladim».`;
      await sendTelegramMessage(chatId, returningMsg, 'Ilovani ochish', MINIAPP_URL);
    } else {
      const welcomeMsg = `<b>Assalomu alaykum, ${firstName}!</b>\n\nUzHamyon'ga xush kelibsiz!\n\nEndi daromad va xarajatlaringizni nazorat qilishingiz, pulingiz qayerga sarflanayotganini tushunishingiz va moliyaviy maqsadlaringiz sari harakat qilishingiz mumkin.\n\nUzHamyon sizga:\n• Daromad va xarajatlarni qayd etish\n• Moliyaviy holatingizni tahlil qilish\n• Jamg‘arma maqsadlarini belgilash\n• Qarzlaringizni nazorat qilish\n• AI yordamida moliyaviy qarorlar qabul qilishda yordam beradi\n\n✍️ Xarajatingizni shu chatga yozing yoki 🎤 ovozli xabar yuboring — UzHamyon o‘zi hisoblaydi.\n\nBoshlash uchun quyidagi tugmani bosing.`;
      await sendTelegramMessage(chatId, welcomeMsg, "UzHamyon'ni ochish", MINIAPP_URL);
    }
    return;
  }

  // 2.2 Slash command: /app
  if (text === '/app') {
    const appMsg = `UzHamyon ilovasini ochish uchun quyidagi tugmani bosing:`;
    await sendTelegramMessage(chatId, appMsg, "UzHamyon'ni ochish", MINIAPP_URL);
    return;
  }

  // 2.3 Slash command: /help
  if (text === '/help') {
    const helpMsg = `<b>UzHamyon — shaxsiy moliyaviy yordamchingiz.</b>\n\n<b>Mavjud buyruqlar:</b>\n/start — UzHamyonni boshlash\n/app — Ilovani ochish\n/help — Yordam ma’lumotlari\n/about — UzHamyon haqida\n/delete — Barcha ma’lumotlarimni o‘chirish\n\nShuningdek, tabiiy tilda xabar yozishingiz mumkin:\n• <i>«Bugun tushlikka 45 000 so'm ishlatdim»</i>\n• <i>«Oylik maoshim 5 000 000 so'm tushdi»</i>\n• <i>«Mashina uchun 50 mln maqsad yarat»</i>\n• <i>«Bu oy qancha pul sarfladim?»</i>\n\n🎤 Ovozli xabar yuborishingiz ham mumkin (60 soniyagacha): o‘zbekcha, ruscha yoki aralash gapiring — masalan, «bugun tushlikka 45 ming, taksiga 15 ming».`;
    await sendTelegramMessage(chatId, helpMsg, 'Ilovani ochish', MINIAPP_URL);
    return;
  }

  // 2.4 Slash command: /about
  if (text === '/about') {
    const aboutMsg = `<b>UzHamyon haqida</b>\n\nUzHamyon — O‘zbekiston foydalanuvchilari uchun shaxsiy moliya va budjet boshqaruvi tizimi.\n\nDaromad va xarajatlaringizni kuzatib boring, jamg‘arma maqsadlaringizni belgilang va sun’iy intellekt (UzHamyon AI) tavsiyalaridan foydalaning.\n\nBarcha ma’lumotlaringiz xavfsiz va shifrlangan holatda saqlanadi.`;
    await sendTelegramMessage(chatId, aboutMsg, 'Ilovani ochish', MINIAPP_URL);
    return;
  }

  // 2.5 "Delete my data": show what will be deleted and ask for confirmation.
  if (isDeleteDataRequest(text)) {
    const userAuth = await getTelegramUserSupabaseClient(from);
    if (!userAuth) {
      await sendTelegramMessage(chatId, DELETION_MESSAGES.notFound);
      return;
    }
    const counts = await countUserData(userAuth.client, userAuth.userId);
    await sendTelegramInlineButtons(chatId, buildDeletionPrompt(counts), buildDeletionKeyboard(from.id));
    return;
  }

  // 2.6 Natural Language Financial Message Processing
  const isSimpleConfirmation = isUserConfirmation(text);
  const isSimpleCancellation = isUserCancellation(text);

  // If user sent a short affirmative/negative reply ("ha", "tasdiqla", "bekor"), handle existing action first
  if (isSimpleConfirmation || isSimpleCancellation) {
    const userAuth = await getTelegramUserSupabaseClient(from);
    if (userAuth) {
      const latestAction = await getLatestActivePendingAction(userAuth.userId, from.id, userAuth.client);
      if (latestAction && latestAction.status === 'pending') {
        if (isSimpleConfirmation) {
          const execRes = await executePendingActionRecord(latestAction, userAuth.client);
          await sendTelegramMessage(chatId, escapeHtml(execRes.message));
          if (execRes.success) {
            await notifyCompletedGoals(userAuth.client, { userId: userAuth.userId, chatId });
          }
          return;
        }
        if (isSimpleCancellation) {
          const cancelRes = await cancelPendingAction(latestAction.actionId, userAuth.userId, from.id, userAuth.client);
          await sendTelegramMessage(
            chatId,
            cancelRes.success ? CANCELLED_TEXT : `⚠️ ${escapeHtml(cancelRes.reason || 'Amalni bekor qilib bo‘lmadi.')}`
          );
          return;
        }
      }

      // A bare "ha" / "bekor" with nothing active (e.g. the 15-minute window passed):
      // say so instead of sending the word to the AI (#26).
      if (text.split(/\s+/).length <= 2) {
        await sendTelegramMessage(
          chatId,
          '⌛ Tasdiqlanadigan faol taklif topilmadi (muddati tugagan bo‘lishi mumkin). Iltimos, xabaringizni qayta yuboring.'
        );
        return;
      }
    }
  }

  await processFinancialMessage({ chatId, from, firstName, budget, text });
}


interface FinancialMessageInput {
  chatId: number;
  from: { id: number; first_name?: string; last_name?: string; username?: string };
  /** Already HTML-escaped first name. */
  firstName: string;
  budget: AiBudget;
  /** Text message. */
  text?: string;
  /** Voice message: inline audio for Gemini. */
  audio?: { mimeType: string; base64: string };
  /** "⏳" message sent right away; the final answer replaces it. */
  placeholderMessageId?: number;
}

/** Per-user category list, cached next to the session so most messages skip the DB query. */
const CATEGORY_CACHE_TTL_MS = 10 * 60 * 1000;
const categoryCache = new Map<number, { options: CategoryOption[]; expiresAt: number }>();

function getCachedCategories(telegramId: number): CategoryOption[] | undefined {
  const hit = categoryCache.get(telegramId);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    categoryCache.delete(telegramId);
    return undefined;
  }
  return hit.options;
}

function setCachedCategories(telegramId: number, options: CategoryOption[]): void {
  if (!options.length) return;
  categoryCache.delete(telegramId);
  categoryCache.set(telegramId, { options, expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS });
  while (categoryCache.size > 1000) {
    const oldest = categoryCache.keys().next().value;
    if (oldest === undefined) break;
    categoryCache.delete(oldest);
  }
}

export function forgetTelegramUserCaches(telegramId: number): void {
  categoryCache.delete(telegramId);
  telegramSessionCache.delete(telegramId);
}

/** Sends the instant "⏳" reply; returns its message id (or undefined if it failed). */
async function sendPlaceholder(chatId: number, text: string): Promise<number | undefined> {
  const res = await sendTelegramMessage(chatId, text);
  const id = (res?.result as { message_id?: number } | undefined)?.message_id;
  return typeof id === 'number' ? id : undefined;
}

/**
 * Final answer: edits the "⏳" placeholder in place (same message, no extra notification).
 * If the edit is not possible, sends a new message and removes the placeholder.
 */
async function deliver(
  chatId: number,
  placeholderMessageId: number | undefined,
  text: string,
  options: {
    keyboard?: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>>;
    webApp?: { text: string; url: string };
  } = {}
): Promise<void> {
  const keyboard =
    options.keyboard ?? (options.webApp ? [[{ text: options.webApp.text, web_app: { url: options.webApp.url } }]] : undefined);
  if (placeholderMessageId) {
    const edited = await editTelegramMessageText(chatId, placeholderMessageId, text, keyboard);
    if (edited?.ok) return;
    callBotApi('deleteMessage', { chat_id: chatId, message_id: placeholderMessageId }).catch(() => {});
  }
  if (options.keyboard) {
    await sendTelegramInlineButtons(chatId, text, options.keyboard);
  } else {
    await sendTelegramMessage(chatId, text, options.webApp?.text, options.webApp?.url);
  }
}

/**
 * The ONE financial message flow for text and voice:
 * instant "⏳" reply → (sign in ∥ Gemini extraction) → user's categories → the same
 * validation → pending action + ✅/❌ (nothing is saved before ✅), clarification, or advisor.
 */
async function processFinancialMessage(input: FinancialMessageInput): Promise<void> {
  const { chatId, from, firstName, budget } = input;
  const isVoice = Boolean(input.audio);
  const t0 = Date.now();

  // 1. Instant feedback (well under a second): the answer will replace this message.
  const placeholderId =
    input.placeholderMessageId ?? (await sendPlaceholder(chatId, '⏳ Tekshirilmoqda...'));

  // 2. Sign-in and the AI call run in parallel. The AI gets the user's cached category
  //    list, or the standard Uzbek list on a cold cache (custom names are matched after).
  const cachedCategories = getCachedCategories(from.id);
  let tAuth = 0;
  const authPromise = getTelegramUserSupabaseClient(from).then((r) => {
    tAuth = Date.now() - t0;
    return r;
  });
  const extractionPromise: Promise<ExtractionResult> = extractFinancialActions(input.text || '', {
    categories: cachedCategories ? categoryNamesByType(cachedCategories) : undefined,
    budget,
    audio: input.audio,
  });

  const userAuth = await authPromise;
  if (!userAuth) {
    const defaultMsg = `Assalomu alaykum, ${firstName}!\n\nUzHamyon ilovasi orqali hisobingizni ochish uchun quyidagi tugmani bosing:`;
    await deliver(chatId, placeholderId, defaultMsg, { webApp: { text: "UzHamyon'ni ochish", url: MINIAPP_URL } });
    return;
  }

  const categoriesPromise = cachedCategories
    ? Promise.resolve(cachedCategories)
    : loadCategoryOptions(userAuth.client).then((opts) => {
        setCachedCategories(from.id, opts);
        return opts;
      });

  const [extracted, categoryOptions] = await Promise.all([extractionPromise, categoriesPromise]);
  const tAi = Date.now() - t0;

  const finish = (outcome: string) =>
    console.log(
      `[perf] ${isVoice ? 'voice' : 'text'} outcome=${outcome} auth=${tAuth}ms ai+categories=${tAi}ms ` +
        `total=${Date.now() - t0}ms cachedCategories=${Boolean(cachedCategories)}`
    );

  if (extracted.error) {
    // The AI was unavailable or out of time: do not guess.
    await deliver(chatId, placeholderId, isVoice ? VOICE_MESSAGES.notUnderstood : AI_RETRY_MESSAGE);
    finish(extracted.error);
    return;
  }

  const transcript = (extracted.transcript || '').trim();
  if (isVoice && !transcript) {
    await deliver(chatId, placeholderId, VOICE_MESSAGES.notUnderstood);
    finish('empty_transcript');
    return;
  }
  // "🎤 Siz aytdingiz: …" before every voice reply (escaped).
  const voicePrefix = isVoice ? `🎤 <i>Siz aytdingiz:</i> «${escapeHtml(transcript)}»\n\n` : '';
  const userText = isVoice ? transcript : input.text || '';

  if (extracted.intent === 'action_proposal' && extracted.actions.length > 0) {
    const source = isVoice ? 'telegram_voice' : 'telegram_ai';
    const actions = attachCategoryIds(extracted.actions, categoryOptions).map((a) => ({ ...a, source }));
    const saveRes = await savePendingAction(
      userAuth.userId,
      actions,
      extracted.summaryUzbek,
      {
        telegramUserId: from.id,
        telegramChatId: chatId,
      },
      userAuth.client
    );

    if (saveRes.error || !saveRes.record) {
      if (saveRes.error) {
        console.error('[Telegram Bot] Failed to save pending action:', saveRes.error);
      }
      const errMsg = saveRes.migrationMissing
        ? '⚠️ Tizimda yangilanishlar bajarilmoqda. Iltimos, keyinroq qayta urinib ko‘ring.'
        : '⚠️ Amalni saqlab bo‘lmadi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.';
      await deliver(chatId, placeholderId, errMsg);
      finish('save_failed');
      return;
    }

    // The confirmation (preview + ✅/❌) — nothing is written to transactions before ✅.
    await deliver(chatId, placeholderId, voicePrefix + escapeHtml(extracted.summaryUzbek), {
      keyboard: buildConfirmKeyboard(saveRes.record.actionId),
    });
    finish('proposal');
    return;
  }

  if (extracted.intent === 'clarification') {
    const q = extracted.clarificationQuestion || 'Iltimos, summani yoki boshqa tafsilotlarni aniqlashtirib yozing.';
    await deliver(chatId, placeholderId, voicePrefix + escapeHtml(q));
    finish('clarification');
    return;
  }

  // financial_query / casual_chat → the advisor answers the (transcribed) text.
  const advisorRes = await askFinancialAdvisor(userText, undefined, userAuth.client, { channel: 'telegram', budget });
  if (extracted.intent === 'financial_query') {
    const reply = advisorRes.data?.answer
      ? escapeHtml(advisorRes.data.answer)
      : 'Moliyaviy ma’lumotlarni tahlil qilishda xatolik yuz berdi.';
    await deliver(chatId, placeholderId, voicePrefix + reply);
    finish('query');
    return;
  }

  const reply = advisorRes.data?.answer
    ? escapeHtml(advisorRes.data.answer)
    : `Assalomu alaykum, ${firstName}! Sizga qanday yordam bera olaman?`;
  await deliver(chatId, placeholderId, voicePrefix + reply, { webApp: { text: 'Ilovani ochish', url: MINIAPP_URL } });
  finish('chat');
}

/** Voice / audio: check limits, instant "🎤" reply, download into memory, then the shared flow. */
async function handleVoiceMessage(
  chatId: number,
  from: { id: number; first_name?: string; last_name?: string; username?: string },
  media: TelegramAudioLike,
  isVoice: boolean
): Promise<void> {
  const check = validateAudioMeta(media, isVoice);
  if (!check.ok) {
    await sendTelegramMessage(chatId, rejectMessageFor(check.reason));
    return;
  }

  const placeholderId = await sendPlaceholder(chatId, '🎤 Ovozli xabar tinglanmoqda...');
  // Audio requests are slower than text: allow up to 15 s per Gemini call, 25 s in total.
  const budget = new AiBudget(TELEGRAM_AI_BUDGET_MS, VOICE_PER_CALL_TIMEOUT_MS);

  const file = await downloadTelegramFileBase64(media.file_id);
  if (!file) {
    await deliver(chatId, placeholderId, VOICE_MESSAGES.notUnderstood);
    return;
  }

  await processFinancialMessage({
    chatId,
    from,
    firstName: escapeHtml(from.first_name || 'aziz foydalanuvchi'),
    budget,
    audio: { mimeType: check.mimeType, base64: file.base64 },
    placeholderMessageId: placeholderId,
  });
}

/**
 * Long-polling runner for development or background server process
 */
export async function runTelegramPolling(abortSignal?: AbortSignal) {
  let offset = 0;
  console.log(`[Telegram Bot] Polling started for @uz_hamyonbot (MiniApp: ${MINIAPP_URL})...`);

  while (!abortSignal?.aborted) {
    try {
      const url = `https://api.telegram.org/bot${getBotToken()}/getUpdates?offset=${offset}&timeout=20`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = Math.max(offset, update.update_id + 1);
          await handleTelegramUpdate(update);
        }
      } else if (!data.ok) {
        console.warn('[Telegram Bot] getUpdates error:', data.description);
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (err) {
      if (abortSignal?.aborted) break;
      console.error('[Telegram Bot] Polling network error:', err);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  console.log('[Telegram Bot] Polling stopped.');
}
