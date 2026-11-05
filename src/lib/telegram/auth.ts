import crypto from 'node:crypto';
import { createClient, type Session, type User } from '@supabase/supabase-js';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramVerificationResult {
  valid: boolean;
  user?: TelegramUser;
  authDate?: number;
  queryId?: string;
  error?: string;
}

export interface TelegramAuthSession {
  success: boolean;
  user?: {
    id: string;
    email?: string;
    first_name: string;
    last_name?: string;
    telegram_id: number;
  };
  session?: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    token_type: string;
  };
  onboarding_completed: boolean;
  isNewUser: boolean;
  error?: string;
}

/**
 * Resolves the bot token from the server environment.
 * A hardcoded fallback is intentionally not provided: a leaked token would
 * allow forging signed Telegram initData for every user of the bot.
 */
function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN muhit o‘zgaruvchisi sozlanmagan');
  }
  return token;
}

/**
 * Validates Telegram WebApp initData string using the official Telegram algorithm:
 * HMAC-SHA256 with key "WebAppData" and bot token.
 */
export function verifyTelegramWebAppData(
  initData: string,
  botToken?: string
): TelegramVerificationResult {
  if (!initData || typeof initData !== 'string') {
    return { valid: false, error: 'Initialization data is missing or empty' };
  }

  let resolvedBotToken: string;
  try {
    resolvedBotToken = botToken || getTelegramBotToken();
  } catch {
    return { valid: false, error: 'Telegram bot konfiguratsiyasi topilmadi' };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      return { valid: false, error: 'Authentication hash is missing' };
    }

    urlParams.delete('hash');
    const items = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`);
    const dataCheckString = items.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(resolvedBotToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const calculatedBuf = Buffer.from(calculatedHash, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');

    if (calculatedBuf.length !== hashBuf.length || !crypto.timingSafeEqual(calculatedBuf, hashBuf)) {
      return { valid: false, error: 'Signature mismatch: data may have been tampered with' };
    }

    const authDate = parseInt(urlParams.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    // Disallow timestamps older than 24 hours (86,400s) to prevent replay attacks
    if (now - authDate > 86400 || authDate > now + 300) {
      return { valid: false, error: 'Authentication session has expired' };
    }

    const rawUser = urlParams.get('user');
    if (!rawUser) {
      return { valid: false, error: 'User data not found in Telegram payload' };
    }

    const user: TelegramUser = JSON.parse(rawUser);
    if (!user || !user.id) {
      return { valid: false, error: 'Invalid user payload' };
    }

    return {
      valid: true,
      user,
      authDate,
      queryId: urlParams.get('query_id') || undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to verify Telegram payload: ${message}` };
  }
}

import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
} from '../supabase/config.ts';

/**
 * Derives a deterministic internal email and secure password for a Telegram user.
 * This guarantees the user has a permanent, stable Supabase auth identity without exposing credentials.
 */
function deriveTelegramCredentials(telegramId: number) {
  const serviceKey = getSupabaseServiceRoleKey() || 'uzhamyon_telegram_auth_salt_2026';
  const botToken = getTelegramBotToken();
  
  const internalEmail = `tg_${telegramId}@telegram.uzhamyon.uz`;
  const internalPassword = crypto
    .createHmac('sha256', `${serviceKey}:${botToken}`)
    .update(`tg_user_auth_identity_${telegramId}`)
    .digest('hex');

  return { internalEmail, internalPassword };
}

/**
 * Authenticates or registers a verified Telegram user in Supabase.
 * - Single stable identity mapped to telegram_id.
 * - Never prompts for email/password.
 * - Preserves RLS and data isolation.
 */
