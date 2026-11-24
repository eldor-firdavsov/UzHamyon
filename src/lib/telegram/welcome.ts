import { callBotApi } from './botApi.ts';
import { botTexts } from '../i18n/bot.ts';
import type { Lang } from '../i18n/config.ts';

const MINIAPP = process.env.TELEGRAM_MINIAPP_URL || 'https://uzhamyon.vercel.app/';

/** Telegram id from the profile email (tg_<id>@telegram.uzhamyon.uz) or auth metadata. */
export function telegramIdOf(email: string | null | undefined, meta: Record<string, unknown> | null | undefined): number | null {
  const m = email?.match(/^tg_(\d+)@telegram\.uzhamyon\.uz$/);
  if (m) return Number(m[1]);
  const raw = meta?.telegram_id;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Sent once, right after registration: the fastest way to log is writing in this chat. */
export function buildRegistrationDoneMessage(firstName: string, lang: Lang = 'uz'): string {
  return botTexts(lang).registrationDone(firstName);
}

export async function sendRegistrationDoneMessage(chatId: number, firstName: string, lang: Lang = 'uz'): Promise<boolean> {
  const res = await callBotApi(
    'sendMessage',
    {
      chat_id: chatId,
      text: buildRegistrationDoneMessage(firstName, lang),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: botTexts(lang).addInApp, web_app: { url: MINIAPP } }]] },
    },
    { timeoutMs: 5_000 }
  );
  return !!res?.ok;
}
