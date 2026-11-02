'use client';

import React from 'react';
import { Home, Receipt, BarChart2, Brain, Plus } from 'lucide-react';

export type PrototypeTab = 'dashboard' | 'faoliyat' | 'tahlil' | 'ai';

interface FloatingMobileNavProps {
  activeTab: PrototypeTab;
  onTabChange: (tab: PrototypeTab) => void;
  onOpenAddModal: () => void;
}

export function FloatingMobileNav({
  activeTab,
  onTabChange,
  onOpenAddModal,
}: FloatingMobileNavProps) {
  const tabs = [
    { id: 'dashboard' as const, label: 'Bosh sahifa', icon: Home },
    { id: 'faoliyat' as const, label: 'Faoliyat', icon: Receipt },
    { id: 'tahlil' as const, label: 'Tahlil', icon: BarChart2 },
    { id: 'ai' as const, label: 'AI', icon: Brain },
  ];

  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-2 px-3"
      style={{
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
      aria-label="Mobil navigatsiya"
    >
      <div className="flex items-center justify-center gap-2.5 max-w-[360px] w-full mx-auto">
        {/* ── 4 Circular Icon Buttons Container (Wise Off-White/Card Pill) ── */}
        <nav
          className="pointer-events-auto flex items-center justify-between h-[58px] sm:h-[62px] px-2 py-1.5 rounded-full bg-white/95 backdrop-blur-xl border border-[#E8EBE5] shadow-[0_10px_30px_rgba(23,27,22,0.1),0_2px_8px_rgba(23,27,22,0.04)] flex-1 max-w-[264px]"
          aria-label="Asosiy bo‘limlar"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center justify-center rounded-full transition-all duration-200 h-[44px] w-[44px] shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163300] active:scale-90 ${
                  isActive
                    ? 'bg-[#163300] text-[#9FE870] shadow-xs'
                    : 'text-[#697168] hover:text-[#171B16] hover:bg-[#F7F8F5]'
                }`}
              >
                <Icon className="h-5 w-5 stroke-[2]" aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        {/* ── Separate Circular Plus (+) Button (Wise Signature Lime FAB) ── */}
        <button
          type="button"
          onClick={onOpenAddModal}
          aria-label="Yangi tranzaksiya qo‘shish"
          className="pointer-events-auto h-[54px] w-[54px] sm:h-[58px] sm:w-[58px] rounded-full bg-[#9FE870] hover:bg-[#8ED760] text-[#163300] shadow-[0_8px_25px_rgba(159,232,112,0.45)] border border-[#8ED760] flex items-center justify-center shrink-0 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163300]"
        >
          <Plus className="h-6 w-6 stroke-[3]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
