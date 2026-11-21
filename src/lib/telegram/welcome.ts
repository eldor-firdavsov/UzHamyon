import { callBotApi } from './botApi.ts';
import { escapeHtml } from './html.ts';

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
export function buildRegistrationDoneMessage(firstName: string): string {
  return [
    `✅ <b>Tayyor, ${escapeHtml(firstName)}!</b>`,
    '',
    'Xarajatni shu chatga yozing — o‘zim qo‘shaman:',
    '<code>taksi 20000</code>',
    '<code>tushlik 45 ming</code>',
    '',
    '🎤 Ovozli xabar ham bo‘ladi.',
  ].join('\n');
}

export async function sendRegistrationDoneMessage(chatId: number, firstName: string): Promise<boolean> {
  const res = await callBotApi(
    'sendMessage',
    {
      chat_id: chatId,
      text: buildRegistrationDoneMessage(firstName),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '➕ Ilovada qo‘shish', web_app: { url: MINIAPP } }]] },
    },
    { timeoutMs: 5_000 }
  );
  return !!res?.ok;
}