export async function getOrCreateTelegramUser(tgUser: TelegramUser): Promise<TelegramAuthSession> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const anonKey = getSupabaseAnonKey();

  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  const { internalEmail, internalPassword } = deriveTelegramCredentials(tgUser.id);
  const firstName = tgUser.first_name || 'Foydalanuvchi';
  const lastName = tgUser.last_name || '';

  let isNewUser = false;
  let authUser: User | null = null;
  let authSession: Session | null = null;

  // 1. Attempt login with derived credentials
  const { data: signInData } = await publicClient.auth.signInWithPassword({
    email: internalEmail,
    password: internalPassword,
  });

  if (signInData?.user && signInData?.session) {
    authUser = signInData.user;
    authSession = signInData.session;
  } else {
    // 2. User doesn't exist yet, sign up automatically
    isNewUser = true;
    const { data: signUpData, error: signUpError } = await publicClient.auth.signUp({
      email: internalEmail,
      password: internalPassword,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          telegram_id: tgUser.id,
          telegram_username: tgUser.username || null,
        },
      },
    });

    if (signUpError || !signUpData.user) {
      // If error indicates already registered (e.g. race condition), attempt re-login
      const retry = await publicClient.auth.signInWithPassword({
        email: internalEmail,
        password: internalPassword,
      });
      if (retry.data?.user && retry.data?.session) {
        authUser = retry.data.user;
        authSession = retry.data.session;
        isNewUser = false;
      } else if (adminClient) {
        // If password mismatch occurred due to bot token rotation, locate existing user and update password
        let existingUserId: string | undefined;
        const { data: prof } = await adminClient
          .from('profiles')
          .select('id')
          .eq('email', internalEmail)
          .maybeSingle();

        if (prof?.id) {
          existingUserId = prof.id;
        } else {
          const { data: userList } = await adminClient.auth.admin.listUsers();
          existingUserId = userList?.users?.find((u) => u.email === internalEmail)?.id;
        }

        if (existingUserId) {
          await adminClient.auth.admin.updateUserById(existingUserId, {
            password: internalPassword,
            email_confirm: true,
          });
          const rotatedSignIn = await publicClient.auth.signInWithPassword({
            email: internalEmail,
            password: internalPassword,
          });
          if (rotatedSignIn.data?.user && rotatedSignIn.data?.session) {
            authUser = rotatedSignIn.data.user;
            authSession = rotatedSignIn.data.session;
            isNewUser = false;
          }
        }
      }

      if (!authUser || !authSession) {
        throw new Error(signUpError?.message || 'Telegram hisobini ro‘yxatdan o‘tkazishda xatolik yuz berdi');
      }
    } else {
      authUser = signUpData.user;
      authSession = signUpData.session;

      // If signUp did not immediately issue session (due to email confirm settings), sign in directly
      if (!authSession) {
        if (adminClient) {
          // Confirm user email automatically via admin
          await adminClient.auth.admin.updateUserById(authUser.id, { email_confirm: true });
        }
        const postConfirmSignIn = await publicClient.auth.signInWithPassword({
          email: internalEmail,
          password: internalPassword,
        });
        authUser = postConfirmSignIn.data.user;
        authSession = postConfirmSignIn.data.session;
      }
    }
  }

  if (!authUser || !authSession) {
    throw new Error('Telegram foydalanuvchisi uchun faol sessiya yaratilmadi');
  }

  // 3. Database client: prefer adminClient, otherwise user session client
  const dbClient =
    adminClient ||
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${authSession.access_token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

  // Ensure profiles table row exists and reflects telegram_id
  const { data: existingProfile } = await dbClient
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  let onboardingCompleted = existingProfile?.onboarding_completed ?? false;

  if (!existingProfile) {
    // Insert new profile
    const today = new Date().toISOString().split('T')[0];
    await dbClient.from('profiles').insert({
      id: authUser.id,
      first_name: firstName,
      last_name: lastName,
      email: internalEmail,
      role: 'teacher', // Matches existing DB schema enum/default
      is_active: true,
      onboarding_completed: false,
      onboarding_step: 1,
      onboarding_data: {
        telegram_id: tgUser.id,
        telegram_username: tgUser.username || null,
        language_code: tgUser.language_code || 'uz',
        is_telegram: true,
      },
      financial_start_date: today,
      declared_monthly_income: 0,
      declared_monthly_expenses: 0,
      target_monthly_expenses: 0,
      target_expense_reduction_percent: 0,
    });
    onboardingCompleted = false;
  } else {
    // Update existing profile metadata if username changed
    const currentData = (existingProfile.onboarding_data as Record<string, unknown>) || {};
    if (!currentData.telegram_id || currentData.telegram_username !== tgUser.username) {
      await dbClient
        .from('profiles')
        .update({
          onboarding_data: {
            ...currentData,
            telegram_id: tgUser.id,
            telegram_username: tgUser.username || null,
            is_telegram: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUser.id);
    }
  }

  return {
    success: true,
    user: {
      id: authUser.id,
      email: authUser.email,
      first_name: firstName,
      last_name: lastName,
      telegram_id: tgUser.id,
    },
    session: {
      access_token: authSession.access_token,
      refresh_token: authSession.refresh_token,
      expires_at: authSession.expires_at,
      token_type: authSession.token_type || 'bearer',
    },
    onboarding_completed: onboardingCompleted,
    isNewUser,
  };
}
