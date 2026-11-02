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
      className="rounded-[20px] bg-white p-5 border border-[#E8EBE5]/80 shadow-[0_1px_4px_rgba(23,27,22,0.03)] space-y-4"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
              Jamg‘arma maqsadlari
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAllGoals}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#163300] hover:text-[#26834A] transition-colors cursor-pointer"
        >
          <span>Tahlilda ko‘rish</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Clean Compact Goal Rows (NO nested cards) ── */}
      <div className="divide-y divide-[#E8EBE5]/50">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));

          return (
            <div
              key={g.id}
              onClick={() => onSelectGoal(g)}
              className="py-3 sm:py-3.5 first:pt-0 last:pb-0 cursor-pointer group space-y-2 hover:bg-[#F7F8F5]/60 -mx-2 px-2 rounded-xl transition-colors"
            >
              {/* Header: Icon, Name, and Compact Percentage */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-[#F7F8F5] text-[#171B16] flex items-center justify-center shrink-0 group-hover:bg-[#F0F9E9] group-hover:text-[#163300] transition-colors">
                    {getGoalIcon(g.icon)}
                  </div>
                  <span className="font-semibold text-[#171B16] truncate group-hover:text-[#163300] transition-colors">
                    {g.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-[#163300] bg-[#F0F9E9] px-2 py-0.5 rounded-full border border-[#9FE870]/30 tabular-nums">
                  {pct}%
                </span>
              </div>

              {/* Compact Slender Progress Bar */}
              <div className="h-1.5 w-full bg-[#E8EBE5]/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#163300] rounded-full transition-all duration-500 group-hover:bg-[#26834A]"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Compact Amounts */}
              <div className="flex items-center justify-between text-[11px] text-[#697168] font-mono tabular-nums">
                <span>
                  Yig‘ildi: <strong className="text-[#171B16] font-semibold">{formatUzbekCurrency(g.currentAmount)}</strong>
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
