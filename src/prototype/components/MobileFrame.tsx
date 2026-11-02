'use client';

import React, { useState } from 'react';
import { Smartphone, Monitor, ShieldCheck } from 'lucide-react';

export type ViewportPreset = '320' | '375' | '390' | '430' | 'full';

interface MobileFrameProps {
  children: React.ReactNode;
}

export function MobileFrame({ children }: MobileFrameProps) {
  const [preset, setPreset] = useState<ViewportPreset>('390');

  const widthClasses: Record<ViewportPreset, string> = {
    '320': 'w-[320px]',
    '375': 'w-[375px]',
    '390': 'w-[390px]',
    '430': 'w-[430px]',
    'full': 'w-full max-w-md',
  };

  return (
    <div className="min-h-screen bg-[#EBECE8] text-[#171B16] flex flex-col items-center">
      {/* ── Desktop Viewport Control Toolbar (Visible only on desktop screens) ── */}
      <div className="w-full bg-[#163300] text-white py-2 px-4 shadow-sm hidden md:flex items-center justify-between border-b border-[#234A05] text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-[#9FE870] flex items-center gap-1.5 text-sm">
            UzHamyon
          </span>
          <span className="text-[#9FE870]/60">|</span>
          <span className="text-white/80 font-medium">Mobil Dizayn Prototipi</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#9FE870]/20 text-[#9FE870] border border-[#9FE870]/30 ml-2">
            <ShieldCheck className="w-3 h-3" />
            Izolyatsiya qilingan (Faqat demo)
          </span>
        </div>

        {/* Viewport switchers */}
        <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-lg border border-white/10">
          <span className="text-[11px] text-white/60 px-2 flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            O‘lcham:
          </span>
          {(['320', '375', '390', '430', 'full'] as ViewportPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                preset === p
                  ? 'bg-[#9FE870] text-[#163300] font-bold shadow-xs'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {p === 'full' ? 'Auto' : `${p}px`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Phone Preview Canvas ── */}
      <main className="w-full flex-1 flex justify-center items-start md:py-8 md:px-4">
        <div
          className={`relative bg-[#F7F8F5] min-h-screen md:min-h-[844px] md:max-h-[900px] flex flex-col md:rounded-[44px] md:shadow-[0_25px_60px_-15px_rgba(23,27,22,0.25),0_0_0_12px_#171B16,0_0_0_14px_#343B33] md:overflow-hidden transition-all duration-300 ${widthClasses[preset]}`}
        >
          {/* iOS Dynamic Island Notch bar simulation on desktop */}
          <div className="hidden md:flex justify-center pt-2.5 pb-1 bg-[#F7F8F5] select-none">
            <div className="w-24 h-5 bg-[#171B16] rounded-full" />
          </div>

          {/* Prototype Content Container */}
          <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
