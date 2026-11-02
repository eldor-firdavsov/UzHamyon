'use client';

import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Equal, Calendar } from 'lucide-react';
import { formatUzbekCurrency } from '../tokens';

interface MonthlyCashFlowBlockProps {
  monthlyIncome: number;
  monthlyExpenses: number;
  allTimeIncome: number;
  allTimeExpenses: number;
  activeMonthLabel: string;
}

export function MonthlyCashFlowBlock({
  monthlyIncome,
  monthlyExpenses,
  allTimeIncome,
  allTimeExpenses,
  activeMonthLabel,
}: MonthlyCashFlowBlockProps) {
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month');

  const income = viewMode === 'month' ? monthlyIncome : allTimeIncome;
  const expenses = viewMode === 'month' ? monthlyExpenses : allTimeExpenses;
  const netFlow = income - expenses;
  const isPositive = netFlow >= 0;

  return (
    <section 
      aria-label="Kirim va chiqimlar tahlili"
      className="rounded-[20px] bg-white p-4 sm:p-5 border border-[#E8EBE5] shadow-[0_2px_8px_rgba(23,27,22,0.04)] space-y-4"
    >
      {/* ── Header with Month / All-time toggle ── */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
            Kirim va chiqimlar
          </h2>
          <p className="text-[11px] text-[#697168] mt-0.5">
            {viewMode === 'month' ? activeMonthLabel : 'Barcha qaydlar bo‘yicha'}
          </p>
        </div>

        {/* Segmented View Switcher */}
        <div className="inline-flex items-center gap-1 p-1 bg-[#F7F8F5] rounded-full border border-[#E8EBE5] text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3 py-1 rounded-full font-medium transition-all ${
              viewMode === 'month'
                ? 'bg-[#163300] text-white font-semibold shadow-xs'
                : 'text-[#697168] hover:text-[#171B16]'
            }`}
          >
            Shu oy
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-3 py-1 rounded-full font-medium transition-all ${
              viewMode === 'all'
                ? 'bg-[#163300] text-white font-semibold shadow-xs'
                : 'text-[#697168] hover:text-[#171B16]'
            }`}
          >
            Jami
          </button>
        </div>
      </div>

      {/* ── 3 Summary Metric Rows ── */}
      <div className="space-y-2">
        {/* Income Row */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F8F5] border border-[#E8EBE5]/60">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-[#EDF7F0] text-[#26834A] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
            </div>
            <span className="text-xs font-medium text-[#171B16]">
              {viewMode === 'month' ? 'Oylik daromad' : 'Umumiy daromad'}
            </span>
          </div>
          <span className="font-mono text-sm sm:text-base font-bold text-[#26834A] tabular-nums">
            +{formatUzbekCurrency(income)}
          </span>
        </div>

        {/* Expense Row */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F8F5] border border-[#E8EBE5]/60">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-[#FDF1F1] text-[#D64D4D] flex items-center justify-center shrink-0">
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
            </div>
            <span className="text-xs font-medium text-[#171B16]">
              {viewMode === 'month' ? 'Oylik xarajat' : 'Umumiy xarajat'}
            </span>
          </div>
          <span className="font-mono text-sm sm:text-base font-bold text-[#D64D4D] tabular-nums">
            -{formatUzbekCurrency(expenses)}
          </span>
        </div>

        {/* Net Flow / Difference Row */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#F0F9E9] border border-[#9FE870]/40">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-[#9FE870] text-[#163300] flex items-center justify-center shrink-0">
              <Equal className="h-4 w-4 stroke-[2.5]" />
            </div>
            <span className="text-xs font-semibold text-[#163300]">
              Sof farq (qoldiq)
            </span>
          </div>
          <span className={`font-mono text-sm sm:text-base font-extrabold tabular-nums ${
            isPositive ? 'text-[#163300]' : 'text-[#D64D4D]'
          }`}>
            {isPositive ? '+' : ''}{formatUzbekCurrency(netFlow)}
          </span>
        </div>
      </div>
    </section>
  );
}
