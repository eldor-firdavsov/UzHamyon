import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '../supabase/config.ts';
import { sendTelegramMessage, setTelegramChatMenuButton, MINIAPP_URL } from './bot.ts';

export interface TelegramRecipient {
  userId: string;
  telegramId: number;
  firstName: string;
  username?: string | null;
}

export interface ReminderBroadcastResult {
  total: number;
  sent: number;
  blocked: number;
  failed: number;
  details: Array<{
    telegramId: number;
    firstName: string;
    status: 'sent' | 'blocked' | 'failed';
    error?: string;
  }>;
}

function getAdminClient(providedClient?: SupabaseClient): SupabaseClient | null {
  if (providedClient) return providedClient;
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Fetches all registered Telegram users from Supabase profiles.
 * Extracts Telegram IDs from internal emails (tg_<id>@telegram.uzhamyon.uz)
 * or onboarding_data.telegram_id.
 */
export async function getRegisteredTelegramUsers(client?: SupabaseClient): Promise<TelegramRecipient[]> {
  const db = getAdminClient(client);
  if (!db) {
    throw new Error('Supabase admin mijozi sozlanmagan');
  }

  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, first_name, email, onboarding_data');

  if (error || !profiles) {
    console.error('[Reminders] Failed to fetch profiles:', error);
    return [];
  }

  const userMap = new Map<number, TelegramRecipient>();

  for (const p of profiles) {
    let tgId: number | null = null;

    // 1. Check internal telegram email
    if (p.email?.startsWith('tg_') && p.email?.includes('@telegram.uzhamyon.uz')) {
      const raw = p.email.replace('tg_', '').replace('@telegram.uzhamyon.uz', '');
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) {
        tgId = parsed;
      }
    }

    // 2. Check onboarding_data jsonb
    const obData = p.onboarding_data as Record<string, unknown> | null;
    if (!tgId && obData?.telegram_id) {
      const parsed = parseInt(String(obData.telegram_id), 10);
      if (!isNaN(parsed) && parsed > 0) {
        tgId = parsed;
      }
    }

    if (tgId && !userMap.has(tgId)) {
      const rawName = p.first_name?.trim();
      const firstName = rawName && rawName !== 'Foydalanuvchi' ? rawName : 'aziz foydalanuvchi';
      userMap.set(tgId, {
        userId: p.id,
        telegramId: tgId,
        firstName,
        username: typeof obData?.telegram_username === 'string' ? obData.telegram_username : null,
      });
    }
  }

  return Array.from(userMap.values());
}

/**
 * Builds a friendly, motivating transaction reminder message in Uzbek
 */
export function buildTransactionReminderMessage(firstName: string): string {
  return `Assalomu alaykum, <b>${firstName}</b>! 👋

Bugungi daromad va xarajatlaringizni UzHamyon'ga kiritishni unutmadingizmi? ✍️

Moliyaviy nazorat va jamg‘arma maqsadlariga erishishning eng muhim qoidasi — har kungi xarajatlarni o‘z vaqtida qayd etib borishdir.

<b>Siz uchun 2 ta juda oson yo‘l bor:</b>
1️⃣ <b>Quyidagi tugma orqali</b> UzHamyon ilovasini ochib kiritish;
2️⃣ <b>Shu yerning o‘ziga xabar yozish</b> (UzHamyon AI darhol tushunadi):
   • <i>«Tushlikka 45 000 so‘m ishlatdim»</i>
   • <i>«Bozorlik 200 000 so‘m»</i>
   • <i>«Taksiga 18 000 so‘m»</i>
   • <i>«Oylik maoshim 5 000 000 so‘m tushdi»</i>

Ilovani ochish uchun pastdagi tugmani bosing yoki chatning pastki chap burchagidagi <b>«UzHamyon»</b> menyu tugmasidan foydalaning! 👇`;
}

/**
 * Sends a personalized transaction reminder to a single Telegram user
 * and ensures the chat menu button is active on their chat window.
 */
export async function sendTransactionReminderToUser(
  recipient: TelegramRecipient
): Promise<{ ok: boolean; status: 'sent' | 'blocked' | 'failed'; error?: string }> {
  // 1. Ensure chat menu button is set for this user
  await setTelegramChatMenuButton(recipient.telegramId).catch(() => {});

  // 2. Build message & send via Telegram Bot API
  const messageText = buildTransactionReminderMessage(recipient.firstName);
  const result = await sendTelegramMessage(
    recipient.telegramId,
    messageText,
    "🚀 UzHamyon'ni ochish",
    MINIAPP_URL
  );

  if (result?.ok) {
    return { ok: true, status: 'sent' };
  }

  // Handle Telegram Bot API errors (e.g. 403 user blocked bot)
  const desc = result?.description || 'Noma’lum xato';
  const isBlocked = /blocked|deactivated|chat not found/i.test(desc);

  return {
    ok: false,
    status: isBlocked ? 'blocked' : 'failed',
    error: desc,
  };
}

/**
 * Broadcasts daily transaction reminders to all registered Telegram users.
 * Applies a 60ms delay between messages to strictly honor Telegram's rate limit (max 30 msgs/sec).
 */
export async function broadcastDailyTransactionReminders(
  client?: SupabaseClient
): Promise<ReminderBroadcastResult> {
  const recipients = await getRegisteredTelegramUsers(client);

  const results: ReminderBroadcastResult = {
    total: recipients.length,
    sent: 0,
    blocked: 0,
    failed: 0,
    details: [],
  };

  for (const recipient of recipients) {
    try {
      const res = await sendTransactionReminderToUser(recipient);
      if (res.status === 'sent') {
        results.sent++;
      } else if (res.status === 'blocked') {
        results.blocked++;
      } else {
        results.failed++;
      }

      results.details.push({
        telegramId: recipient.telegramId,
        firstName: recipient.firstName,
        status: res.status,
        error: res.error,
      });
    } catch (err) {
      results.failed++;
      results.details.push({
        telegramId: recipient.telegramId,
        firstName: recipient.firstName,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Rate-limit pause (60ms = ~16 messages/second, well within Telegram's 30/s limit)
    await new Promise((r) => setTimeout(r, 60));
  }

  return results;
}
