import React from 'react';
import { Send, ExternalLink } from 'lucide-react';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';

const BOT_USERNAME =
  (import.meta.env as unknown as Record<string, string | undefined>)
    .VITE_TELEGRAM_BOT_USERNAME || 'uz_hamyonbot';

const TELEGRAM_DEEP_LINK = `https://t.me/${BOT_USERNAME}?start=start`;
const TELEGRAM_WEB_FALLBACK = `https://web.telegram.org/a/#?tgaddr=resolve%3Fdomain%3D${encodeURIComponent(BOT_USERNAME)}%26start%3Dstart`;

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8F5] px-4 py-12 text-[#171B16]">
      <div className="w-full max-w-sm space-y-6 rounded-[24px] border border-[#E8EBE5] bg-white p-7 sm:p-8 shadow-card text-center">
        <div>
          <div className="flex justify-center mb-4">
            <UzHamyonLogo variant="icon" size="xl" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#163300] mb-2">
            UzHamyon
          </h1>
          <p className="text-sm text-[#697168] leading-relaxed">
            Ilovadan foydalanish uchun Telegram botimiz orqali kiring.
          </p>
        </div>

        <a
          id="open-telegram-button"
          data-testid="start-telegram-btn"
          href={TELEGRAM_DEEP_LINK}
          className="flex w-full min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#9FE870] hover:bg-[#8ED660] px-5 py-3.5 text-sm font-bold text-[#163300] transition-all shadow-xs active:scale-[0.98]"
        >
          <Send className="h-4 w-4" />
          <span>Telegram’da ochish</span>
        </a>

        <div className="pt-1">
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
