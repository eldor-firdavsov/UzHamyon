import React from 'react';
import { Send, ShieldCheck, ExternalLink } from 'lucide-react';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';

const BOT_USERNAME =
  (import.meta.env as unknown as Record<string, string | undefined>)
    .VITE_TELEGRAM_BOT_USERNAME || 'uz_hamyonbot';

const TELEGRAM_DEEP_LINK = `https://t.me/${BOT_USERNAME}?start=start`;
const TELEGRAM_WEB_FALLBACK = `https://web.telegram.org/a/#?tgaddr=resolve%3Fdomain%3D${encodeURIComponent(BOT_USERNAME)}%26start%3Dstart`;

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8F5] px-4 py-12 text-[#171B16]">
      <div className="w-full max-w-md space-y-6 rounded-[24px] border border-[#E8EBE5] bg-white p-7 sm:p-9 shadow-card">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <UzHamyonLogo variant="icon" size="xl" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#163300] mb-1">
            UzHamyon
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#171B16]">
            Telegram Mini App orqali ishlaydi
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#697168] leading-relaxed">
            UzHamyon shaxsiy moliya tizimi faqat Telegram Mini App muhitida xavfsiz ishlaydi. Alohida elektron pochta yoki parol talab etilmaydi.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E8EBE5] bg-[#F7F8F5] p-4 text-xs sm:text-sm text-[#171B16] space-y-3">
          <div className="font-semibold text-[#163300] flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#16A34A] shrink-0" />
            <span>Qanday boshlash mumkin?</span>
          </div>
          <ol className="space-y-2 text-xs text-[#5C6659] pl-1">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#163300] text-[#9FE870] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span><strong>“Telegram’da boshlash”</strong> tugmasini bosing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#163300] text-[#9FE870] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>Telegram bot ochilgach, <strong>/start</strong> buyrug‘ini yuboring</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#163300] text-[#9FE870] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>Botdagi <strong>“Ilovani ochish”</strong> tugmasi orqali hisobingizga kiring</span>
            </li>
          </ol>
        </div>

        <a
          id="open-telegram-button"
          data-testid="start-telegram-btn"
          href={TELEGRAM_DEEP_LINK}
          className="flex w-full min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#9FE870] hover:bg-[#8ED660] px-5 py-3.5 text-sm font-bold text-[#163300] transition-all shadow-xs active:scale-[0.98]"
        >
          <Send className="h-4 w-4" />
          <span>Telegram’da boshlash</span>
        </a>

        <div className="pt-1 text-center">
          <a
            id="telegram-web-fallback-link"
            href={TELEGRAM_WEB_FALLBACK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534] hover:text-[#14532D] hover:underline transition-colors"
          >
            <span>Telegram Web orqali ochish</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
