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
import CategoryIcon from '@/components/categories/CategoryIcon';

interface RecentTransactionsBlockProps {
  transactions: DemoTransaction[];
  onViewAll: () => void;
  onSelectTransaction?: (tx: DemoTransaction) => void;
  selectedMonthLabel?: string;
}

export function RecentTransactionsBlock({
  transactions,
  onViewAll,
  onSelectTransaction,
  selectedMonthLabel,
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
        return isIncome ? <ArrowDownLeft className="h-4 w-4 stroke-[2.2]" /> : <ArrowUpRight className="h-4 w-4 stroke-[2.2]" />;
    }
  };

  return (
    <section 
      aria-label="So‘nggi amallar"
      className="rounded-[24px] bg-white border border-[#E8EBE5] shadow-[0_4px_20px_rgba(23,27,22,0.04)] overflow-hidden"
    >
      {/* ── Compact Header ── */}
      <div className="px-5 sm:px-6 py-3.5 border-b border-[#E8EBE5]/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0 border border-[#9FE870]/40 shadow-2xs">
            <Receipt className="h-4 w-4 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#171B16] tracking-tight leading-snug">
              Tranzaksiyalar
            </h2>
            <p className="text-xs text-[#697168]">
              {selectedMonthLabel ? `${selectedMonthLabel} amallari` : 'Oxirgi operatsiyalar'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold text-[#163300] hover:text-[#26834A] transition-colors cursor-pointer group"
        >
          <span>Barchasi</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ── Significantly More Compact Transaction Rows (52–58px Desktop, 60–64px Mobile) ── */}
      {transactions.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#697168] space-y-1">
          <p className="font-semibold text-sm text-[#171B16]">Tranzaksiyalar mavjud emas</p>
          <p className="text-xs text-[#697168]">Ushbu oyda hali operatsiyalar qayd etilmagan.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E8EBE5]/60">
          {transactions.map((tx) => {
            const isIncome = tx.type === 'income';

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction?.(tx)}
                className="px-5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between hover:bg-[#F7F8F5] transition-colors cursor-pointer group h-[60px] sm:h-[54px]"
              >
                {/* Left: Compact Category Icon (34px) + Name + Category/Date */}
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                  <CategoryIcon name={tx.category || tx.name} type={isIncome ? 'in' : 'ex'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#171B16] truncate group-hover:text-[#163300] transition-colors leading-tight">
                      {tx.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[#697168] mt-0.5">
                      <span>{tx.category}</span>
                      <span className="text-[#959E94]">•</span>
                      <span>{formatUzbekCalendarDate(tx.date)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Compact Tabular Amount (14–15px) */}
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono text-sm sm:text-base font-bold tabular-nums block ${
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
