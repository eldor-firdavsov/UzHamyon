'use client';

import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { DEMO_CHART_PERIODS } from '../demoData';
import { formatUzbekCurrency } from '../tokens';

export function FinancialChartBlock() {
  const [activePeriod, setActivePeriod] = useState<'1m' | '3m' | 'all'>('1m');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const currentData = DEMO_CHART_PERIODS[activePeriod];
  const maxVal = Math.max(
    ...currentData.points.map((p) => Math.max(p.income, p.expense)),
    100000
  );

  const selectedPoint = hoveredIdx !== null ? currentData.points[hoveredIdx] : null;

  return (
    <section 
      aria-label="Moliyaviy grafik"
      className="rounded-[24px] bg-white p-5 sm:p-6 border border-[#E8EBE5] shadow-[0_4px_20px_rgba(23,27,22,0.04)] space-y-5"
    >
      {/* ── Header: Title & Compact Period Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0 border border-[#9FE870]/40 shadow-2xs">
            <BarChart3 className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#171B16] tracking-tight">
              Pul oqimi grafigi
            </h2>
            <p className="text-xs text-[#697168] mt-0.5">
              Daromad va xarajatlarning vaqt bo‘yicha nisbati
            </p>
          </div>
        </div>

        {/* Compact Period Switcher */}
        <div className="inline-flex items-center gap-1 p-1 bg-[#F7F8F5] rounded-full border border-[#E8EBE5] text-xs self-start sm:self-auto">
          {(['1m', '3m', 'all'] as const).map((key) => {
            const label = key === '1m' ? 'Joriy oy' : key === '3m' ? '3 oy' : 'Jami';
            const isActive = activePeriod === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActivePeriod(key);
                  setHoveredIdx(null);
                }}
                className={`px-3.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#163300] text-[#9FE870] shadow-xs'
                    : 'text-[#697168] hover:text-[#171B16]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Legend & Summary ── */}
      <div className="flex items-center justify-between text-xs text-[#697168] border-b border-[#E8EBE5]/60 pb-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#26834A] shadow-2xs" />
            <span className="font-semibold text-[#171B16]">Kirim</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#163300] shadow-2xs" />
            <span className="font-semibold text-[#171B16]">Chiqim</span>
          </div>
        </div>
        <span className="text-xs font-semibold text-[#163300] bg-[#F0F9E9] px-2.5 py-0.5 rounded-full border border-[#9FE870]/30 tabular-nums">
          Maks: {formatUzbekCurrency(maxVal)}
        </span>
      </div>

      {/* ── Spacious Bar Chart Canvas with Subtle Reference Lines ── */}
      <div className="relative h-52 sm:h-60 pt-4 flex flex-col justify-end">
        {/* Subtle Horizontal Reference Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7">
          <div className="w-full border-b border-dashed border-[#E8EBE5]/80" />
          <div className="w-full border-b border-dashed border-[#E8EBE5]/60" />
          <div className="w-full border-b border-dashed border-[#E8EBE5]/40" />
        </div>

        {/* Bars Container */}
        <div className="flex items-end justify-between gap-2 sm:gap-6 h-full relative z-10 border-b-2 border-[#163300]/10 pb-2">
          {currentData.points.map((point, idx) => {
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
                {/* Visual Bars Pair */}
                <div className="w-full flex items-end justify-center gap-1.5 sm:gap-2.5 h-40 sm:h-48 relative">
                  {/* Kirim Bar */}
                  <div
                    style={{ height: `${incHeight}%` }}
                    className={`w-3.5 sm:w-6 rounded-t-md transition-all duration-300 ${
                      point.income > 0 ? 'bg-[#26834A]' : 'bg-[#E8EBE5]/60'
                    } ${isSelected ? 'ring-2 ring-[#26834A] scale-105' : 'group-hover:opacity-90'}`}
                  />
                  {/* Chiqim Bar */}
                  <div
                    style={{ height: `${expHeight}%` }}
                    className={`w-3.5 sm:w-6 rounded-t-md transition-all duration-300 ${
                      point.expense > 0 ? 'bg-[#163300]' : 'bg-[#E8EBE5]/60'
                    } ${isSelected ? 'ring-2 ring-[#163300] scale-105' : 'group-hover:opacity-90'}`}
                  />
                </div>

                {/* X-Axis Label */}
                <span
                  className={`mt-2.5 text-xs tracking-tight transition-colors whitespace-nowrap ${
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

      {/* ── Contextual Detail Bar ── */}
      <div className="bg-[#F7F8F5] rounded-xl px-4 py-3 flex items-center justify-between text-xs border border-[#E8EBE5]/60">
        {selectedPoint ? (
          <div className="flex items-center justify-between w-full">
            <span className="font-bold text-[#171B16]">{selectedPoint.label}:</span>
            <div className="flex items-center gap-4 tabular-nums">
              <span className="text-[#26834A] font-bold">
                +{formatUzbekCurrency(selectedPoint.income)}
              </span>
              <span className="text-[#163300] font-bold">
                -{formatUzbekCurrency(selectedPoint.expense)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-xs text-[#697168]">
            <span className="font-medium">Aniq raqamlar uchun ustun ustiga bosing</span>
            <span className="font-semibold text-[#163300]">Tanlangan davr tahlili</span>
          </div>
        )}
      </div>
    </section>
  );
}
