/**
 * One-time Telegram notices about goals (#33).
 *
 * - Completed: "🎉 Tabriklaymiz! «<goal>» maqsadingizga yetdingiz!" — once per goal.
 * - Deadline passed (daily cron): one friendly notice suggesting a new date — once per
 *   goal per target date (a DB trigger resets the flag when target_date changes).
 *
 * "Once" is guaranteed by claiming the goal with a conditional UPDATE
 * (… WHERE <flag> IS NULL) before sending: two parallel callers cannot both claim it.
 * Requires migration 013 (the flag columns); without it these functions do nothing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { botTexts } from '../i18n/bot.ts';
import { langForProfile, type Lang } from '../i18n/config.ts';
import { todayTashkent } from '../time/tashkent.ts';

export function buildGoalCompletedMessage(goalName: string, lang: Lang = 'uz'): string {
  return botTexts(lang).goalCompleted(goalName);
}

export function buildGoalDeadlineMessage(goalName: string, targetDate: string, lang: Lang = 'uz'): string {
  return botTexts(lang).goalDeadline(goalName, targetDate);
}

/** Telegram user id stored for a profile (internal email or onboarding_data.telegram_id). */
export function telegramIdFromProfile(profile: {
  email?: string | null;
  onboarding_data?: Record<string, unknown> | null;
} | null | undefined): number | null {
  if (!profile) return null;
  const m = profile.email?.match(/^tg_(\d+)@telegram\.uzhamyon\.uz$/);
  if (m) return Number(m[1]);
  const raw = profile.onboarding_data?.telegram_id;
  const n = raw !== undefined && raw !== null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message || '');
  return error.code === '42703' || error.code === 'PGRST204' || msg.includes('notified_at');
}

/**
 * Sends the completion notice for every newly completed goal of this user.
 * Safe to call after any goal change (bot confirm, web contribution, goal edit).
 * Never throws.
 */
export async function notifyCompletedGoals(
  client: SupabaseClient,
  options: { userId?: string; chatId?: number; lang?: Lang } = {}
): Promise<number> {
  try {
    let userId = options.userId;
    if (!userId) {
      const { data } = await client.auth.getUser();
      userId = data?.user?.id;
    }
    if (!userId) return 0;

    const { data: claimed, error } = await client
      .from('financial_goals')
      .update({ completed_notified_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('completed_notified_at', null)
      .select('id, name');

    if (error) {
      if (!isMissingColumn(error)) console.warn('[goalNotices] completion claim failed:', error.message);
      return 0;
    }
    if (!claimed || claimed.length === 0) return 0;

    let chatId = options.chatId ?? null;
    let lang = options.lang;
    if (!chatId || !lang) {
      const { data: profile } = await client
        .from('profiles')
        .select('email, onboarding_data')
        .eq('id', userId)
        .maybeSingle();
      chatId = chatId ?? telegramIdFromProfile(profile);
      lang = lang ?? langForProfile(profile?.onboarding_data);
    }
    if (!chatId) return 0; // web-only user: nothing to send

    const { sendTelegramMessage, MINIAPP_URL } = await import('../telegram/bot.ts');
    let sent = 0;
    for (const goal of claimed) {
      const res = await sendTelegramMessage(chatId, buildGoalCompletedMessage(goal.name, lang), botTexts(lang).openApp, MINIAPP_URL);
      if (res?.ok) sent++;
    }
    return sent;
  } catch (err) {
    console.warn('[goalNotices] completion notice failed:', err instanceof Error ? err.message : err);
    return 0;
  }
}

/**
 * Daily cron: one notice per in-progress goal whose target date has passed (Tashkent date).
 * `adminClient` must use the service role key. Never throws.
 */
export async function sendGoalDeadlineNotices(
  adminClient: SupabaseClient,
  options: { limit?: number; now?: Date } = {}
): Promise<{ claimed: number; sent: number }> {
  const result = { claimed: 0, sent: 0 };
  try {
    const today = todayTashkent(options.now);
    // 1. Find candidates (bounded), 2. claim exactly those with a conditional UPDATE.
    const { data: due, error: findError } = await adminClient
      .from('financial_goals')
      .select('id')
      .eq('status', 'in_progress')
      .lt('target_date', today)
      .is('deadline_notified_at', null)
      .order('target_date', { ascending: true })
      .limit(options.limit ?? 500);

    if (findError) {
      if (!isMissingColumn(findError)) console.warn('[goalNotices] deadline lookup failed:', findError.message);
      return result;
    }
    if (!due || due.length === 0) return result;

    const { data: claimed, error } = await adminClient
      .from('financial_goals')
      .update({ deadline_notified_at: new Date().toISOString() })
      .in('id', due.map((g) => g.id))
      .eq('status', 'in_progress')
      .is('deadline_notified_at', null)
      .select('id, user_id, name, target_date');

    if (error) {
      console.warn('[goalNotices] deadline claim failed:', error.message);
      return result;
    }
    if (!claimed || claimed.length === 0) return result;
    result.claimed = claimed.length;

    const userIds = Array.from(new Set(claimed.map((g) => g.user_id)));
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email, onboarding_data')
      .in('id', userIds);
    const chatByUser = new Map<string, number>();
    const langByUser = new Map<string, Lang>();
    for (const p of profiles || []) {
      const tg = telegramIdFromProfile(p);
      if (tg) chatByUser.set(p.id, tg);
      langByUser.set(p.id, langForProfile(p.onboarding_data));
    }

    const { sendTelegramMessage, MINIAPP_URL } = await import('../telegram/bot.ts');
    for (const goal of claimed) {
      const chatId = chatByUser.get(goal.user_id);
      if (!chatId) continue;
      const lang = langByUser.get(goal.user_id) ?? 'uz';
      const res = await sendTelegramMessage(
        chatId,
        buildGoalDeadlineMessage(goal.name, goal.target_date, lang),
        botTexts(lang).openGoal,
        MINIAPP_URL
      );
      if (res?.ok) result.sent++;
      await new Promise((r) => setTimeout(r, 50));
    }
    return result;
  } catch (err) {
    console.warn('[goalNotices] deadline notices failed:', err instanceof Error ? err.message : err);
    return result;
  }
}
