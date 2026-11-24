import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '../supabase/config.ts';
import { sendTelegramMessage, MINIAPP_URL } from './bot.ts';
import { botTexts } from '../i18n/bot.ts';
import { langForProfile, type Lang } from '../i18n/config.ts';
import { isBlockedByUser, type BotApiResponse } from './botApi.ts';
import { todayTashkent } from '../time/tashkent.ts';

/**
 * Daily 20:00 reminder broadcast (#36).
 *
 * - Recipients are read page by page (keyset on profiles.id), never all at once.
 * - Messages go out in batches (BATCH_SIZE per BATCH_INTERVAL_MS, below Telegram's ~30/s).
 * - With migration 014: users who blocked the bot are skipped (telegram_blocked_at), each
 *   user gets at most one reminder per Tashkent day (last_reminder_on), and a run that
 *   hits its time budget can be continued safely by another invocation.
 * - Without 014: everything still works in one run, without skip/resume tracking.
 */

export const REMINDER_PAGE_SIZE = 1000;
export const REMINDER_BATCH_SIZE = 25;
export const REMINDER_BATCH_INTERVAL_MS = 1000;
export const REMINDER_TIME_BUDGET_MS = 45_000;

export interface TelegramRecipient {
  userId: string;
  telegramId: number;
  firstName: string;
  username?: string | null;
  /** False = never logged anything: gets the first-entry message instead (see below). */
  hasLogged?: boolean;
  /** Whole days since the profile was created (Tashkent dates). */
  daysSinceSignup?: number;
  /** The user's language (Uzbek unless they chose another). */
  lang?: Lang;
}

