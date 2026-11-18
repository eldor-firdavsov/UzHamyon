/**
 * Single entry point for Telegram Bot API calls (#37).
 *
 * Every call returns Telegram's JSON response (`{ ok, result }` or
 * `{ ok: false, error_code, description }`), or null on a network error.
 * `ok: false` is always logged with the method, error_code and description —
 * never the bot token or the message text.
 */

export interface BotApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
}

export function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN muhit o‘zgaruvchisi sozlanmagan');
  }
  return token;
}

/** Errors that are expected in normal use and should not be logged as errors. */
function isBenignError(method: string, description: string): boolean {
  // Editing a message to the same text, or answering an old callback query.
  if (method === 'editMessageText' && /message is not modified/i.test(description)) return true;
  if (method === 'answerCallbackQuery' && /query is too old|query ID is invalid/i.test(description)) return true;
  return false;
}

/** True when Telegram says this user blocked the bot / the chat is gone (send to them is pointless). */
export function isBlockedByUser(res: Pick<BotApiResponse, 'ok' | 'error_code' | 'description'> | null | undefined): boolean {
  if (!res || res.ok) return false;
  const d = res.description || '';
  return res.error_code === 403 || /blocked|deactivated|chat not found|user is deactivated/i.test(d);
}

export async function callBotApi<T = unknown>(
  method: string,
  payload?: Record<string, unknown>,
  options: { timeoutMs?: number } = {}
): Promise<BotApiResponse<T> | null> {
  const url = `https://api.telegram.org/bot${getBotToken()}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
    const data = (await res.json().catch(() => null)) as BotApiResponse<T> | null;
    if (!data) {
      console.error(`[BotAPI] ${method} failed: HTTP ${res.status} with a non-JSON body`);
      return { ok: false, error_code: res.status, description: `HTTP ${res.status}` };
    }
    if (!data.ok) {
      const description = data.description || 'unknown error';
      const log = isBenignError(method, description) ? console.warn : console.error;
      log(`[BotAPI] ${method} failed: ${data.error_code ?? res.status} ${description}`);
    }
    return data;
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error';
    const message = err instanceof Error ? err.message : String(err);
    // The token is part of the URL; never print the URL.
    console.error(`[BotAPI] ${method} network error: ${name}: ${message.replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<token>')}`);
    return null;
  }
}
