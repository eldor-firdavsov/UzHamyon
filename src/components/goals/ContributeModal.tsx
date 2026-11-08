import { useState } from 'react';
import { X, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { GoalWithProgress } from '@/lib/goals/schemas';
import { GappedNumberInput } from '@/components/ui/GappedNumberInput';
import { parseNumberFromGaps } from '@/lib/formatters/numberGaps';

interface ContributeModalProps {
  isOpen: boolean;
  goal: GoalWithProgress;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ContributeModal({
  isOpen,
  goal,
  onClose,
  onSuccess,
}: ContributeModalProps) {
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const numAmount = parseNumberFromGaps(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Iltimos, 0 dan katta to‘g‘ri summa kiriting');
      setLoading(false);
      return;
    }

    const contributionAmount = action === 'withdraw' ? -numAmount : numAmount;

    try {
      const res = await fetch(`/api/goals/${goal.id}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: contributionAmount,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Maqsad mablag‘ini yangilab bo‘lmadi');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mablag‘ni yangilashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3.5">
          <div>
            <h2 className="text-xl font-semibold text-[#18181B]">Mablag‘ kiritish / yechish</h2>
            <p className="text-sm text-[#52525B] mt-0.5">{goal.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#71717A] hover:text-[#18181B] hover:bg-[#F9FAFB] min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[#DC2626] text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Action toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F5F6F8] rounded-xl border border-[#E5E7EB]">
            <button
              type="button"
              id="action-deposit-btn"
              onClick={() => setAction('deposit')}
              className={`flex items-center justify-center gap-1.5 min-h-[44px] py-2 rounded-lg font-medium text-sm transition-all ${
                action === 'deposit'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'text-[#52525B] hover:text-[#18181B] hover:bg-black/5'
              }`}
            >
              <ArrowDownRight className="h-4 w-4" />
              <span>Maqsadga qo‘shish</span>
            </button>
            <button
              type="button"
              id="action-withdraw-btn"
              onClick={() => setAction('withdraw')}
              className={`flex items-center justify-center gap-1.5 min-h-[44px] py-2 rounded-lg font-medium text-sm transition-all ${
                action === 'withdraw'
                  ? 'bg-[#DC2626] text-white shadow-xs'
                  : 'text-[#52525B] hover:text-[#DC2626] hover:bg-black/5'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Balansga qaytarish</span>
            </button>
          </div>

          <p className="text-xs text-[#71717A] leading-relaxed px-1">
            {action === 'deposit'
              ? '💡 Qo‘shilgan mablag‘ daromadlardan qolgan erkin balansingizdan ajratiladi va ushbu maqsadda saqlanadi.'
              : '💡 Yechib olingan mablag‘ umumiy erkin balansingizga qaytariladi.'}
          </p>

          <div>
            <label className="block text-sm font-medium text-[#52525B] mb-1.5">
              Summa (soʻm) *
            </label>
            <GappedNumberInput
              id="contribute-amount-input"
              required
              placeholder="100 000"
              value={amount}
              onChange={(formatted) => setAmount(formatted)}
              className="w-full min-h-[48px] bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 text-[#18181B] font-semibold font-mono tabular-nums text-base focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#52525B] mb-1.5">
              Izoh (ixtiyoriy)
            </label>
            <input
              id="contribute-note-input"
              type="text"
              placeholder="Masalan: Oylik maoshdan tejash"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-h-[48px] bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 text-sm text-[#18181B] placeholder-[#71717A] focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white text-[#18181B] hover:bg-[#F9FAFB] text-sm font-medium transition-colors"
            >
              Bekor qilish
            </button>
            <button
              id="save-contribution-btn"
              type="submit"
              disabled={loading}
              className={`inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 shadow-xs ${
                action === 'deposit'
                  ? 'bg-[#059669] hover:bg-[#047857]'
                  : 'bg-[#DC2626] hover:bg-[#B91C1C]'
              }`}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{action === 'deposit' ? 'Jamg‘armaga qo‘shish' : 'Mablag‘ni yechish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
