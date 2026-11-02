'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteGoalModalProps {
  isOpen: boolean;
  goalName: string;
  goalId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteGoalModal({
  isOpen,
  goalName,
  goalId,
  onClose,
  onSuccess,
}: DeleteGoalModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Maqsadni o‘chirib bo‘lmadi');
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Maqsadni o‘chirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7 shadow-xl space-y-4">
        <div className="h-11 w-11 rounded-xl bg-rose-50 border border-rose-100 text-[#DC2626] flex items-center justify-center">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#18181B]">Jamg‘arma maqsadini o‘chirish</h2>
          <p className="mt-1.5 text-sm text-[#52525B] leading-relaxed">
            Haqiqatan ham <strong className="text-[#18181B] font-semibold">{goalName}</strong> maqsadini o‘chirmoqchimisiz?
            Bu jamg‘arma maqsadi doimiy ravishda o‘chiriladi.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[#DC2626] text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white text-[#18181B] hover:bg-[#F9FAFB] text-sm font-medium transition-colors"
          >
            Bekor qilish
          </button>
          <button
            id="confirm-delete-goal-btn"
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#DC2626] text-white font-medium text-sm hover:bg-[#B91C1C] transition-colors disabled:opacity-50 shadow-xs"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Maqsadni o‘chirish</span>
          </button>
        </div>
      </div>
    </div>
  );
}
