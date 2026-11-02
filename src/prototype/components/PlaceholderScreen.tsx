'use client';

import React from 'react';
import { Receipt, BarChart2, Brain, ArrowLeft, Sparkles } from 'lucide-react';
import type { PrototypeTab } from './FloatingMobileNav';

interface PlaceholderScreenProps {
  tab: Exclude<PrototypeTab, 'dashboard'>;
  onBackToDashboard: () => void;
}

export function PlaceholderScreen({ tab, onBackToDashboard }: PlaceholderScreenProps) {
  const meta = {
    faoliyat: {
      title: 'Faoliyat',
      subtitle: 'Tranzaksiyalar tarixi va qidiruv bo‘limi',
      icon: Receipt,
      description:
        'Ushbu bo‘lim Dashboard dizayn yo‘nalishi tasdiqlangach to‘liq Wise uslubida ishlab chiqiladi. Hozircha barcha tranzaksiyalarni Bosh sahifada ko‘rishingiz va yangisini qo‘shishingiz mumkin.',
    },
    tahlil: {
      title: 'Tahlil',
      subtitle: 'Chuqur moliyaviy statistika va jamg‘armalar',
      icon: BarChart2,
      description:
        'Moliyaviy tahlil va jamg‘arma maqsadlarining to‘liq ko‘rinishi keyingi bosqichda taqdim etiladi. Asosiy maqsadlar va pul oqimi grafigi Dashboard bo‘limida interaktiv mavjud.',
    },
    ai: {
      title: 'AI',
      subtitle: 'Aqlli moliyaviy muloqot va tavsiyalar',
      icon: Brain,
      description:
        'AI bilan to‘g‘ridan-to‘g‘ri muloqot interfeysi Dashboard tasdiqlangach yangi Wise dizayn tizimiga integratsiya qilinadi. Bosh sahifada faol AI tavsiyasi bilan tanishishingiz mumkin.',
    },
  }[tab];

  const Icon = meta.icon;

  return (
    <div className="space-y-4 py-2">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8EBE5]">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#163300] hover:underline cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Bosh sahifaga qaytish</span>
        </button>

        <span className="text-[10px] font-semibold text-[#163300] bg-[#F0F9E9] px-2.5 py-0.5 rounded-full border border-[#9FE870]/30">
          Prototip 1-bosqich
        </span>
      </div>

      {/* ── Placeholder Card ── */}
      <div className="rounded-[22px] bg-white p-6 sm:p-8 border border-[#E8EBE5] text-center space-y-4 shadow-[0_2px_8px_rgba(23,27,22,0.04)]">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center border border-[#9FE870]/40 shadow-xs">
          <Icon className="h-7 w-7" />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-[#171B16] tracking-tight">
            {meta.title}
          </h2>
          <p className="text-xs font-medium text-[#697168]">
            {meta.subtitle}
          </p>
        </div>

        <p className="text-xs sm:text-sm text-[#697168] max-w-sm mx-auto leading-relaxed">
          {meta.description}
        </p>

        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#163300] text-[#9FE870] font-semibold text-xs shadow-xs hover:bg-[#204702] transition-colors cursor-pointer"
        >
          <span>Dashboardga qaytish</span>
        </button>
      </div>
    </div>
  );
}
