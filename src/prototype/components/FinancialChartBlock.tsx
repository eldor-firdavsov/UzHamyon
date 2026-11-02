'use client';

import React, { useState } from 'react';
import { BarChart3, Calendar, Info } from 'lucide-react';
import type { DemoTransaction } from '../demoData';
import { calculateChartData, type ChartPeriod, type ChartIntervalPoint } from '../dateUtils';
import { formatUzbekCurrency } from '../tokens';

interface FinancialChartBlockProps {
  transactions: DemoTransaction[];
  referenceDate?: string;
  financialStartDate?: string;
}

export function FinancialChartBlock({
  transactions,
  referenceDate = '2026-10-31',
  financialStartDate = '2026-05-01',
}: FinancialChartBlockProps) {
  const [activePeriod, setActivePeriod] = useState<ChartPeriod>('1m');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Calendar-accurate calculation dynamically computed from real transactions
  const chartData = calculateChartData(transactions, activePeriod, referenceDate, financialStartDate);
  const { points, periodLabel, totalIncome, totalExpense } = chartData;

  const maxVal = Math.max(
    ...points.map((p) => Math.max(p.income, p.expense)),
    100000
  );

  const selectedPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  const periodOptions: { key: ChartPeriod; label: string }[] = [
    { key: '1m', label: 'Joriy oy' },
    { key: '3m', label: '3 oy' },
    { key: '6m', label: '6 oy' },
    { key: 'year', label: 'Yil' },
  ];

  return (
    <section 
      aria-label="Moliyaviy grafik"
      className="rounded-[24px] bg-white p-5 sm:p-6 lg:p-7 border border-[#E8EBE5] shadow-[0_4px_20px_rgba(23,27,22,0.04)] space-y-5"
    >
      {/* ── Header: Title & Calendar Period Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0 border border-[#9FE870]/40 shadow-2xs">
            <BarChart3 className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-[18px] sm:text-[20px] lg:text-[22px] font-bold text-[#171B16] tracking-tight leading-snug">
              Pul oqimi grafigi
            </h2>
            <p className="text-[13px] sm:text-sm text-[#697168] mt-0.5">
              {periodLabel} — Daromad va xarajatlar taqqoslovi
            </p>
          </div>
        </div>

        {/* 4-Period Switcher (Joriy oy, 3 oy, 6 oy, Yil) */}
        <div className="inline-flex items-center gap-1 p-1 bg-[#F7F8F5] rounded-xl border border-[#E8EBE5] text-sm self-start sm:self-auto">
          {periodOptions.map(({ key, label }) => {
            const isActive = activePeriod === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActivePeriod(key);
                  setHoveredIdx(null);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#163300] text-[#9FE870] shadow-xs'
                    : 'text-[#697168] hover:text-[#171B16] hover:bg-white/80'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Strict Color Legend: GREEN = Daromad, RED = Xarajat ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#697168] border-b border-[#E8EBE5]/70 pb-3.5">
        <div className="flex items-center gap-6">
          {/* Income Legend: Green #26834A */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#26834A] shadow-2xs ring-2 ring-[#26834A]/20" />
            <span className="font-bold text-[#1E7440] text-sm">Daromad</span>
          </div>

          {/* Expense Legend: Red #D64D4D */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#D64D4D] shadow-2xs ring-2 ring-[#D64D4D]/20" />
            <span className="font-bold text-[#C53B3B] text-sm">Xarajat</span>
          </div>
        </div>

        {/* Period Total Summary */}
        <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold tabular-nums">
          <span className="text-[#26834A]">+{formatUzbekCurrency(totalIncome)}</span>
          <span className="text-[#959E94]">/</span>
          <span className="text-[#D64D4D]">-{formatUzbekCurrency(totalExpense)}</span>
        </div>
      </div>

      {/* ── Interactive Bar Chart Canvas ── */}
      {points.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-center p-6 text-[#697168]">
          <Calendar className="w-8 h-8 text-[#959E94] mb-2" />
          <p className="font-semibold text-sm text-[#171B16]">Tanlangan davrda tranzaksiyalar yo‘q</p>
          <p className="text-xs text-[#697168] mt-1">Ushbu sana oralig‘ida operatsiyalar qayd etilmagan.</p>
        </div>
      ) : (
        <div className="relative h-56 sm:h-64 pt-4 flex flex-col justify-end">
          {/* Subtle Horizontal Reference Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
            <div className="w-full border-b border-dashed border-[#E8EBE5]" />
            <div className="w-full border-b border-dashed border-[#E8EBE5]/80" />
            <div className="w-full border-b border-dashed border-[#E8EBE5]/50" />
          </div>

          {/* Bars Container */}
          <div className="flex items-end justify-between gap-2 sm:gap-4 lg:gap-6 h-full relative z-10 border-b-2 border-[#163300]/15 pb-2">
            {points.map((point, idx) => {
              const incHeight = point.income > 0 ? Math.max(12, Math.round((point.income / maxVal) * 100)) : 3;
              const expHeight = point.expense > 0 ? Math.max(12, Math.round((point.expense / maxVal) * 100)) : 3;
              const isSelected = hoveredIdx === idx;

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group"
                  onClick={() => setHoveredIdx(isSelected ? null : idx)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Pair of Green & Red Bars */}
                  <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-40 sm:h-48 relative">
                    {/* Daromad (Green #26834A) */}
                    <div
                      style={{ height: `${incHeight}%` }}
                      className={`w-3.5 sm:w-5 md:w-6 lg:w-7 rounded-t-sm transition-all duration-200 ${
                        point.income > 0 ? 'bg-[#26834A]' : 'bg-[#E8EBE5]/50'
                      } ${isSelected ? 'ring-2 ring-[#26834A] scale-105 brightness-110 shadow-sm' : 'group-hover:opacity-90'}`}
                      title={`Daromad: +${point.income.toLocaleString()} so‘m`}
                    />

                    {/* Xarajat (Red #D64D4D) */}
                    <div
                      style={{ height: `${expHeight}%` }}
                      className={`w-3.5 sm:w-5 md:w-6 lg:w-7 rounded-t-sm transition-all duration-200 ${
                        point.expense > 0 ? 'bg-[#D64D4D]' : 'bg-[#E8EBE5]/50'
                      } ${isSelected ? 'ring-2 ring-[#D64D4D] scale-105 brightness-110 shadow-sm' : 'group-hover:opacity-90'}`}
                      title={`Xarajat: -${point.expense.toLocaleString()} so‘m`}
                    />
                  </div>

                  {/* X-Axis Calendar Label */}
                  <span
                    className={`mt-2.5 text-[11px] sm:text-xs tracking-tight transition-colors whitespace-nowrap ${
                      isSelected ? 'font-bold text-[#163300]' : 'font-medium text-[#697168]'
                    }`}
                  >
                    {point.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Contextual Detail Tooltip Bar ── */}
      <div className="bg-[#F7F8F5] rounded-xl px-4 py-3 border border-[#E8EBE5] transition-all">
        {selectedPoint ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#163300]" />
              <span className="font-bold text-[#171B16]">{selectedPoint.subLabel || selectedPoint.label}:</span>
            </div>

            <div className="flex items-center gap-4 font-mono font-bold tabular-nums">
              <span className="text-[#26834A]">
                Daromad: +{formatUzbekCurrency(selectedPoint.income)}
              </span>
              <span className="text-[#D64D4D]">
                Xarajat: -{formatUzbekCurrency(selectedPoint.expense)}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-xs ${
                selectedPoint.income >= selectedPoint.expense ? 'bg-[#EDF8F1] text-[#1E7440]' : 'bg-[#FDF2F2] text-[#C53B3B]'
              }`}>
                Farq: {selectedPoint.income >= selectedPoint.expense ? '+' : ''}{formatUzbekCurrency(selectedPoint.income - selectedPoint.expense)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs sm:text-[13px] text-[#697168]">
            <span className="font-medium flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#26834A]" />
              Aniq sanalar va summalarni ko‘rish uchun ustun ustiga bosing
            </span>
            <span className="font-semibold text-[#163300] hidden sm:inline">
              Yashil = Daromad | Qizil = Xarajat
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
