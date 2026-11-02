import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

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
 * Validates Telegram WebApp initData string using the official Telegram algorithm:
 * HMAC-SHA256 with key "WebAppData" and bot token.
 */
export function verifyTelegramWebAppData(
  initData: string,
  botToken: string = process.env.TELEGRAM_BOT_TOKEN || '9085840931:AAHXfmvbGSqJYKARmpwsvh352SeR2dMHOo4'
): TelegramVerificationResult {
  if (!initData || typeof initData !== 'string') {
    return { valid: false, error: 'Initialization data is missing or empty' };
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

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
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

/**
 * Derives a deterministic internal email and secure password for a Telegram user.
 * This guarantees the user has a permanent, stable Supabase auth identity without exposing credentials.
 */
function deriveTelegramCredentials(telegramId: number) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'uzhamyon_internal_secret';
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '9085840931:AAHXfmvbGSqJYKARmpwsvh352SeR2dMHOo4';
  
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error('Supabase configuration missing in environment');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { internalEmail, internalPassword } = deriveTelegramCredentials(tgUser.id);
  const firstName = tgUser.first_name || 'Foydalanuvchi';
  const lastName = tgUser.last_name || '';

  let isNewUser = false;
  let authUser: any = null;
  let authSession: any = null;

  // 1. Attempt login with derived credentials
  const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
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
      } else {
        throw new Error(signUpError?.message || 'Telegram hisobini ro‘yxatdan o‘tkazishda xatolik yuz berdi');
      }
    } else {
      authUser = signUpData.user;
      authSession = signUpData.session;

      // If signUp did not immediately issue session (due to email confirm settings), sign in directly
      if (!authSession) {
        // Confirm user email automatically via admin
        await adminClient.auth.admin.updateUserById(authUser.id, { email_confirm: true });
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

  // 3. Ensure profiles table row exists and reflects telegram_id
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  let onboardingCompleted = existingProfile?.onboarding_completed ?? false;

  if (!existingProfile) {
    // Insert new profile
    const today = new Date().toISOString().split('T')[0];
    await adminClient.from('profiles').insert({
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
      await adminClient
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
