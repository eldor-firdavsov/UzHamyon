'use client';

import React, { useState } from 'react';
import { X, Target, Plus, Check } from 'lucide-react';
import type { DemoSavingsGoal } from '../demoData';
import { formatUzbekCurrency } from '../tokens';

interface GoalDetailModalProps {
  goal: DemoSavingsGoal | null;
  onClose: () => void;
  onContribute: (goalId: string, amount: number) => void;
}

export function GoalDetailModal({
  goal,
  onClose,
  onContribute,
}: GoalDetailModalProps) {
  const [depositAmount, setDepositAmount] = useState<number>(200000);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!goal) return null;

  const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  const handleDeposit = () => {
    onContribute(goal.id, depositAmount);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="w-full max-w-md rounded-t-[28px] sm:rounded-[24px] bg-white p-5 sm:p-6 shadow-[0_20px_50px_rgba(23,27,22,0.2)] border border-[#E8EBE5] max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-[#E8EBE5] rounded-full mx-auto mb-4 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8EBE5]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0">
              <Target className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-[#171B16] tracking-tight">
              Maqsad tafsiloti
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="h-8 w-8 rounded-full bg-[#F7F8F5] text-[#697168] hover:text-[#171B16] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Goal Hero Card */}
        <div className="mt-4 p-4 rounded-2xl bg-[#F7F8F5] border border-[#E8EBE5] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-[#171B16]">{goal.name}</span>
            <span className="font-mono font-bold text-xs text-[#163300] bg-[#9FE870] px-2.5 py-0.5 rounded-full border border-[#8ED760]">
              {pct}%
            </span>
          </div>

          <div className="h-2.5 w-full bg-[#E8EBE5] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#163300] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums pt-1">
            <div className="p-2 rounded-xl bg-white border border-[#E8EBE5]/60">
              <span className="text-[10px] text-[#697168] block">Yig‘ilgan mablag‘</span>
              <strong className="text-[#163300] text-sm">{formatUzbekCurrency(goal.currentAmount)}</strong>
            </div>
            <div className="p-2 rounded-xl bg-white border border-[#E8EBE5]/60">
              <span className="text-[10px] text-[#697168] block">Maqsad summasi</span>
              <strong className="text-[#171B16] text-sm">{formatUzbekCurrency(goal.targetAmount)}</strong>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#697168] pt-1">
            <span>Yetishmayotgan: <strong>{formatUzbekCurrency(remaining)}</strong></span>
            <span>Muddat: {goal.targetDate}</span>
          </div>
        </div>

        {/* Quick Deposit Demo Action */}
        <div className="mt-5 space-y-3">
          <label className="text-xs font-semibold text-[#171B16] block">
            Jamg‘armaga tezkor hissa qo‘shish (demo):
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[100000, 200000, 500000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setDepositAmount(amt)}
                className={`py-2 px-1 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                  depositAmount === amt
                    ? 'bg-[#163300] text-[#9FE870] font-bold shadow-xs'
                    : 'bg-[#F7F8F5] text-[#171B16] border border-[#E8EBE5] hover:border-[#163300]'
                }`}
              >
                +{formatUzbekCurrency(amt)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDeposit}
            className="w-full mt-2 py-3 rounded-xl bg-[#9FE870] hover:bg-[#8ED760] text-[#163300] font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {isSuccess ? (
              <>
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Muvaffaqiyatli qo‘shildi!</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>{formatUzbekCurrency(depositAmount)} qo‘shish</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
