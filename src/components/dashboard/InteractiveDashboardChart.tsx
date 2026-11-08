'use client';

import React, { useState } from 'react';
import { BarChart3, Calendar, Info } from 'lucide-react';

export interface ChartTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  transaction_date: string;
}

interface InteractiveDashboardChartProps {
  transactions: ChartTransaction[];
  referenceDate?: string; // YYYY-MM-DD
  userFinancialStartDate?: string;
  className?: string;
}

type ChartPeriod = '1m' | '3m' | '6m' | 'year';

interface ChartPoint {
  label: string;
  subLabel?: string;
  income: number;
  expense: number;
}

const UZBEK_MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

const UZBEK_MONTH_SHORT = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'
];

function formatUzbekCurrency(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  return `${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} soʻm`;
}

function parseDate(dateStr: string) {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10) || 2026;
  const m = parseInt(parts[1], 10) || 1;
  const d = parseInt(parts[2], 10) || 1;
  return { year: y, month: m, day: d };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function InteractiveDashboardChart({
  transactions,
  referenceDate,
  className = '',
}: InteractiveDashboardChartProps) {
  const [activePeriod, setActivePeriod] = useState<ChartPeriod>('6m');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Determine reference point: latest transaction date or current date
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const refDateStr = referenceDate || (transactions.length > 0 ? transactions[0].transaction_date : todayStr);
  const ref = parseDate(refDateStr);

  // Compute points based on period
  let points: ChartPoint[] = [];
  let periodLabel = '';

  if (activePeriod === '1m') {
    // Current month weeks
    const totalDays = daysInMonth(ref.year, ref.month);
    const intervals = [
      { start: 1, end: 7 },
      { start: 8, end: 14 },
      { start: 15, end: 21 },
      { start: 22, end: 28 },
      { start: 29, end: totalDays },
    ];
    const mShort = UZBEK_MONTH_SHORT[ref.month - 1] || 'oy';
    const mName = UZBEK_MONTH_NAMES[ref.month - 1] || 'Joriy oy';

    points = intervals.map((inv) => {
      let income = 0;
      let expense = 0;
      for (const t of transactions) {
        const pd = parseDate(t.transaction_date);
        if (pd.year === ref.year && pd.month === ref.month && pd.day >= inv.start && pd.day <= inv.end) {
          if (t.type === 'income') income += Number(t.amount) || 0;
          else expense += Number(t.amount) || 0;
        }
      }
      return {
        label: `${inv.start}-${inv.end} ${mShort}`,
        subLabel: `${inv.start} - ${inv.end} ${mName} ${ref.year}`,
        income,
        expense,
      };
    });
    periodLabel = `${mName} ${ref.year} (Haftalik taqsimot)`;
  } else {
    // Multi-month: 3m, 6m, or year (up to 12m)
    const count = activePeriod === '3m' ? 3 : activePeriod === '6m' ? 6 : 12;
    const months: { year: number; month: number }[] = [];

    for (let i = count - 1; i >= 0; i--) {
      let m = ref.month - i;
      let y = ref.year;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      months.push({ year: y, month: m });
    }

    points = months.map(({ year, month }) => {
      let income = 0;
      let expense = 0;
      for (const t of transactions) {
        const pd = parseDate(t.transaction_date);
        if (pd.year === year && pd.month === month) {
          if (t.type === 'income') income += Number(t.amount) || 0;
          else expense += Number(t.amount) || 0;
        }
      }
      const label = UZBEK_MONTH_NAMES[month - 1] || `${month}-oy`;
      return {
        label,
        subLabel: `${label} ${year}`,
        income,
        expense,
      };
    });

    periodLabel =
      activePeriod === '3m'
        ? 'So‘nggi 3 oylik hisobot'
        : activePeriod === '6m'
        ? 'So‘nggi 6 oylik hisobot'
        : `${ref.year}-yil dinamikasi`;
  }

  const totalPeriodIncome = points.reduce((sum, p) => sum + p.income, 0);
  const totalPeriodExpense = points.reduce((sum, p) => sum + p.expense, 0);
  const maxVal = Math.max(1, ...points.map((p) => Math.max(p.income, p.expense)));
  const selectedPoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  const periodOptions: { key: ChartPeriod; label: string }[] = [
    { key: '1m', label: 'Joriy oy' },
    { key: '3m', label: '3 oy' },
    { key: '6m', label: '6 oy' },
    { key: 'year', label: 'Yil' },
  ];

  return (
    <div className={`rounded-[24px] bg-white p-5 sm:p-6 lg:p-7 border border-[#E8EBE5] shadow-[0_4px_20px_rgba(23,27,22,0.04)] space-y-5 ${className}`}>
      {/* Header: Title & Period Switcher */}
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

        {/* 4-Period Switcher */}
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
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
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

      {/* Legend & Period Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#697168] border-b border-[#E8EBE5]/80 pb-3.5">
        <div className="flex items-center gap-6">
          {/* Income: Green #26834A */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#26834A] shadow-2xs ring-2 ring-[#26834A]/20" />
            <span className="font-bold text-[#1E7440] text-sm">Kirim</span>
          </div>

          {/* Expense: Red #D64D4D */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#D64D4D] shadow-2xs ring-2 ring-[#D64D4D]/20" />
            <span className="font-bold text-[#C53B3B] text-sm">Chiqim</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold tabular-nums">
          <span className="text-[#26834A]">+{formatUzbekCurrency(totalPeriodIncome)}</span>
          <span className="text-[#959E94]">/</span>
          <span className="text-[#D64D4D]">-{formatUzbekCurrency(totalPeriodExpense)}</span>
        </div>
      </div>

      {/* Bar Chart Canvas */}
      {points.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-center p-6 text-[#697168]">
          <Calendar className="w-8 h-8 text-[#959E94] mb-2" />
          <p className="font-semibold text-sm text-[#171B16]">Tanlangan davrda tranzaksiyalar yo‘q</p>
          <p className="text-xs text-[#697168] mt-1">Ushbu sana oralig‘ida operatsiyalar qayd etilmagan.</p>
        </div>
      ) : (
        <div className="relative h-56 sm:h-64 pt-4 flex flex-col justify-end">
          {/* Subtle Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
            <div className="w-full border-b border-dashed border-[#E8EBE5]" />
            <div className="w-full border-b border-dashed border-[#E8EBE5]/80" />
            <div className="w-full border-b border-dashed border-[#E8EBE5]/50" />
          </div>

          {/* Bars */}
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
                  {/* Bars Container */}
                  <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-40 sm:h-48 relative">
                    {/* Income Bar (Green) */}
                    <div
                      style={{ height: `${incHeight}%` }}
                      className={`w-3.5 sm:w-5 md:w-6 lg:w-7 rounded-t-sm transition-all duration-200 ${
                        point.income > 0 ? 'bg-[#26834A]' : 'bg-[#E8EBE5]/50'
                      } ${isSelected ? 'ring-2 ring-[#26834A] scale-105 brightness-110 shadow-sm' : 'group-hover:opacity-90'}`}
                      title={`Kirim: +${point.income.toLocaleString()} soʻm`}
                    />

                    {/* Expense Bar (Red) */}
                    <div
                      style={{ height: `${expHeight}%` }}
                      className={`w-3.5 sm:w-5 md:w-6 lg:w-7 rounded-t-sm transition-all duration-200 ${
                        point.expense > 0 ? 'bg-[#D64D4D]' : 'bg-[#E8EBE5]/50'
                      } ${isSelected ? 'ring-2 ring-[#D64D4D] scale-105 brightness-110 shadow-sm' : 'group-hover:opacity-90'}`}
                      title={`Chiqim: -${point.expense.toLocaleString()} soʻm`}
                    />
                  </div>

                  {/* X-Axis Label */}
                  <span
                    className={`mt-2.5 text-[11px] sm:text-xs tracking-tight transition-colors whitespace-nowrap truncate max-w-full ${
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

      {/* Detail Tooltip Bar */}
      <div className="bg-[#F7F8F5] rounded-xl px-4 py-3 border border-[#E8EBE5] transition-all">
        {selectedPoint ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#163300]" />
              <span className="font-bold text-[#171B16]">{selectedPoint.subLabel || selectedPoint.label}:</span>
            </div>

            <div className="flex items-center gap-4 font-mono font-bold tabular-nums">
              <span className="text-[#26834A]">
                Kirim: +{formatUzbekCurrency(selectedPoint.income)}
              </span>
              <span className="text-[#D64D4D]">
                Chiqim: -{formatUzbekCurrency(selectedPoint.expense)}
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
            <span className="font-bold text-[#163300] hidden sm:inline">
              Yashil = Kirim | Qizil = Chiqim
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
