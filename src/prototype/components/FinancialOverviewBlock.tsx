'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, TrendingUp } from 'lucide-react';
import { formatUzbekCurrency } from '../tokens';

interface FinancialOverviewBlockProps {
  totalLifetimeIncome: number;
  periodIncome: number;
  periodExpenses: number;
  activeMonthLabel: string;
}

export function FinancialOverviewBlock({
  totalLifetimeIncome,
  periodIncome,
  periodExpenses,
  activeMonthLabel,
}: FinancialOverviewBlockProps) {
  const formattedTotal = totalLifetimeIncome.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return (
    <section aria-label="Moliyaviy ko‘rsatkichlar" className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* ── TYPE A: HERO CARD (Takes 7 cols on lg:, full width on mobile) ── */}
        <div className="finance-card lg:col-span-7 relative overflow-hidden rounded-[24px] bg-[#0b1e0f] p-6 sm:p-7 text-white shadow-[0_12px_36px_rgba(11,30,15,0.35)] border border-[#1a3820] flex flex-col justify-between">
          {/* Quarter-Naqsh Watermark in Top-Right Corner */}
          <div className="card-naqsh-bg" aria-hidden="true">
            <img
              src="/naqsh-quarter-mobile.png"
              alt=""
              width={180}
              height={180}
              className="naqsh-img"
            />
          </div>

          <div className="relative z-10 space-y-4">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9FE870]">
                  Jami qayd etilgan daromad
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-[#9FE870] border border-[#9FE870]/30 backdrop-blur-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9FE870] animate-pulse" />
                  Barcha vaqt
                </span>
              </div>

              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-white/90 border border-white/10">
                <TrendingUp className="w-3.5 h-3.5 text-[#9FE870]" />
                <span>Faol hisob</span>
              </div>
            </div>

            {/* ── HERO FINANCIAL NUMBER (38-44px Mobile, 48-56px Desktop) ── */}
            <div className="pt-1">
              <div className="flex items-baseline flex-wrap gap-x-2">
                <span className="font-mono text-[38px] sm:text-[44px] lg:text-[52px] font-extrabold tracking-tight text-white tabular-nums leading-none drop-shadow-xs">
                  {formattedTotal}
                </span>
                <span className="font-mono text-xl sm:text-2xl lg:text-[28px] font-bold text-[#9FE870] tracking-normal">
                  so‘m
                </span>
              </div>
              
              <p className="mt-2 text-xs sm:text-sm text-white/70 max-w-md font-medium">
                Ilovada hisob ochilgandan buyon kiritilgan umumiy daromad mablag‘i
              </p>
            </div>
          </div>
        </div>

        {/* ── TYPE B: METRIC CARDS (Takes 5 cols on lg:, 2-cols side-by-side on mobile) ── */}
        <div className="lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
          {/* Income Card: Subtle Emerald Wash */}
          <div className="rounded-[22px] bg-[#EDF8F1] p-4 sm:p-5 border border-[#C5E9D2] shadow-[0_2px_8px_rgba(38,131,74,0.06)] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E7440]">
                Davr daromadi
              </span>
              <div className="w-7 h-7 rounded-full bg-[#26834A] text-white flex items-center justify-center shadow-xs">
                <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
              </div>
            </div>

            <div>
              <div className="font-mono text-lg sm:text-xl lg:text-[24px] font-extrabold text-[#1E7440] tabular-nums tracking-tight">
                +{formatUzbekCurrency(periodIncome)}
              </div>
              <span className="text-[11px] font-medium text-[#26834A]/80 block mt-0.5">
                {activeMonthLabel}
              </span>
            </div>
          </div>

          {/* Expense Card: Subtle Coral/Red Wash */}
          <div className="rounded-[22px] bg-[#FDF2F2] p-4 sm:p-5 border border-[#F8C8C8] shadow-[0_2px_8px_rgba(214,77,77,0.06)] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C53B3B]">
                Davr xarajati
              </span>
              <div className="w-7 h-7 rounded-full bg-[#D64D4D] text-white flex items-center justify-center shadow-xs">
                <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
              </div>
            </div>

            <div>
              <div className="font-mono text-lg sm:text-xl lg:text-[24px] font-extrabold text-[#C53B3B] tabular-nums tracking-tight">
                -{formatUzbekCurrency(periodExpenses)}
              </div>
              <span className="text-[11px] font-medium text-[#D64D4D]/80 block mt-0.5">
                {activeMonthLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
