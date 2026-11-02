'use client';

import React from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowRight, 
  ShoppingBag, 
  Coffee, 
  Car, 
  Wifi, 
  Wallet,
  Receipt
} from 'lucide-react';
import type { DemoTransaction } from '../demoData';
import { formatUzbekCurrency } from '../tokens';
import { formatUzbekCalendarDate } from '../dateUtils';

interface RecentTransactionsBlockProps {
  transactions: DemoTransaction[];
  onViewAll: () => void;
  onSelectTransaction?: (tx: DemoTransaction) => void;
}

export function RecentTransactionsBlock({
  transactions,
  onViewAll,
  onSelectTransaction,
}: RecentTransactionsBlockProps) {
  const getCategoryIcon = (iconName: string, isIncome: boolean) => {
    switch (iconName) {
      case 'cart':
        return <ShoppingBag className="h-4 w-4" />;
      case 'coffee':
        return <Coffee className="h-4 w-4" />;
      case 'car':
        return <Car className="h-4 w-4" />;
      case 'wifi':
        return <Wifi className="h-4 w-4" />;
      case 'wallet':
      default:
        return isIncome ? <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" /> : <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />;
    }
  };

  return (
    <section 
      aria-label="So‘nggi amallar"
      className="rounded-[24px] bg-white border border-[#E8EBE5] shadow-[0_4px_20px_rgba(23,27,22,0.04)] overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="px-5 sm:px-6 py-4 border-b border-[#E8EBE5]/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0 border border-[#9FE870]/40 shadow-2xs">
            <Receipt className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-[18px] sm:text-[20px] lg:text-[22px] font-bold text-[#171B16] tracking-tight leading-snug">
              So‘nggi amallar
            </h2>
            <p className="text-[13px] sm:text-sm text-[#697168]">
              Oxirgi moliyaviy operatsiyalar
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-[#163300] hover:text-[#26834A] transition-colors cursor-pointer group"
        >
          <span>Barchasi</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ── Transaction Rows with Strict Semantic Colors: Green (+) / Red (-) ── */}
      {transactions.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#697168] space-y-1.5">
          <p className="font-semibold text-base text-[#171B16]">Tranzaksiyalar mavjud emas</p>
          <p>Yangi tranzaksiya qo‘shish uchun &quot;+&quot; tugmasini bosing.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E8EBE5]/60">
          {transactions.map((tx) => {
            const isIncome = tx.type === 'income';

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction?.(tx)}
                className="px-5 sm:px-6 py-4 flex items-center justify-between hover:bg-[#F7F8F5] transition-colors cursor-pointer group min-h-[56px]"
              >
                {/* Left: Category Icon + Title + Meta */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                  {/* Category icon with semantic background: Green for income, Red for expense */}
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs ${
                      isIncome
                        ? 'bg-[#EDF8F1] text-[#26834A] border border-[#C5E9D2]'
                        : 'bg-[#FDF2F2] text-[#D64D4D] border border-[#F8C8C8]'
                    }`}
                  >
                    {getCategoryIcon(tx.categoryIcon, isIncome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] sm:text-base font-semibold text-[#171B16] truncate group-hover:text-[#163300] transition-colors">
                      {tx.name}
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-[#697168] mt-0.5">
                      <span>{tx.category}</span>
                      <span className="text-[#959E94]">•</span>
                      <span>{formatUzbekCalendarDate(tx.date)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Strict Semantic Amount (Green for Income +, Red for Expense -) */}
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono text-base sm:text-lg font-bold tabular-nums block ${
                      isIncome ? 'text-[#26834A]' : 'text-[#D64D4D]'
                    }`}
                  >
                    {isIncome ? '+' : '-'}{formatUzbekCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
