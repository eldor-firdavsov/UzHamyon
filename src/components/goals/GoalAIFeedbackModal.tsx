'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import type { GoalWithProgress } from '@/lib/goals/schemas';

interface GoalAIFeedbackModalProps {
  isOpen: boolean;
  goal: GoalWithProgress | null;
  onClose: () => void;
}

export default function GoalAIFeedbackModal({
  isOpen,
  goal,
  onClose,
}: GoalAIFeedbackModalProps) {
  if (!isOpen || !goal) return null;

  const formatCurrency = (amount: number, curr = 'UZS') => {
    if (curr === 'USD') {
      return `$${amount >= 1000 ? amount.toLocaleString('en-US') : Number(amount).toFixed(2)}`;
    }
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount))} soʻm`;
  };

  const isDone = goal.status === 'completed' || goal.percentage_completed >= 100;
  const feasStatus = goal.feasibility?.status;

  const getFeasConfig = () => {
    if (isDone) {
      return {
        title: 'Maqsad to‘liq bajarildi',
        badgeClass: 'bg-[#ECFDF5] text-[#059669] border-[#059669]/20',
        cardClass: 'bg-[#ECFDF5]/50 border-[#A7F3D0]',
        icon: CheckCircle2,
        recommendation:
          'Tabriklaymiz! Ushbu moliyaviy maqsadga to‘liq erishildi. Yangi maqsad belgilashingiz yoki to‘plangan mablag‘ni investitsiya qilish haqida o‘ylashingiz mumkin.',
      };
    }
    if (feasStatus === 'feasible') {
      return {
        title: 'Amalga oshirish mumkin',
        badgeClass: 'bg-[#ECFDF5] text-[#059669] border-[#059669]/20',
        cardClass: 'bg-[#ECFDF5]/50 border-[#A7F3D0]',
        icon: CheckCircle2,
        recommendation:
          'Sizning oylik erkin mablag‘ingiz ushbu maqsadni belgilangan muddatda bajarish uchun to‘liq yetarli. Reja bo‘yicha har oy belgilangan mablag‘ni ajratib boring.',
      };
    }
    if (feasStatus === 'challenging') {
      return {
        title: 'Qiyinroq (chegarada)',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
        cardClass: 'bg-amber-50/50 border-amber-200',
        icon: AlertCircle,
        recommendation:
          'Maqsadga o‘z vaqtida yetishish uchun oylik xarajatlarni biroz qisqartirish yoki maqsad muddatini 1-2 oyga uzaytirish orqali bosimni kamaytirish tavsiya etiladi.',
      };
    }
    if (feasStatus === 'unlikely') {
      return {
        title: 'Imkoniyat yetarli emas',
        badgeClass: 'bg-rose-50 text-[#DC2626] border-rose-200',
        cardClass: 'bg-rose-50/50 border-rose-200',
        icon: AlertTriangle,
        recommendation:
          'Hozirgi oylik erkin mablag‘ bilan belgilangan muddatga yetish qiyin. Maqsad muddatini uzaytirish yoki daromadni oshirish choralarini ko‘rish zarur.',
      };
    }
    return {
      title: 'Baholash natijasi',
      badgeClass: 'bg-[#F5F6F8] text-[#52525B] border-[#E5E7EB]',
      cardClass: 'bg-[#F5F6F8] border-[#E5E7EB]',
      icon: Sparkles,
      recommendation:
        'Maqsad jarayonini kuzatib boring va har oylik mablag‘larni o‘z vaqtida kiritishga harakat qiling.',
    };
  };

  const feasConfig = getFeasConfig();
  const StatusIcon = feasConfig.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in-50 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl border border-[#E5E7EB] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0 border border-[#059669]/20 shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="ai-feedback-modal-title"
                className="text-base sm:text-lg font-semibold text-[#18181B] tracking-tight"
              >
                AI Maqsad Tahlili
              </h2>
              <p className="text-xs text-[#71717A]">
                Shaxsiy moliyaviy tahlil va amaliy tavsiyalar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#71717A] hover:text-[#18181B] hover:bg-[#F9FAFB] transition-colors"
            title="Yopish"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Goal Overview Card */}
          <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-[#71717A]">
                  Jamg‘arma maqsadi
                </span>
                <h3 className="text-lg font-semibold text-[#18181B] mt-0.5">{goal.name}</h3>
                {goal.target_date && (
                  <p className="text-xs text-[#71717A] font-mono flex items-center gap-1.5 mt-1">
                    <Calendar className="h-3.5 w-3.5 text-[#059669]" />
                    <span>Muddat: {goal.target_date}</span>
                  </p>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${feasConfig.badgeClass}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                <span>{feasConfig.title}</span>
              </span>
            </div>

            {/* Amounts & Progress */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-baseline justify-between text-xs sm:text-sm">
                <span className="text-[#71717A]">
                  To‘plandi:{' '}
                  <strong className="text-[#059669] font-mono font-semibold">
                    {formatCurrency(goal.current_amount, goal.currency)}
                  </strong>
                </span>
                <span className="text-[#71717A]">
                  Maqsad:{' '}
                  <strong className="text-[#18181B] font-mono font-semibold">
                    {formatCurrency(goal.target_amount, goal.currency)}
                  </strong>
                </span>
              </div>

              <div className="h-3 w-full bg-[#F4F4F5] rounded-full overflow-hidden p-0.5 border border-[#E5E7EB]">
                <div
                  className="h-full bg-[#059669] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, goal.percentage_completed))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-[#71717A]">
                <span className="font-semibold text-[#059669]">
                  {goal.percentage_completed.toFixed(1)}% bajarildi
                </span>
                <span>
                  {isDone
                    ? 'Maqsadga erishildi!'
                    : `${formatCurrency(goal.remaining_amount, goal.currency)} qoldi`}
                </span>
              </div>
            </div>
          </div>

          {/* AI Feasibility Assessment Box */}
          <div className={`p-4 rounded-2xl border ${feasConfig.cardClass} space-y-2.5`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#059669]" />
                <h4 className="text-sm font-semibold text-[#18181B]">
                  Xulosa va Baholash
                </h4>
              </div>
              {goal.feasibility?.monthly_needed !== null && !isDone && (
                <span className="text-xs font-mono font-semibold text-[#059669] bg-white px-2.5 py-1 rounded-lg border border-[#E5E7EB]">
                  Kerak: {formatCurrency(goal.feasibility.monthly_needed, goal.currency)}/oy
                </span>
              )}
            </div>

            <p className="text-sm text-[#18181B] leading-relaxed">
              {goal.feasibility?.explanation || feasConfig.recommendation}
            </p>
          </div>

          {/* Key Metrics Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-xs text-[#71717A] block font-medium">Qolgan vaqt</span>
              <strong className="text-sm sm:text-base font-semibold text-[#18181B] font-mono mt-0.5 block">
                {goal.feasibility?.estimated_months_remaining !== null &&
                goal.feasibility?.estimated_months_remaining !== undefined
                  ? `${goal.feasibility.estimated_months_remaining} oy`
                  : 'Belgilanmagan'}
              </strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-xs text-[#71717A] block font-medium">O‘rtacha erkin jamg‘arma</span>
              <strong className="text-sm sm:text-base font-semibold text-[#059669] font-mono mt-0.5 block">
                {goal.feasibility?.average_monthly_net_savings !== null &&
                goal.feasibility?.average_monthly_net_savings !== undefined
                  ? `${formatCurrency(goal.feasibility.average_monthly_net_savings, goal.currency)}/oy`
                  : 'Yetarli emas'}
              </strong>
            </div>
          </div>

          {/* AI Advisor Action Banner */}
          <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-[#059669]">Savollaringiz bormi?</span>
              <p className="text-xs text-[#52525B]">
                AI yordamchidan ushbu maqsadni tezlashtirish rejasini so‘rang.
              </p>
            </div>
            <Link
              href="/advisor"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium transition-all shrink-0 shadow-xs"
            >
              <span>AI Suhbat</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#E5E7EB] bg-white flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#F5F6F8] hover:bg-[#E4E4E7] text-[#18181B] text-sm font-medium transition-colors"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
