'use client';

import React from 'react';
import { Target, ArrowRight, Laptop, Plane, Shield } from 'lucide-react';
import type { DemoSavingsGoal } from '../demoData';
import { formatUzbekCurrency } from '../tokens';

interface SavingsGoalsBlockProps {
  goals: DemoSavingsGoal[];
  onViewAllGoals: () => void;
  onSelectGoal: (goal: DemoSavingsGoal) => void;
}

export function SavingsGoalsBlock({
  goals,
  onViewAllGoals,
  onSelectGoal,
}: SavingsGoalsBlockProps) {
  const getGoalIcon = (icon: string) => {
    switch (icon) {
      case 'laptop':
        return <Laptop className="h-4 w-4" />;
      case 'plane':
        return <Plane className="h-4 w-4" />;
      case 'shield':
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <section 
      aria-label="Jamg‘arma maqsadlari"
      className="rounded-[24px] bg-white p-5 sm:p-6 lg:p-7 border border-[#E8EBE5] shadow-[0_4px_20px_rgba(23,27,22,0.04)] space-y-4"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0 border border-[#9FE870]/40 shadow-2xs">
            <Target className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-[18px] sm:text-[20px] lg:text-[22px] font-bold text-[#171B16] tracking-tight leading-snug">
              Jamg‘arma maqsadlari
            </h2>
            <p className="text-[13px] sm:text-sm text-[#697168]">
              Rejalashtirilgan jamg‘armalar holati
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAllGoals}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-[#163300] hover:text-[#26834A] transition-colors cursor-pointer group"
        >
          <span>Tahlilda ko‘rish</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ── Goal Rows with Visible Progress Visualization ── */}
      <div className="divide-y divide-[#E8EBE5]/60 pt-1">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));

          return (
            <div
              key={g.id}
              onClick={() => onSelectGoal(g)}
              className="py-4 first:pt-1 last:pb-0 cursor-pointer group space-y-2.5 hover:bg-[#F7F8F5] -mx-2 px-3 rounded-2xl transition-colors min-h-[60px]"
            >
              {/* Header: Icon, Name, and Prominent Percentage Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-[#F7F8F5] text-[#163300] flex items-center justify-center shrink-0 border border-[#E8EBE5] group-hover:border-[#9FE870] group-hover:bg-[#F0F9E9] transition-all">
                    {getGoalIcon(g.icon)}
                  </div>
                  <span className="font-bold text-[#171B16] text-[15px] sm:text-base truncate group-hover:text-[#163300] transition-colors">
                    {g.name}
                  </span>
                </div>
                
                <span className="font-mono font-extrabold text-xs sm:text-sm text-[#163300] bg-[#9FE870]/25 px-2.5 py-0.5 rounded-full border border-[#9FE870]/50 tabular-nums">
                  {pct}%
                </span>
              </div>

              {/* Visible Progress Bar (Thicker 10px progress track) */}
              <div className="h-2.5 sm:h-3 w-full bg-[#E8EBE5] rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#163300] to-[#26834A] rounded-full transition-all duration-500 shadow-2xs"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Target & Saved Amounts */}
              <div className="flex items-center justify-between text-xs sm:text-[13px] text-[#697168] font-mono tabular-nums">
                <span>
                  Yig‘ildi: <strong className="text-[#171B16] font-bold">{formatUzbekCurrency(g.currentAmount)}</strong>
                </span>
                <span className="text-[#959E94]">
                  Maqsad: {formatUzbekCurrency(g.targetAmount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
