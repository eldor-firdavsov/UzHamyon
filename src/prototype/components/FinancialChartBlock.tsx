'use client';

import React, { useState } from 'react';
import { BarChart2, Calendar } from 'lucide-react';
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

  return (
    <section 
      aria-label="Moliyaviy grafik"
      className="rounded-[20px] bg-white p-4 sm:p-5 border border-[#E8EBE5] shadow-[0_2px_8px_rgba(23,27,22,0.04)] space-y-4"
    >
      {/* ── Header: Title & Period Switcher ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0">
            <BarChart2 className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
            Pul oqimi grafigi
          </h2>
        </div>

        {/* Wise-Style Compact Period Pill Switcher */}
        <div className="inline-flex items-center gap-1 p-1 bg-[#F7F8F5] rounded-full border border-[#E8EBE5] text-[11px]">
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
                className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                  isActive
                    ? 'bg-[#163300] text-white shadow-xs font-semibold'
                    : 'text-[#697168] hover:text-[#171B16]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center justify-between text-[11px] text-[#697168] px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#26834A]" />
            <span>Kirim</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#163300]" />
            <span>Chiqim</span>
          </div>
        </div>
        <span className="text-[10px] text-[#959E94]">
          {currentData.label}
        </span>
      </div>

      {/* ── Interactive Bar Chart Canvas ── */}
      <div className="h-44 pt-2 flex items-end justify-between gap-2 border-b border-[#E8EBE5] pb-2">
        {currentData.points.map((point, idx) => {
          const incHeight = point.income > 0 ? Math.max(10, Math.round((point.income / maxVal) * 100)) : 4;
          const expHeight = point.expense > 0 ? Math.max(10, Math.round((point.expense / maxVal) * 100)) : 4;
          const isSelected = hoveredIdx === idx;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group"
              onClick={() => setHoveredIdx(isSelected ? null : idx)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="w-full flex items-end justify-center gap-1.5 h-32 relative">
                {/* Income bar */}
                <div
                  style={{ height: `${incHeight}%` }}
                  className={`w-3 sm:w-4 rounded-t-[4px] transition-all duration-300 ${
                    point.income > 0 ? 'bg-[#26834A]' : 'bg-[#E8EBE5]'
                  } ${isSelected ? 'ring-2 ring-[#26834A]/30 scale-105' : 'group-hover:opacity-90'}`}
                />
                {/* Expense bar */}
                <div
                  style={{ height: `${expHeight}%` }}
                  className={`w-3 sm:w-4 rounded-t-[4px] transition-all duration-300 ${
                    point.expense > 0 ? 'bg-[#163300]' : 'bg-[#E8EBE5]'
                  } ${isSelected ? 'ring-2 ring-[#163300]/30 scale-105' : 'group-hover:opacity-90'}`}
                />
              </div>

              {/* X-Axis Label */}
              <span className={`text-[10px] mt-2 truncate max-w-full font-medium transition-colors ${
                isSelected ? 'text-[#163300] font-bold' : 'text-[#697168]'
              }`}>
                {point.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Active Point Details Card (Interactive Tooltip Drawer) ── */}
      <div className="rounded-xl bg-[#F7F8F5] p-3 text-xs flex items-center justify-between border border-[#E8EBE5]">
        {hoveredIdx !== null ? (
          <>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-[#163300]" />
              <span className="font-semibold text-[#171B16]">
                {currentData.points[hoveredIdx].label}:
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-[#26834A] font-semibold">
                +{formatUzbekCurrency(currentData.points[hoveredIdx].income)}
              </span>
              <span className="text-[#D64D4D] font-semibold">
                -{formatUzbekCurrency(currentData.points[hoveredIdx].expense)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between w-full text-[#697168]">
            <span>Ustun ustiga bosing yoki suring</span>
            <span className="font-mono tabular-nums text-[#171B16] font-semibold">
              Maks: {formatUzbekCurrency(maxVal)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
