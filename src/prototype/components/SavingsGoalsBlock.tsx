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
      className="rounded-[20px] bg-white p-4 sm:p-5 border border-[#E8EBE5] shadow-[0_2px_8px_rgba(23,27,22,0.04)] space-y-4"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0">
            <Target className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
            Jamg‘arma maqsadlari
          </h2>
        </div>

        <button
          type="button"
          onClick={onViewAllGoals}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#163300] hover:underline cursor-pointer"
        >
          <span>Tahlilda ko‘rish</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Goal Cards ── */}
      <div className="space-y-3">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
          const remaining = Math.max(0, g.targetAmount - g.currentAmount);

          return (
            <div
              key={g.id}
              onClick={() => onSelectGoal(g)}
              className="p-3.5 rounded-xl bg-[#F7F8F5] border border-[#E8EBE5] hover:border-[#9FE870] transition-all cursor-pointer group space-y-2"
            >
              {/* Name & Percentage */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-white border border-[#E8EBE5] text-[#163300] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {getGoalIcon(g.icon)}
                  </div>
                  <span className="font-semibold text-[#171B16] truncate">
                    {g.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-[#163300] bg-[#F0F9E9] px-2 py-0.5 rounded-full border border-[#9FE870]/30 tabular-nums">
                  {pct}%
                </span>
              </div>

              {/* Progress Track: Wise Signature Lime Fill */}
              <div className="h-2 w-full bg-[#E8EBE5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#163300] rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Saved vs Target Amounts */}
              <div className="flex items-center justify-between text-[11px] text-[#697168] font-mono tabular-nums">
                <span>Yig‘ildi: <strong className="text-[#171B16]">{formatUzbekCurrency(g.currentAmount)}</strong></span>
                <span>Maqsad: {formatUzbekCurrency(g.targetAmount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
