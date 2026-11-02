'use client';

import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
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
      className="rounded-[24px] bg-white p-5 sm:p-6 border border-[#E8EBE5] shadow-[0_4px_20px_rgba(23,27,22,0.04)] space-y-4"
    >
      {/* ── Header with Compact View Switcher ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0 border border-[#9FE870]/40 shadow-2xs">
            <Scale className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#171B16] tracking-tight">
              Kirim va chiqimlar oqimi
            </h2>
            <p className="text-xs text-[#697168] mt-0.5">
              {viewMode === 'month' ? activeMonthLabel : 'Barcha davrlar bo‘yicha sof qoldiq'}
            </p>
          </div>
        </div>

        {/* Compact Switcher */}
        <div className="inline-flex items-center gap-1 p-1 bg-[#F7F8F5] rounded-full border border-[#E8EBE5] text-xs">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
              viewMode === 'month'
                ? 'bg-[#163300] text-[#9FE870] shadow-xs'
                : 'text-[#697168] hover:text-[#171B16]'
            }`}
          >
            Shu oy
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-3.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
              viewMode === 'all'
                ? 'bg-[#163300] text-[#9FE870] shadow-xs'
                : 'text-[#697168] hover:text-[#171B16]'
            }`}
          >
            Jami
          </button>
        </div>
      </div>

      {/* ── Metric Rows with Strong Numerical Presence ── */}
      <div className="divide-y divide-[#E8EBE5]/70 pt-1">
        {/* Income Row */}
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#EDF8F1] text-[#26834A] flex items-center justify-center shrink-0 border border-[#C5E9D2]">
              <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
            </span>
            <div>
              <span className="text-xs font-bold text-[#171B16] block">
                {viewMode === 'month' ? 'Oylik daromad' : 'Umumiy daromad'}
              </span>
              <span className="text-[11px] text-[#697168]">Barcha tushumlar</span>
            </div>
          </div>
          <span className="font-mono text-base sm:text-lg font-bold text-[#26834A] tabular-nums">
            +{formatUzbekCurrency(income)}
          </span>
        </div>

        {/* Expense Row */}
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#FDF2F2] text-[#D64D4D] flex items-center justify-center shrink-0 border border-[#F8C8C8]">
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
            </span>
            <div>
              <span className="text-xs font-bold text-[#171B16] block">
                {viewMode === 'month' ? 'Oylik xarajat' : 'Umumiy xarajat'}
              </span>
              <span className="text-[11px] text-[#697168]">Barcha xarajatlar</span>
            </div>
          </div>
          <span className="font-mono text-base sm:text-lg font-bold text-[#D64D4D] tabular-nums">
            -{formatUzbekCurrency(expenses)}
          </span>
        </div>

        {/* Net Flow Row (Distinctive Highlight Box) */}
        <div className="pt-3">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F0F9E9] border border-[#9FE870]/50">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#163300] block">
                Sof farq (qoldiq)
              </span>
              <span className="text-[11px] font-medium text-[#163300]/80 mt-0.5 block">
                {isPositive ? 'Erkin qolgan tejov mablag‘i' : 'Zarar qoldig‘i'}
              </span>
            </div>
            <span className="font-mono text-lg sm:text-xl font-extrabold text-[#163300] tabular-nums">
              {isPositive ? '+' : ''}{formatUzbekCurrency(netFlow)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
