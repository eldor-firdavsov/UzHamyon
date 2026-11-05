import React from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';

const BOT_USERNAME =
  (import.meta.env as unknown as Record<string, string | undefined>)
    .VITE_TELEGRAM_BOT_USERNAME || 'uz_hamyonbot';

/**
 * Legacy Vite entry point. Authentication is Telegram-only, so this page
 * intentionally exposes no email/password form.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-4 py-12 text-[#18181B]">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <UzHamyonLogo variant="icon" size="lg" />
          </div>
          <div className="text-xl font-bold tracking-tight text-[#18181B] mb-1">
            UzHamyon
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#18181B]">
            Telegram orqali kirish
          </h1>
          <p className="mt-1.5 text-sm text-[#52525B] leading-relaxed">
            Hisobingiz Telegram identifikatingizga bog‘langan. Alohida elektron
            pochta yoki parol talab qilinmaydi.
          </p>
        </div>

        <div className="rounded-xl border border-[#D8DED3] bg-[#F7F8F5] p-4 text-sm text-[#52525B]">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#059669] mt-0.5" />
            <span>
              Ilova Telegram ichida ochilganda hisobingiz avtomatik va xavfsiz
              tarzda tasdiqlanadi.
            </span>
          </div>
        </div>

        <a
          href={`https://t.me/${BOT_USERNAME}`}
          className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#18181B] hover:bg-[#27272A] px-5 py-3 text-sm font-medium text-white transition-all shadow-xs active:scale-98"
        >
          <Send className="h-4 w-4" />
          <span>Telegram’da ochish</span>
        </a>
      </div>
    </div>
  );
}
