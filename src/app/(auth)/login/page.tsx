import type { Metadata } from 'next';
import Link from 'next/link';
import { Send, ShieldCheck, RefreshCw } from 'lucide-react';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';

export const metadata: Metadata = {
  title: 'Kirish — UzHamyon',
  description: 'UzHamyon’ga Telegram orqali xavfsiz kiring',
};

const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() || 'uz_hamyonbot';

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
            <span className="sr-only">Sign in with Telegram</span>
          </h1>
          <p className="mt-1.5 text-sm text-[#52525B] leading-relaxed">
            UzHamyon hisobingiz Telegram identifikatingizga bog‘langan. Alohida
            elektron pochta yoki parol talab qilinmaydi.
          </p>
        </div>

        <div className="rounded-xl border border-[#D8DED3] bg-[#F7F8F5] p-4 text-sm text-[#52525B] space-y-2">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#059669] mt-0.5" />
            <span>
              Ilova Telegram ichida ochilganda hisobingiz avtomatik va xavfsiz
              tarzda tasdiqlanadi.
            </span>
          </div>
        </div>

        <a
          id="open-telegram-button"
          href={`https://t.me/${BOT_USERNAME}`}
          className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#18181B] hover:bg-[#27272A] px-5 py-3 text-sm font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-2 shadow-xs active:scale-98"
        >
          <Send className="h-4 w-4" />
          <span>Telegram’da ochish</span>
        </a>

        <p className="text-center text-xs leading-relaxed text-[#71717A]">
          Telegram’da botni ochib, <strong>“Ilovani ochish”</strong> tugmasini
          bosing. Agar ilova allaqachon Telegram ichida ochilgan bo‘lsa, sahifani
          yangilang.
        </p>

        <Link
          id="login-retry-link"
          href="/login"
          className="flex items-center justify-center gap-2 text-sm font-medium text-[#059669] hover:text-[#047857] hover:underline transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Qayta urinish</span>
        </Link>
      </div>
    </div>
  );
}
