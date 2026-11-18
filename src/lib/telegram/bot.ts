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
import { AiBudget } from '../ai/aiBudget.ts';
import { loadCategoryOptions, categoryNamesByType, attachCategoryIds } from '../categories/catalog.ts';

/** Shown when the AI could not answer in time or is unavailable (#21). */
export const AI_RETRY_MESSAGE =
  '⏳ Kechirasiz, hozir xabaringizni tahlil qila olmadim. Iltimos, birozdan so‘ng qayta yozib ko‘ring.';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN muhit o‘zgaruvchisi sozlanmagan');
  }
  return token;
}

export const MINIAPP_URL = process.env.TELEGRAM_MINIAPP_URL || 'https://uzhamyon.vercel.app/';

/**
 * Sets the Telegram Chat Menu Button to open the Web App.
 * When set, Telegram shows a dedicated Mini App button on the bottom-left of the chat interface.
 * If chatId is provided, sets it specifically for that chat; otherwise sets default for all users.
 */
export async function setTelegramChatMenuButton(chatId?: number): Promise<{ ok: boolean; error?: string }> {
  const url = `https://api.telegram.org/bot${getBotToken()}/setChatMenuButton`;
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

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { ok: Boolean(data?.ok), error: data?.description };
  } catch (err) {
    console.error('Failed to set Telegram chat menu button:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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
  const url = `https://api.telegram.org/bot${getBotToken()}/sendMessage`;

  const payload: {
    chat_id: number;
    text: string;
    parse_mode: string;
    reply_markup?: {
      inline_keyboard: Array<Array<{ text: string; web_app: { url: string } }>>;
    };
  } = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (buttonText && webAppUrl) {
    payload.reply_markup = {
      inline_keyboard: [
        [
          {
            text: buttonText,
            web_app: { url: webAppUrl },
          },
        ],
      ],
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return null;
  }
}

/**
 * Sends a message with Telegram inline keyboard buttons
 */
export async function sendTelegramInlineButtons(
  chatId: number,
  text: string,
  inlineKeyboard: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>>
) {
  const url = `https://api.telegram.org/bot${getBotToken()}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram inline keyboard message:', err);
    return null;
  }
}

/**
 * Acknowledges a Telegram callback query
 */
export async function answerTelegramCallbackQuery(callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${getBotToken()}/answerCallbackQuery`;
  const payload: { callback_query_id: string; text?: string } = {
    callback_query_id: callbackQueryId,
  };
  if (text) payload.text = text;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to answer Telegram callback query:', err);
    return null;
  }
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
  const url = `https://api.telegram.org/bot${getBotToken()}/editMessageText`;
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

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to edit Telegram message text:', err);
    return null;
  }
}

/**
 * Broadcasts a chat action (e.g. 'typing') to inform the user the bot is actively processing.
 */
