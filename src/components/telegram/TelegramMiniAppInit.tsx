'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          auth_date?: number;
          hash?: string;
        };
        version?: string;
        platform?: string;
        colorScheme?: 'light' | 'dark';
        themeParams?: Record<string, string>;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        backgroundColor?: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        enableClosingConfirmation?: () => void;
        BackButton?: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
      };
    };
  }
}

export default function TelegramMiniAppInit() {
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // iOS WKWebView (Telegram) still honours Safari gestures in some versions
    // even with user-scalable=no. Blocking these does not affect panning,
    // scrolling, text selection or the on-screen keyboard.
    const inTelegram = Boolean(window.Telegram?.WebApp);
    if (inTelegram) {
      const preventGesture = (event: Event) => event.preventDefault();
      document.addEventListener('gesturestart', preventGesture);
      document.addEventListener('gesturechange', preventGesture);
      document.addEventListener('gestureend', preventGesture);
      return () => {
        document.removeEventListener('gesturestart', preventGesture);
        document.removeEventListener('gesturechange', preventGesture);
        document.removeEventListener('gestureend', preventGesture);
      };
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.initData) {
      // Opened in standard web browser outside Telegram, do nothing
      return;
    }

    const initData = tg.initData;

    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#F7F8F5');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#F7F8F5');
    } catch {}

    const supabase = createClient();
    const pathname = window.location.pathname;

    async function syncTelegramAuth() {
      setIsAuthenticating(true);
      setAuthError(null);

      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });

        const data = await res.json();

        if (!data.success || !data.session) {
          setAuthError(data.error || 'Telegram orqali kirishda xatolik yuz berdi');
          setIsAuthenticating(false);
          return;
        }

        // Set session in client Supabase (which writes @supabase/ssr cookies)
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        // Broadcast auth sync so mounted components refresh immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('uzhamyon:auth-synced', {
              detail: { access_token: data.session.access_token, user: data.user },
            })
          );
        }

        // Determine destination based on onboarding status
        if (!data.onboarding_completed) {
          if (!pathname.startsWith('/onboarding')) {
            window.location.replace('/onboarding?tg=1');
            return;
          }
        } else {
          if (pathname === '/login' || pathname === '/register' || pathname === '/' || pathname.startsWith('/onboarding')) {
            window.location.replace('/dashboard');
            return;
          }
        }
        setIsAuthenticating(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Server bilan aloqa uzildi';
        setAuthError(msg);
        setIsAuthenticating(false);
      }
    }

    // Check if valid session already exists in client storage
    supabase.auth.getSession().then(async (res: Awaited<ReturnType<typeof supabase.auth.getSession>>) => {
      const session = res?.data?.session;

      if (session && session.user) {
        // Broadcast auth sync so mounted components refresh immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('uzhamyon:auth-synced', {
              detail: { access_token: session.access_token, user: session.user },
            })
          );
        }
        // Session already valid: fast-path directly to dashboard or onboarding without blocking auth spinner
        if (pathname === '/login' || pathname === '/register' || pathname === '/') {
          window.location.replace('/dashboard');
          return;
        }
        return;
      }

      // No active session in storage: authenticate via Telegram backend initData
      await syncTelegramAuth();
    });
  }, []);

  if (isAuthenticating) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F7F8F5] px-6 text-center animate-in fade-in duration-200">
        <div className="w-20 h-20 rounded-3xl bg-white border border-[#E8EBE5] flex items-center justify-center p-3 shadow-card mb-5 animate-pulse">
          <UzHamyonLogo variant="icon" size="xl" />
        </div>
        <h2 className="text-xl font-bold text-[#171B16] tracking-tight">UzHamyon</h2>
        <p className="text-xs text-[#697168] mt-1 font-medium">Telegram hisobingiz tasdiqlanmoqda...</p>
        <div className="mt-6 flex items-center gap-1.5 text-xs text-[#163300] font-semibold bg-[#F0F9E9] border border-[#9FE870]/40 px-3.5 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-[#163300] animate-ping" />
          <span>Xavfsiz ulanish</span>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F7F8F5] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 font-bold text-2xl">
          !
        </div>
        <h3 className="text-base font-bold text-[#171B16]">Telegram orqali ulanishda xatolik</h3>
        <p className="text-xs text-[#697168] mt-1.5 max-w-xs">{authError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 px-5 py-2.5 rounded-xl bg-[#163300] text-[#9FE870] font-bold text-xs shadow-xs cursor-pointer active:scale-98"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  return null;
}
