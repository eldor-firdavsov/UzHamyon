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
  const netFlow = periodIncome - periodExpenses;

  return (
    <section aria-label="Moliyaviy ko‘rsatkichlar" className="space-y-3">
      {/* ── Main Hero Card: Wise-Style Lime Header ── */}
      <div className="relative overflow-hidden rounded-[22px] bg-[#9FE870] p-5 text-[#163300] shadow-[0_4px_16px_rgba(159,232,112,0.25)] border border-[#8ED760]">
        {/* Subtle decorative background ring */}
        <div 
          className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full border-[18px] border-[#163300]/5 pointer-events-none" 
          aria-hidden="true" 
        />

        <div className="relative z-10 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#163300]/80">
              Jami qayd etilgan daromad
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#163300]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#163300]">
              <TrendingUp className="h-3 w-3" />
              <span>Barcha vaqt</span>
            </span>
          </div>

          <div>
            <div className="font-mono text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#163300] tabular-nums leading-none">
              {formatUzbekCurrency(totalLifetimeIncome)}
            </div>
            <p className="mt-1.5 text-xs text-[#163300]/75 font-medium">
              Ilovada hisob ochilgandan buyon tushgan jami mablag‘
            </p>
          </div>
        </div>
      </div>

      {/* ── Period Cash Flow Cards (Side-by-side in 2 columns) ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Selected Period Income */}
        <div className="rounded-[18px] bg-white p-4 border border-[#E8EBE5] shadow-[0_1px_3px_rgba(23,27,22,0.04)] flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-[#EDF7F0] text-[#26834A] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
            </div>
            <span className="text-xs font-medium text-[#697168]">
              Davr daromadi
            </span>
          </div>
          <div>
            <div className="font-mono text-lg font-bold text-[#26834A] tabular-nums tracking-tight">
              +{formatUzbekCurrency(periodIncome)}
            </div>
            <span className="text-[10px] text-[#959E94] font-medium block mt-0.5">
              {activeMonthLabel}
            </span>
          </div>
        </div>

        {/* Selected Period Expenses */}
        <div className="rounded-[18px] bg-white p-4 border border-[#E8EBE5] shadow-[0_1px_3px_rgba(23,27,22,0.04)] flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-[#FDF1F1] text-[#D64D4D] flex items-center justify-center shrink-0">
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
            </div>
            <span className="text-xs font-medium text-[#697168]">
              Davr xarajati
            </span>
          </div>
          <div>
            <div className="font-mono text-lg font-bold text-[#D64D4D] tabular-nums tracking-tight">
              -{formatUzbekCurrency(periodExpenses)}
            </div>
            <span className="text-[10px] text-[#959E94] font-medium block mt-0.5">
              {activeMonthLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
