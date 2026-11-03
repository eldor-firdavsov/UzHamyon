import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramWebAppData, getOrCreateTelegramUser } from '@/lib/telegram/auth';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initData } = body;

    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Telegram initData berilmadi' },
        { status: 400 }
      );
    }

    // 1. Verify cryptographic HMAC signature
    const verification = verifyTelegramWebAppData(initData);
    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Telegram avtorizatsiyasi tasdiqlanmadi' },
        { status: 401 }
      );
    }

    // 2. Identify or create Supabase user
    const authResult = await getOrCreateTelegramUser(verification.user);

    if (!authResult.success || !authResult.session) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Foydalanuvchi hisobini yuklab bo‘lmadi' },
        { status: 500 }
      );
    }

    // 3. Create response and attach Supabase auth session cookies
    const res = NextResponse.json({
      success: true,
      user: authResult.user,
      session: authResult.session,
      onboarding_completed: authResult.onboarding_completed,
      isNewUser: authResult.isNewUser,
    });

    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, {
              ...options,
              sameSite: 'none', // Critical for Telegram Mini App iframe / WebApp webview
              secure: true,
              httpOnly: true,
            });
          });
        },
      },
    });

    // Establish Supabase session so cookies are written
    await supabase.auth.setSession({
      access_token: authResult.session.access_token,
      refresh_token: authResult.session.refresh_token,
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/auth/telegram:', err);
    return NextResponse.json(
      { success: false, error: `Ichki server xatoligi: ${message}` },
      { status: 500 }
    );
  }
}
