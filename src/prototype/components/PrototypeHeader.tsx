'use client';

import React from 'react';
import { Bell, Sparkles } from 'lucide-react';

interface PrototypeHeaderProps {
  userName?: string;
  onNotificationClick?: () => void;
}

export function PrototypeHeader({
  userName = 'Aziz',
  onNotificationClick,
}: PrototypeHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#F7F8F5]/90 backdrop-blur-md px-4 pt-3 pb-3 border-b border-[#E8EBE5]/60 transition-colors">
      <div className="flex items-center justify-between">
        {/* User avatar & greeting */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#163300] text-[#9FE870] font-semibold text-sm flex items-center justify-center shadow-xs ring-2 ring-white">
              AQ
            </div>
            {/* Online / Active status dot */}
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#26834A] ring-2 ring-white"
              title="Faol"
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-[#697168]">Xush kelibsiz</span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#9FE870]/20 text-[#163300] border border-[#9FE870]/40">
                <Sparkles className="w-2.5 h-2.5" />
                Demo
              </span>
            </div>
            <h1 className="text-base font-bold text-[#171B16] leading-tight">
              {userName} 👋
            </h1>
          </div>
        </div>

        {/* Right action: Notifications / Demo Badge */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNotificationClick}
            aria-label="Xabarnomalar"
            className="relative w-10 h-10 rounded-full bg-white border border-[#E8EBE5] flex items-center justify-center text-[#171B16] hover:bg-[#F0F9E9] hover:border-[#9FE870] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163300] active:scale-95 shadow-xs"
          >
            <Bell className="w-4 h-4 stroke-[2]" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#D64D4D] ring-2 ring-white" />
          </button>
        </div>
      </div>
    </header>
  );
}
