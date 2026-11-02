'use client';

import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Equal } from 'lucide-react';
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
      aria-label="Kirim va chiqimlar taqqoslovi"
      className="rounded-[20px] bg-white p-5 sm:p-6 border border-[#E8EBE5]/80 shadow-[0_1px_4px_rgba(23,27,22,0.03)] space-y-4"
    >
      {/* ── Header with Compact View Switcher ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
            Kirim va chiqimlar oqimi
          </h2>
          <p className="text-[11px] text-[#697168] mt-0.5">
            {viewMode === 'month' ? activeMonthLabel : 'Barcha davrlar bo‘yicha'}
          </p>
        </div>

        {/* Compact Switcher */}
        <div className="inline-flex items-center gap-1 p-0.5 bg-[#F7F8F5] rounded-full border border-[#E8EBE5] text-[11px]">
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

      {/* ── Clean List Rows with Subtle Dividers (NO nested cards) ── */}
      <div className="divide-y divide-[#E8EBE5]/60 pt-1">
        {/* Income Row */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-[#EDF7F0] text-[#26834A] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="h-3.5 w-3.5 stroke-[2.5]" />
            </span>
            <span className="text-xs font-medium text-[#171B16]">
              {viewMode === 'month' ? 'Oylik daromad' : 'Umumiy daromad'}
            </span>
          </div>
          <span className="font-mono text-sm sm:text-base font-bold text-[#26834A] tabular-nums">
            +{formatUzbekCurrency(income)}
          </span>
        </div>

        {/* Expense Row */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-[#FDF1F1] text-[#D64D4D] flex items-center justify-center shrink-0">
              <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
            </span>
            <span className="text-xs font-medium text-[#171B16]">
              {viewMode === 'month' ? 'Oylik xarajat' : 'Umumiy xarajat'}
            </span>
          </div>
          <span className="font-mono text-sm sm:text-base font-bold text-[#D64D4D] tabular-nums">
            -{formatUzbekCurrency(expenses)}
          </span>
        </div>

        {/* Net Flow Row */}
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-3">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              isPositive ? 'bg-[#F0F9E9] text-[#163300]' : 'bg-[#FDF1F1] text-[#D64D4D]'
            }`}>
              <Equal className="h-3.5 w-3.5 stroke-[2.5]" />
            </span>
            <div>
              <span className="text-xs font-semibold text-[#171B16] block">
                Sof farq (qoldiq)
              </span>
              <span className="text-[10px] text-[#959E94]">
                {isPositive ? 'Tejab qolingan summa' : 'Zarar qoldig‘i'}
              </span>
            </div>
          </div>
          <span className={`font-mono text-base sm:text-lg font-bold tabular-nums ${
            isPositive ? 'text-[#163300]' : 'text-[#D64D4D]'
          }`}>
            {isPositive ? '+' : ''}{formatUzbekCurrency(netFlow)}
          </span>
        </div>
      </div>
    </section>
  );
}
