'use client';

import React from 'react';
import { 
  Home, 
  Receipt, 
  BarChart2, 
  Brain, 
  Plus, 
  Bell, 
  Sparkles,
  Wallet
} from 'lucide-react';
import type { PrototypeTab } from './FloatingMobileNav';

interface DesktopHeaderProps {
  activeTab: PrototypeTab;
  onTabChange: (tab: PrototypeTab) => void;
  onOpenAddModal: () => void;
  onNotificationClick?: () => void;
  userName?: string;
}

export function DesktopHeader({
  activeTab,
  onTabChange,
  onOpenAddModal,
  onNotificationClick,
  userName = 'Aziz Qodirov',
}: DesktopHeaderProps) {
  const navItems = [
    { id: 'dashboard' as const, label: 'Bosh sahifa', icon: Home },
    { id: 'faoliyat' as const, label: 'Faoliyat', icon: Receipt },
    { id: 'tahlil' as const, label: 'Tahlil', icon: BarChart2 },
    { id: 'ai' as const, label: 'AI', icon: Brain },
  ];

  return (
    <header className="hidden lg:block sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8EBE5]/80 transition-colors">
      <div className="max-w-7xl mx-auto px-6 xl:px-8 h-16 flex items-center justify-between gap-6">
        {/* ── Left: Logo & Demo Badge ── */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onTabChange('dashboard')}>
            <div className="w-9 h-9 rounded-xl bg-[#163300] text-[#9FE870] flex items-center justify-center font-black shadow-xs">
              <Wallet className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-lg font-bold text-[#171B16] tracking-tight">
              UzHamyon
            </span>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0F9E9] text-[#163300] border border-[#9FE870]/40">
            <Sparkles className="w-3 h-3 text-[#26834A]" />
            Demo rejim
          </span>
        </div>

        {/* ── Center: 4-Section Primary Navigation ── */}
        <nav className="flex items-center gap-1.5" aria-label="Asosiy navigatsiya">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#163300] text-white shadow-xs'
                    : 'text-[#697168] hover:text-[#171B16] hover:bg-[#F7F8F5]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#9FE870]' : 'text-current'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Right: Add Transaction Button + Notification + User Profile ── */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Primary '+ Yangi amal' CTA */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#9FE870] hover:bg-[#8ED760] text-[#163300] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Yangi amal</span>
          </button>

          {/* Notification Button */}
          <button
            type="button"
            onClick={onNotificationClick}
            aria-label="Xabarnomalar"
            className="relative w-9 h-9 rounded-xl bg-[#F7F8F5] hover:bg-[#E8EBE5]/60 border border-[#E8EBE5] flex items-center justify-center text-[#171B16] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4 stroke-[2]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D64D4D] ring-2 ring-white" />
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-[#E8EBE5]">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-[#163300] text-[#9FE870] font-semibold text-xs flex items-center justify-center shadow-xs ring-2 ring-white">
                AQ
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#26834A] ring-2 ring-white" />
            </div>
            <div className="hidden xl:block text-left">
              <span className="text-xs font-semibold text-[#171B16] block leading-tight">
                {userName}
              </span>
              <span className="text-[10px] text-[#697168]">
                Shaxsiy hisob
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
