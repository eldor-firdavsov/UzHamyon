'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Check } from 'lucide-react';
import { 
  getAvailableMonths, 
  getTransactionAvailableMonths,
  canNavigatePrevious, 
  canNavigateNext, 
  getPreviousMonth, 
  getNextMonth,
  UZBEK_MONTH_NAMES
} from '../dateUtils';

interface MonthSelectorProps {
  selectedYear: number;
  selectedMonth: number;
  onSelectMonth: (year: number, month: number) => void;
  financialStartDate?: string;
  maxDate?: string;
  transactions?: Array<{ date: string; amount?: number; type?: string }>;
}

export function MonthSelector({
  selectedYear,
  selectedMonth,
  onSelectMonth,
  financialStartDate = '2026-05-01',
  maxDate = '2026-10-31',
  transactions,
}: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const availableMonths = transactions
    ? getTransactionAvailableMonths(transactions)
    : getAvailableMonths(financialStartDate, maxDate);

  const currentIdx = availableMonths.findIndex(
    (m) => m.year === selectedYear && m.month === selectedMonth
  );

  const hasPrev = transactions
    ? currentIdx >= 0 && currentIdx < availableMonths.length - 1
    : canNavigatePrevious(selectedYear, selectedMonth, financialStartDate);

  const hasNext = transactions
    ? currentIdx > 0
    : canNavigateNext(selectedYear, selectedMonth, maxDate);

  const currentLabel = `${UZBEK_MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  const handlePrev = () => {
    if (transactions) {
      if (currentIdx >= 0 && currentIdx < availableMonths.length - 1) {
        const prev = availableMonths[currentIdx + 1];
        onSelectMonth(prev.year, prev.month);
      }
      return;
    }
    const prev = getPreviousMonth(selectedYear, selectedMonth, financialStartDate);
    if (prev) {
      onSelectMonth(prev.year, prev.month);
    }
  };

  const handleNext = () => {
    if (transactions) {
      if (currentIdx > 0) {
        const next = availableMonths[currentIdx - 1];
        onSelectMonth(next.year, next.month);
      }
      return;
    }
    const next = getNextMonth(selectedYear, selectedMonth, maxDate);
    if (next) {
      onSelectMonth(next.year, next.month);
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* ── Main Month Navigator Pill ── */}
      <div className="flex items-center bg-white border border-[#E8EBE5] rounded-xl shadow-xs overflow-hidden">
        {/* Previous Month Arrow */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={!hasPrev}
          aria-label="Oldingi oy"
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer ${
            hasPrev
              ? 'text-[#171B16] hover:bg-[#F7F8F5] active:bg-[#E8EBE5]/60'
              : 'text-[#959E94]/40 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Month Label (Tapping opens picker) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Oyni tanlash"
          className="min-h-[44px] px-3.5 flex items-center gap-2 text-sm sm:text-base font-bold text-[#171B16] hover:bg-[#F7F8F5] transition-colors border-x border-[#E8EBE5]/70 cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-[#26834A] shrink-0" />
          <span>{currentLabel}</span>
        </button>

        {/* Next Month Arrow */}
        <button
          type="button"
          onClick={handleNext}
          disabled={!hasNext}
          aria-label="Keyingi oy"
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer ${
            hasNext
              ? 'text-[#171B16] hover:bg-[#F7F8F5] active:bg-[#E8EBE5]/60'
              : 'text-[#959E94]/40 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>

      {/* ── Dropdown Month Picker ── */}
      {isOpen && (
        <div 
          className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 z-50 w-64 bg-white rounded-2xl p-2.5 border border-[#E8EBE5] shadow-[0_12px_32px_rgba(23,27,22,0.12)] space-y-1 animate-in fade-in zoom-in-95 duration-150"
          role="menu"
        >
          <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#697168] border-b border-[#E8EBE5]/60 mb-1">
            Mavjud oylar ro‘yxati
          </div>

          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {availableMonths.map((m) => {
              const isSelected = m.year === selectedYear && m.month === selectedMonth;

              return (
                <button
                  key={m.isoMonth}
                  type="button"
                  onClick={() => {
                    onSelectMonth(m.year, m.month);
                    setIsOpen(false);
                  }}
                  className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#163300] text-[#9FE870]'
                      : 'text-[#171B16] hover:bg-[#F7F8F5]'
                  }`}
                >
                  <span>{m.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-[#9FE870] stroke-[2.5]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
