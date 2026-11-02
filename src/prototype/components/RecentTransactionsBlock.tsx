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
        return isIncome ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />;
    }
  };

  return (
    <section 
      aria-label="So‘nggi amallar"
      className="rounded-[20px] bg-white border border-[#E8EBE5]/80 shadow-[0_1px_4px_rgba(23,27,22,0.03)] overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-[#E8EBE5]/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
              So‘nggi amallar
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#163300] hover:text-[#26834A] transition-colors cursor-pointer"
        >
          <span>Barchasi</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Transaction Rows (Clean list with minimal subtle separators) ── */}
      {transactions.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#697168] space-y-1.5">
          <p className="font-semibold text-sm text-[#171B16]">Tranzaksiyalar mavjud emas</p>
          <p>Yangi tranzaksiya qo‘shish uchun &quot;+&quot; tugmasini bosing.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E8EBE5]/50">
          {transactions.map((tx) => {
            const isIncome = tx.type === 'income';

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction?.(tx)}
                className="px-5 py-3 flex items-center justify-between hover:bg-[#F7F8F5]/80 transition-colors cursor-pointer group"
              >
                {/* Left: Category Icon + Title + Meta */}
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                      isIncome
                        ? 'bg-[#EDF7F0] text-[#26834A]'
                        : 'bg-[#F7F8F5] text-[#171B16]'
                    }`}
                  >
                    {getCategoryIcon(tx.categoryIcon, isIncome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#171B16] truncate group-hover:text-[#163300] transition-colors">
                      {tx.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#697168] mt-0.5">
                      <span>{tx.category}</span>
                      <span className="text-[#959E94]">•</span>
                      <span>{tx.date.split(',')[0]}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Tabular Amount */}
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono text-xs sm:text-sm font-bold tabular-nums block ${
                      isIncome ? 'text-[#26834A]' : 'text-[#171B16]'
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
