'use client';

import React, { useState } from 'react';
import { BarChart2 } from 'lucide-react';
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
      className="rounded-[20px] bg-white p-5 sm:p-6 border border-[#E8EBE5]/80 shadow-[0_1px_4px_rgba(23,27,22,0.03)] space-y-5"
    >
      {/* ── Header: Title & Compact Period Switcher ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0">
            <BarChart2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
              Pul oqimi grafigi
            </h2>
            <p className="text-[11px] text-[#697168] hidden sm:block">
              Daromad va xarajatlarning davriy nisbati
            </p>
          </div>
        </div>

        {/* Compact Period Switcher */}
        <div className="inline-flex items-center gap-1 p-0.5 bg-[#F7F8F5] rounded-full border border-[#E8EBE5] text-[11px]">
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
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  isActive
                    ? 'bg-[#163300] text-white font-semibold shadow-xs'
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
      <div className="flex items-center justify-between text-xs text-[#697168] pt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#26834A]" />
            <span className="font-medium">Kirim</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#163300]" />
            <span className="font-medium">Chiqim</span>
          </div>
        </div>
        <span className="text-[11px] text-[#959E94]">
          Maksimal: {formatUzbekCurrency(maxVal)}
        </span>
      </div>

      {/* ── Spacious Bar Chart Canvas with Subtle Grid Lines ── */}
      <div className="relative h-48 sm:h-56 pt-3 flex flex-col justify-end">
        {/* Subtle Horizontal Reference Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7">
          <div className="w-full border-b border-dashed border-[#E8EBE5]/60" />
          <div className="w-full border-b border-dashed border-[#E8EBE5]/40" />
          <div className="w-full border-b border-dashed border-[#E8EBE5]/30" />
        </div>

        {/* Bars Container */}
        <div className="flex items-end justify-between gap-2 sm:gap-4 h-full relative z-10 border-b border-[#E8EBE5] pb-2">
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
                <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-36 sm:h-44 relative">
                  {/* Kirim Bar */}
                  <div
                    style={{ height: `${incHeight}%` }}
                    className={`w-3 sm:w-5 md:w-6 rounded-t-sm transition-all duration-200 ${
                      point.income > 0 ? 'bg-[#26834A]' : 'bg-[#E8EBE5]/60'
                    } ${isSelected ? 'ring-2 ring-[#26834A]/40 brightness-110' : 'group-hover:opacity-90'}`}
                  />
                  {/* Chiqim Bar */}
                  <div
                    style={{ height: `${expHeight}%` }}
                    className={`w-3 sm:w-5 md:w-6 rounded-t-sm transition-all duration-200 ${
                      point.expense > 0 ? 'bg-[#163300]' : 'bg-[#E8EBE5]/60'
                    } ${isSelected ? 'ring-2 ring-[#163300]/40 brightness-110' : 'group-hover:opacity-90'}`}
                  />
                </div>

                {/* X-Axis Label */}
                <span
                  className={`mt-2 text-[10px] sm:text-xs tracking-tight transition-colors whitespace-nowrap ${
                    isSelected ? 'font-bold text-[#171B16]' : 'text-[#697168]'
                  }`}
                >
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Contextual Detail Bar (Clean & Borderless) ── */}
      <div className="bg-[#F7F8F5] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-[#697168]">
        {selectedPoint ? (
          <div className="flex items-center justify-between w-full">
            <span className="font-semibold text-[#171B16]">{selectedPoint.label}:</span>
            <div className="flex items-center gap-4 tabular-nums">
              <span className="text-[#26834A] font-semibold">
                +{formatUzbekCurrency(selectedPoint.income)}
              </span>
              <span className="text-[#163300] font-semibold">
                -{formatUzbekCurrency(selectedPoint.expense)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-[11px] text-[#959E94]">
            <span>Aniq summalarni ko‘rish uchun ustun ustiga bosing</span>
            <span className="hidden sm:inline">Kirim va chiqim taqqoslovi</span>
          </div>
        )}
      </div>
    </section>
  );
}
