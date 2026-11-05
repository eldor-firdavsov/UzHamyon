import { createClient } from '@supabase/supabase-js';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN muhit o‘zgaruvchisi sozlanmagan');
  }
  return token;
}

const MINIAPP_URL = process.env.TELEGRAM_MINIAPP_URL || 'https://uzhamyon.vercel.app/';

interface TelegramUpdate {
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
 * Checks if a Telegram user has completed onboarding in UzHamyon
 */
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '../supabase/config.ts';

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

/**
 * Processes an incoming Telegram update according to product specification.
 */
export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message || !message.text || !message.from) return;

  const chatId = message.chat.id;
  const from = message.from;
  const text = message.text.trim();
  const firstName = from.first_name || 'aziz foydalanuvchi';

  // 1. /start command
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

  // 2. /app command
  if (text === '/app') {
    const appMsg = `UzHamyon ilovasini ochish uchun quyidagi tugmani bosing:`;
    await sendTelegramMessage(chatId, appMsg, "UzHamyon'ni ochish", MINIAPP_URL);
    return;
  }

  // 3. /help command
  if (text === '/help') {
    const helpMsg = `<b>UzHamyon — shaxsiy moliyaviy yordamchingiz.</b>\n\n<b>Mavjud buyruqlar:</b>\n/start — UzHamyonni boshlash\n/app — Ilovani ochish\n/help — Yordam ma’lumotlari\n/about — UzHamyon haqida\n\nQuyidagi tugma orqali ilovani istalgan vaqtda ochishingiz mumkin:`;
    await sendTelegramMessage(chatId, helpMsg, 'Ilovani ochish', MINIAPP_URL);
    return;
  }

  // 4. /about command
  if (text === '/about') {
    const aboutMsg = `<b>UzHamyon haqida</b>\n\nUzHamyon — O‘zbekiston foydalanuvchilari uchun shaxsiy moliya va budjet boshqaruvi tizimi.\n\nDaromad va xarajatlaringizni kuzatib boring, jamg‘arma maqsadlaringizni belgilang va sun’iy intellekt (UzHamyon AI) tavsiyalaridan foydalaning.\n\nBarcha ma’lumotlaringiz xavfsiz va shifrlangan holatda saqlanadi.`;
    await sendTelegramMessage(chatId, aboutMsg, 'Ilovani ochish', MINIAPP_URL);
    return;
  }

  // 5. Default fallback response
  const defaultMsg = `Assalomu alaykum, ${firstName}!\n\nUzHamyon ilovasi orqali daromad va xarajatlaringizni boshqarish uchun quyidagi tugmani bosing:`;
  await sendTelegramMessage(chatId, defaultMsg, "UzHamyon'ni ochish", MINIAPP_URL);
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