export interface ReminderBroadcastResult {
  total: number;
  sent: number;
  blocked: number;
  failed: number;
  /** True when the time budget ran out before every recipient was processed. */
  remaining: boolean;
  /** False when migration 014 is missing (no skip/resume tracking). */
  trackingAvailable: boolean;
  /** Recipients left out today on purpose (see shouldRemindToday). */
  skipped: number;
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

interface ProfileRow {
  id: string;
  first_name?: string | null;
  email?: string | null;
  onboarding_data?: Record<string, unknown> | null;
  created_at?: string | null;
  /** Filled in by the broadcast (from activity_days), not a profiles column. */
  has_logged?: boolean;
}

/** Telegram recipient for a profile row, or null if it is not a Telegram user. */
export function toRecipient(p: ProfileRow): TelegramRecipient | null {
  let tgId: number | null = null;
  const m = p.email?.match(/^tg_(\d+)@telegram\.uzhamyon\.uz$/);
  if (m) tgId = Number(m[1]);
  const obData = p.onboarding_data || null;
  if (!tgId && obData?.telegram_id) {
    const parsed = parseInt(String(obData.telegram_id), 10);
    if (!isNaN(parsed) && parsed > 0) tgId = parsed;
  }
  if (!tgId) return null;
  const rawName = p.first_name?.trim();
  const lang = langForProfile(obData);
  return {
    userId: p.id,
    telegramId: tgId,
    lang,
    firstName: rawName && rawName !== 'Foydalanuvchi' ? rawName : botTexts(lang).fallbackName,
    username: typeof obData?.telegram_username === 'string' ? obData.telegram_username : null,
    hasLogged: p.has_logged,
    daysSinceSignup: p.created_at ? daysBetween(p.created_at.slice(0, 10), todayTashkent()) : undefined,
  };
}

function daysBetween(fromDate: string, toDate: string): number {
  const ms = Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

/**
 * People who already log get the reminder every day. People who never logged anything get the
 * first-entry message on day 1, 3 and 7 after signing up, then once a week — a daily ping they
 * ignore only teaches them to mute or block the bot.
 */
export function shouldRemindToday(r: Pick<TelegramRecipient, 'hasLogged' | 'daysSinceSignup'>): boolean {
  if (r.hasLogged !== false) return true;
  const d = r.daysSinceSignup;
  if (d === undefined) return true;
  return d === 1 || d === 3 || (d >= 7 && d % 7 === 0);
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message || '');
  return error.code === '42703' || error.code === 'PGRST204' || /telegram_blocked_at|last_reminder_on/.test(msg);
}

const TELEGRAM_PROFILE_FILTER = 'email.like.tg_%@telegram.uzhamyon.uz,onboarding_data->>telegram_id.not.is.null';

/**
 * One page of reminder candidates after `afterId` (keyset pagination).
 * With tracking: skips blocked users and users already reminded on `today`.
 */
export async function fetchReminderCandidatesPage(
  db: SupabaseClient,
  options: { afterId?: string; today: string; tracking: boolean; pageSize?: number }
): Promise<{ rows: ProfileRow[]; tracking: boolean; error?: string }> {
  const build = (tracking: boolean) => {
    // One logical tree: (Telegram user) AND (not reminded today) — a single `or` parameter.
    const filter = tracking
      ? `and(or(${TELEGRAM_PROFILE_FILTER}),or(last_reminder_on.is.null,last_reminder_on.lt.${options.today}))`
      : TELEGRAM_PROFILE_FILTER;
    let q = db
      .from('profiles')
      .select('id, first_name, email, onboarding_data, created_at')
      .or(filter)
      .order('id', { ascending: true })
      .limit(options.pageSize ?? REMINDER_PAGE_SIZE);
    if (options.afterId) q = q.gt('id', options.afterId);
    if (tracking) q = q.is('telegram_blocked_at', null);
    return q;
  };

  let { data, error } = await build(options.tracking);
  let tracking = options.tracking;
  if (error && tracking && isMissingColumnError(error)) {
    console.warn('[Reminders] Migration 014 not applied: sending without skip/resume tracking.');
    tracking = false;
    ({ data, error } = await build(false));
  }
  if (error) return { rows: [], tracking, error: error.message };
  return { rows: (data || []) as ProfileRow[], tracking };
}

/** All Telegram recipients (used by the authenticated status view for a count). */
export async function getRegisteredTelegramUsers(client?: SupabaseClient): Promise<TelegramRecipient[]> {
  const db = getAdminClient(client);
  if (!db) throw new Error('Supabase admin mijozi sozlanmagan');

  const byTelegramId = new Map<number, TelegramRecipient>();
  let afterId: string | undefined;
  for (;;) {
    const page = await fetchReminderCandidatesPage(db, { afterId, today: todayTashkent(), tracking: false });
    if (page.error) {
      console.error('[Reminders] Failed to fetch profiles:', page.error);
      break;
    }
    for (const row of page.rows) {
      const r = toRecipient(row);
      if (r && !byTelegramId.has(r.telegramId)) byTelegramId.set(r.telegramId, r);
    }
    if (page.rows.length < REMINDER_PAGE_SIZE) break;
    afterId = page.rows[page.rows.length - 1].id;
  }
  return Array.from(byTelegramId.values());
}

/** The daily reminder, in the user's language. */
export function buildTransactionReminderMessage(firstName: string, lang: Lang = 'uz'): string {
  return botTexts(lang).reminder(firstName);
}

/** For someone who never logged anything: one concrete example they can copy and send. */
export function buildFirstEntryReminderMessage(firstName: string, lang: Lang = 'uz'): string {
  return botTexts(lang).firstEntryReminder(firstName);
}

export type ReminderSendStatus = 'sent' | 'blocked' | 'failed';

/** Classifies a Bot API response for one reminder. */
export function classifySendResult(res: BotApiResponse | null): { status: ReminderSendStatus; retryAfterSec?: number } {
  if (res?.ok) return { status: 'sent' };
  if (isBlockedByUser(res)) return { status: 'blocked' };
  return { status: 'failed', retryAfterSec: res?.parameters?.retry_after };
}

/** Sends the reminder to one user (the menu button is global now, #38). */
export async function sendTransactionReminderToUser(
  recipient: TelegramRecipient
): Promise<{ status: ReminderSendStatus; retryAfterSec?: number }> {
  const first = recipient.hasLogged === false;
  const lang = recipient.lang ?? 'uz';
  const t = botTexts(lang);
  const res = await sendTelegramMessage(
    recipient.telegramId,
    first ? buildFirstEntryReminderMessage(recipient.firstName, lang) : buildTransactionReminderMessage(recipient.firstName, lang),
    first ? t.addInApp : t.openUzHamyonRocket,
    MINIAPP_URL
  );
  return classifySendResult(res);
}

export interface ReminderLoopDeps {
  fetchPage: (afterId: string | undefined) => Promise<{ rows: ProfileRow[]; tracking: boolean; error?: string }>;
  send: (r: TelegramRecipient) => Promise<{ status: ReminderSendStatus; retryAfterSec?: number }>;
  markSent: (userIds: string[]) => Promise<void>;
  markBlocked: (userIds: string[]) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** False = leave this recipient out today (counted as skipped). Default: everyone. */
  shouldSend?: (r: TelegramRecipient) => boolean;
  timeBudgetMs?: number;
  batchSize?: number;
  batchIntervalMs?: number;
  pageSize?: number;
}

/**
 * The broadcast loop, independent of Supabase/Telegram so it can be tested offline.
 */
export async function runReminderLoop(deps: ReminderLoopDeps): Promise<ReminderBroadcastResult> {
  const started = deps.now();
  const budget = deps.timeBudgetMs ?? REMINDER_TIME_BUDGET_MS;
  const batchSize = deps.batchSize ?? REMINDER_BATCH_SIZE;
  const interval = deps.batchIntervalMs ?? REMINDER_BATCH_INTERVAL_MS;
  const pageSize = deps.pageSize ?? REMINDER_PAGE_SIZE;

  const result: ReminderBroadcastResult = {
    total: 0, sent: 0, blocked: 0, failed: 0, remaining: false, trackingAvailable: true, skipped: 0,
  };
  const seenTelegramIds = new Set<number>();
  let afterId: string | undefined;

  for (;;) {
    const page = await deps.fetchPage(afterId);
    result.trackingAvailable = page.tracking;
    if (page.error) {
      console.error('[Reminders] Failed to fetch recipients:', page.error);
      break;
    }

    const recipients: TelegramRecipient[] = [];
    for (const row of page.rows) {
      const r = toRecipient(row);
      if (r && !seenTelegramIds.has(r.telegramId)) {
        seenTelegramIds.add(r.telegramId);
        if (deps.shouldSend && !deps.shouldSend(r)) result.skipped++;
        else recipients.push(r);
      }
    }

    for (let i = 0; i < recipients.length; i += batchSize) {
      if (deps.now() - started >= budget) {
        result.remaining = true;
        return result;
      }
      const batch = recipients.slice(i, i + batchSize);
      const outcomes = await Promise.all(
        batch.map((r) => deps.send(r).catch(() => ({ status: 'failed' as const, retryAfterSec: undefined })))
      );
      result.total += batch.length;

      const sentIds: string[] = [];
      const blockedIds: string[] = [];
      let retryAfter = 0;
      outcomes.forEach((o, idx) => {
        if (o.status === 'sent') {
          result.sent++;
          sentIds.push(batch[idx].userId);
        } else if (o.status === 'blocked') {
          result.blocked++;
          blockedIds.push(batch[idx].userId);
        } else {
          result.failed++;
          if (o.retryAfterSec) retryAfter = Math.max(retryAfter, o.retryAfterSec);
        }
      });

      if (page.tracking) {
        if (sentIds.length) await deps.markSent(sentIds);
        if (blockedIds.length) await deps.markBlocked(blockedIds);
      }

      // Telegram asked us to slow down (429): respect retry_after (bounded).
      await deps.sleep(Math.max(interval, Math.min(retryAfter, 30) * 1000));
    }

    if (page.rows.length < pageSize) break;
    afterId = page.rows[page.rows.length - 1].id;
  }

  return result;
}

/**
 * Broadcasts daily transaction reminders to registered Telegram users within a time budget.
 */
export async function broadcastDailyTransactionReminders(
  client?: SupabaseClient,
  options: { timeBudgetMs?: number } = {}
): Promise<ReminderBroadcastResult> {
  const db = getAdminClient(client);
  if (!db) throw new Error('Supabase admin mijozi sozlanmagan');

  const today = todayTashkent();
  let tracking = true;

  return runReminderLoop({
    fetchPage: async (afterId) => {
      const page = await fetchReminderCandidatesPage(db, { afterId, today, tracking });
      tracking = page.tracking;
      await markWhoHasLogged(db, page.rows);
      return page;
    },
    send: sendTransactionReminderToUser,
    shouldSend: shouldRemindToday,
    markSent: async (ids) => {
      const { error } = await db.from('profiles').update({ last_reminder_on: today }).in('id', ids);
      if (error) console.warn('[Reminders] markSent failed:', error.message);
    },
    markBlocked: async (ids) => {
      const { error } = await db
        .from('profiles')
        .update({ telegram_blocked_at: new Date().toISOString() })
        .in('id', ids);
      if (error) console.warn('[Reminders] markBlocked failed:', error.message);
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: Date.now,
    timeBudgetMs: options.timeBudgetMs,
  });
}

/**
 * Sets has_logged on each row from activity_days (migration 016). On any error rows stay
 * undefined, which means "treat as a regular user" — the old behaviour.
 */
async function markWhoHasLogged(db: SupabaseClient, rows: ProfileRow[]): Promise<void> {
  const ids = rows.map((r) => r.id);
  const logged = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await db.from('activity_days').select('user_id').in('user_id', chunk).limit(20_000);
    if (error) {
      console.warn('[Reminders] activity_days lookup failed:', error.message);
      return;
    }
    for (const row of data || []) logged.add((row as { user_id: string }).user_id);
  }
  for (const r of rows) r.has_logged = logged.has(r.id);
}

/**
 * Daily cron step: one friendly notice per in-progress goal whose deadline passed (#33).
 */
export async function runDailyGoalDeadlineNotices(client?: SupabaseClient): Promise<{ claimed: number; sent: number }> {
  const db = getAdminClient(client);
  if (!db) {
    console.warn('[Reminders] Goal deadline notices skipped: no admin client');
    return { claimed: 0, sent: 0 };
  }
  const { sendGoalDeadlineNotices } = await import('../goals/notifications.ts');
  // Bounded so it fits in the same invocation as the reminder broadcast.
  return sendGoalDeadlineNotices(db, { limit: 100 });
}
