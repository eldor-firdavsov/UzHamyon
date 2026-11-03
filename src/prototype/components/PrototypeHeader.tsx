'use client';

import React from 'react';

interface PrototypeHeaderProps {
  userName?: string;
}

export function PrototypeHeader({
  userName = 'Aziz',
}: PrototypeHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#F7F8F5]/95 backdrop-blur-md px-4 pt-3.5 pb-3 border-b border-[#E8EBE5]/70 transition-colors">
      <div className="flex items-center justify-between">
        {/* User avatar & clean greeting */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#163300] text-[#9FE870] font-bold text-sm flex items-center justify-center shadow-xs ring-2 ring-white">
              AQ
            </div>
            {/* Online status indicator */}
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#26834A] ring-2 ring-white"
              title="Faol"
              aria-hidden="true"
            />
          </div>
          <div>
            <span className="text-xs font-medium text-[#697168] block">Xush kelibsiz</span>
            <h1 className="text-lg font-bold text-[#171B16] leading-tight">
              {userName}
            </h1>
          </div>
        </div>

        {/* Right side: Clean brand wordmark without unnecessary dead buttons */}
        <div className="flex items-center">
          <span className="text-base font-extrabold text-[#171B16] tracking-tight">
            UzHamyon
          </span>
        </div>
      </div>
    </header>
  );
}
