/**
 * "Delete my data" for Telegram users.
 *
 * Flow: /delete → the bot shows what will be deleted (real counts) with
 * [🗑 Ha, hammasini o‘chirish] [❌ Bekor qilish]. The confirm button carries a signed,
 * 5-minute token bound to this Telegram user, so it works on any server instance without
 * extra storage and cannot be reused by someone else or later.
 *
 * Deleting the Supabase auth user removes the profile and every finance row
 * (transactions, goals, goal contributions, budgets, own categories, pending AI actions,
 * AI chats, insights, import jobs) through ON DELETE CASCADE.
 */

import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '../supabase/config.ts';
import { findAuthUserIdByEmail } from './auth.ts';
import { botTexts } from '../i18n/bot.ts';
import type { Lang } from '../i18n/config.ts';

export const DELETE_CONFIRM_TTL_MS = 5 * 60 * 1000;
export const DELETE_CALLBACK_PREFIX = 'acct_del:';
export const DELETE_CANCEL_CALLBACK = 'acct_del_no';

const DEV_ONLY_SECRET = 'uzhamyon-dev-only-account-deletion-secret';

function getSigningSecret(): string {
  const secret = process.env.INTERNAL_AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('INTERNAL_AUTH_SECRET muhit o‘zgaruvchisi sozlanmagan');
  }
  return DEV_ONLY_SECRET;
}

function signature(telegramId: number, expiresAtMs: number): string {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(`account-delete:${telegramId}:${expiresAtMs}`)
    .digest('base64url')
    .slice(0, 22);
}

/** Token for the confirm button: "<expiry base36>.<signature>" (fits Telegram's 64-byte callback_data). */
export function createDeletionToken(telegramId: number, now: number = Date.now()): string {
  const expiresAtMs = now + DELETE_CONFIRM_TTL_MS;
  return `${expiresAtMs.toString(36)}.${signature(telegramId, expiresAtMs)}`;
}

export function verifyDeletionToken(
  token: string,
  telegramId: number,
  now: number = Date.now()
): 'ok' | 'expired' | 'invalid' {
  const [expPart, sig] = token.split('.');
  const expiresAtMs = parseInt(expPart || '', 36);
  if (!Number.isFinite(expiresAtMs) || !sig) return 'invalid';
  const expected = signature(telegramId, expiresAtMs);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'invalid';
  if (now > expiresAtMs) return 'expired';
  return 'ok';
}

/** "/delete", "/delete@uz_hamyonbot", or a plain-language request. */
export function isDeleteDataRequest(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[‘’ʻʼ`']/g, '');
  if (/^\/delete(@uz_hamyonbot)?$/.test(t)) return true;
  if (/^(удали|удалить)\s+(все\s+)?(мои\s+)?(данные|аккаунт)/.test(t)) return true;
  if (/^delete\s+(all\s+)?my\s+(data|account)/.test(t)) return true;
  return /^(malumotlarimni|hisobimni|akkauntimni)\s+(ochir|ochirish|ochiring|ochirib\s+tashla)/.test(t);
}

export interface UserDataCounts {
  transactions: number;
  goals: number;
  budgets: number;
  categories: number;
}

/** Counts the user's own rows (RLS: the user client only sees its own data). */
export async function countUserData(client: SupabaseClient, userId: string): Promise<UserDataCounts> {
  const count = async (table: string) => {
    const { count: n } = await client
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    return n ?? 0;
  };
  const [transactions, goals, budgets, categories] = await Promise.all([
    count('transactions'),
    count('financial_goals'),
    count('budgets'),
    count('categories'),
  ]);
  return { transactions, goals, budgets, categories };
}

export function buildDeletionPrompt(c: UserDataCounts, lang: Lang = 'uz'): string {
  return botTexts(lang).deletion.prompt(c);
}

export function buildDeletionKeyboard(telegramId: number, now: number = Date.now(), lang: Lang = 'uz') {
  const t = botTexts(lang).deletion;
  return [
    [{ text: t.confirmBtn, callback_data: `${DELETE_CALLBACK_PREFIX}${createDeletionToken(telegramId, now)}` }],
    [{ text: t.cancelBtn, callback_data: DELETE_CANCEL_CALLBACK }],
  ];
}

/** Uzbek texts (kept for existing callers); use deletionMessages(lang) for others. */
export const DELETION_MESSAGES = botTexts('uz').deletion;

export function deletionMessages(lang: Lang = 'uz') {
  return botTexts(lang).deletion;
}

/** Deletes the Supabase auth user of this Telegram user (cascades to all data). */
export async function deleteTelegramAccount(
  telegramId: number,
  adminClient?: SupabaseClient
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'error'; detail?: string }> {
  const serviceKey = getSupabaseServiceRoleKey();
  const admin =
    adminClient ||
    (serviceKey
      ? createClient(getSupabaseUrl(), serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : null);
  if (!admin) return { ok: false, reason: 'error', detail: 'no admin client' };

  const userId = await findAuthUserIdByEmail(admin, `tg_${telegramId}@telegram.uzhamyon.uz`);
  if (!userId) return { ok: false, reason: 'not_found' };

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, reason: 'error', detail: error.message };
  return { ok: true };
}
