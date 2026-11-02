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
  return (
    <section 
      aria-label="Moliyaviy ko‘rsatkichlar"
      className="rounded-[20px] bg-white p-5 sm:p-6 border border-[#E8EBE5]/80 shadow-[0_1px_4px_rgba(23,27,22,0.03)]"
    >
      {/* ── Top: Main Financial Figure ── */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#697168]">
              Jami qayd etilgan daromad
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F0F9E9] px-2 py-0.5 text-[10px] font-semibold text-[#163300] border border-[#9FE870]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#26834A]" aria-hidden="true" />
              Barcha vaqt
            </span>
          </div>

          <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-[#171B16] tabular-nums leading-none">
            {formatUzbekCurrency(totalLifetimeIncome)}
          </div>
          
          <p className="mt-1 text-xs text-[#697168]">
            Ilovada hisob ochilgandan buyon kiritilgan umumiy tushum
          </p>
        </div>

        {/* Wise Green Subtle Accent Badge on Desktop */}
        <div className="hidden sm:flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg bg-[#F7F8F5] text-xs font-medium text-[#163300] border border-[#E8EBE5]">
          <TrendingUp className="w-3.5 h-3.5 text-[#26834A]" />
          <span>Ijobiy dinamika</span>
        </div>
      </div>

      {/* ── Divider: Clean whitespace and subtle divider (NO nested cards) ── */}
      <div className="mt-5 pt-4 border-t border-[#E8EBE5]/60">
        <div className="grid grid-cols-2 gap-4 sm:gap-8">
          {/* Unified Period Income Column */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#697168]">
              <span className="w-5 h-5 rounded-full bg-[#EDF7F0] text-[#26834A] flex items-center justify-center shrink-0">
                <ArrowDownLeft className="h-3 w-3 stroke-[2.5]" />
              </span>
              <span>Davr daromadi</span>
            </div>
            <div className="font-mono text-lg sm:text-xl font-bold text-[#26834A] tabular-nums">
              +{formatUzbekCurrency(periodIncome)}
            </div>
            <span className="text-[11px] text-[#959E94] block">
              {activeMonthLabel}
            </span>
          </div>

          {/* Unified Period Expense Column */}
          <div className="space-y-1 border-l border-[#E8EBE5]/60 pl-4 sm:pl-8">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#697168]">
              <span className="w-5 h-5 rounded-full bg-[#FDF1F1] text-[#D64D4D] flex items-center justify-center shrink-0">
                <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
              </span>
              <span>Davr xarajati</span>
            </div>
            <div className="font-mono text-lg sm:text-xl font-bold text-[#D64D4D] tabular-nums">
              -{formatUzbekCurrency(periodExpenses)}
            </div>
            <span className="text-[11px] text-[#959E94] block">
              {activeMonthLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