export async function sendTelegramChatAction(chatId: number, action: string = 'typing'): Promise<boolean> {
  const url = `https://api.telegram.org/bot${getBotToken()}/sendChatAction`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
    const data = await res.json();
    return Boolean(data?.ok);
  } catch (err) {
    console.warn('[Telegram Bot] Failed to send chat action:', err);
    return false;
  }
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

    const client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      global: {
        headers: {
          Authorization: `Bearer ${authSession.session.access_token}`,
        },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    return {
      client,
      userId: authSession.user.id,
      onboardingCompleted: authSession.onboarding_completed,
    };
  } catch (err) {
    console.error('[Telegram Bot] Failed to resolve Supabase user client for Telegram ID:', tgUser.id, err);
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
    setTelegramChatMenuButton(message.chat.id).catch(() => {});

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
  if (!message || !message.text || !message.from || typeof message.from.id !== 'number' || message.from.id <= 0) return;

  // One AI time budget for everything this update does (#21).
  const budget = new AiBudget();

  const chatId = message.chat.id;
  const from = message.from;
  const text = message.text.trim();
  const firstName = escapeHtml(from.first_name || 'aziz foydalanuvchi');

  // Immediately broadcast 'typing' chat action so user sees loading feedback right away
  sendTelegramChatAction(chatId, 'typing').catch(() => {});

  // Ensure Chat Menu Button is always active on the left side of the chat
  setTelegramChatMenuButton(chatId).catch(() => {});

  // 2.1 Slash command: /start
  if (text.startsWith('/start')) {
    const isReturning = await isReturningTelegramUser(from.id);

    if (isReturning) {
      const returningMsg = `<b>Qaytganingizdan xursandmiz, ${firstName}!</b>\n\nUzHamyon tayyor. Moliyaviy holatingizni davom ettiring.`;
      await sendTelegramMessage(chatId, returningMsg, 'Ilovani ochish', MINIAPP_URL);
    } else {
      const welcomeMsg = `<b>Assalomu alaykum, ${firstName}!</b>\n\nUzHamyon'ga xush kelibsiz!\n\nEndi daromad va xarajatlaringizni nazorat qilishingiz, pulingiz qayerga sarflanayotganini tushunishingiz va moliyaviy maqsadlaringiz sari harakat qilishingiz mumkin.\n\nUzHamyon sizga:\n• Daromad va xarajatlarni qayd etish\n• Moliyaviy holatingizni tahlil qilish\n• Jamg‘arma maqsadlarini belgilash\n• Qarzlaringizni nazorat qilish\n• AI yordamida moliyaviy qarorlar qabul qilishda yordam beradi\n\nBoshlash uchun quyidagi tugmani bosing.`;
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
    const helpMsg = `<b>UzHamyon — shaxsiy moliyaviy yordamchingiz.</b>\n\n<b>Mavjud buyruqlar:</b>\n/start — UzHamyonni boshlash\n/app — Ilovani ochish\n/help — Yordam ma’lumotlari\n/about — UzHamyon haqida\n\nShuningdek, tabiiy tilda xabar yozishingiz mumkin:\n• <i>«Bugun tushlikka 45 000 so'm ishlatdim»</i>\n• <i>«Oylik maoshim 5 000 000 so'm tushdi»</i>\n• <i>«Mashina uchun 50 mln maqsad yarat»</i>\n• <i>«Bu oy qancha pul sarfladim?»</i>`;
    await sendTelegramMessage(chatId, helpMsg, 'Ilovani ochish', MINIAPP_URL);
    return;
  }

  // 2.4 Slash command: /about
  if (text === '/about') {
    const aboutMsg = `<b>UzHamyon haqida</b>\n\nUzHamyon — O‘zbekiston foydalanuvchilari uchun shaxsiy moliya va budjet boshqaruvi tizimi.\n\nDaromad va xarajatlaringizni kuzatib boring, jamg‘arma maqsadlaringizni belgilang va sun’iy intellekt (UzHamyon AI) tavsiyalaridan foydalaning.\n\nBarcha ma’lumotlaringiz xavfsiz va shifrlangan holatda saqlanadi.`;
    await sendTelegramMessage(chatId, aboutMsg, 'Ilovani ochish', MINIAPP_URL);
    return;
  }

  // 2.5 Natural Language Financial Message Processing
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

  // Sign in first so the AI gets the user's real category list (#14).
  const userAuth = await getTelegramUserSupabaseClient(from);

  if (!userAuth) {
    const defaultMsg = `Assalomu alaykum, ${firstName}!\n\nUzHamyon ilovasi orqali hisobingizni ochish uchun quyidagi tugmani bosing:`;
    await sendTelegramMessage(chatId, defaultMsg, "UzHamyon'ni ochish", MINIAPP_URL);
    return;
  }

  const categoryOptions = await loadCategoryOptions(userAuth.client);

  // Exactly ONE extraction per message (#21), within the shared time budget.
  const extracted = await extractFinancialActions(text, {
    categories: categoryOptions.length ? categoryNamesByType(categoryOptions) : undefined,
    budget,
  });

  if (extracted.error) {
    // The AI was unavailable or out of time: do not guess, ask the user to retry.
    await sendTelegramMessage(chatId, AI_RETRY_MESSAGE);
    return;
  }

  if (extracted.intent === 'action_proposal' && extracted.actions.length > 0) {
    const actions = attachCategoryIds(extracted.actions, categoryOptions).map((a) => ({
      ...a,
      source: a.source || 'telegram_ai',
    }));
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
      await sendTelegramMessage(chatId, errMsg);
      return;
    }

    const pending = saveRes.record;

    await sendTelegramInlineButtons(
      chatId,
      escapeHtml(extracted.summaryUzbek),
      buildConfirmKeyboard(pending.actionId)
    );
    return;
  }

  if (extracted.intent === 'clarification') {
    const q = extracted.clarificationQuestion || 'Iltimos, summani yoki boshqa tafsilotlarni aniqlashtirib yozing.';
    await sendTelegramMessage(chatId, escapeHtml(q));
    return;
  }

  if (extracted.intent === 'financial_query') {
    const advisorRes = await askFinancialAdvisor(text, undefined, userAuth.client, { channel: 'telegram', budget });
    const reply = advisorRes.data?.answer
      ? escapeHtml(advisorRes.data.answer)
      : 'Moliyaviy ma’lumotlarni tahlil qilishda xatolik yuz berdi.';
    await sendTelegramMessage(chatId, reply);
    return;
  }

  // Casual chat or general query fallback
  const advisorRes = await askFinancialAdvisor(text, undefined, userAuth.client, { channel: 'telegram', budget });
  const reply = advisorRes.data?.answer
    ? escapeHtml(advisorRes.data.answer)
    : `Assalomu alaykum, ${firstName}! Sizga qanday yordam bera olaman?`;
  await sendTelegramMessage(chatId, reply, 'Ilovani ochish', MINIAPP_URL);
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
