'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Check, Sparkles } from 'lucide-react';
import type { Category, TransactionType } from '@/types/database';
import { cachedFetch, invalidateAllFinancialCaches, CACHE_TTL } from '@/lib/cache/clientCache';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import CategoryIcon from '@/components/categories/CategoryIcon';
import { predictCategoryFromTitle, matchPredictedToDbCategory } from '@/lib/categories/predictCategory';
import {
  getNowLocalDateString,
  getNowLocalTimeString,
  isValidCalendarDate,
  isValidTimeString,
} from '@/lib/transactions/dateTime';
import { useModalScrollLock } from '@/lib/ui/useModalScrollLock';

export interface FastTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  categories?: Category[];
}

export default function FastTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  categories: initialCategories,
}: FastTransactionModalProps) {
  useModalScrollLock(isOpen);

  const router = useRouter();
  const amountInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [chosenCategoryId, setChosenCategoryId] = useState('auto');
  const [date, setDate] = useState(() => getNowLocalDateString());
  const [time, setTime] = useState(() => getNowLocalTimeString());
  const [note, setNote] = useState('');
  const currency = 'UZS';
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Interaction State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch categories when opened if none available
  useEffect(() => {
    if (!isOpen) return;

    if (categories.length === 0) {
      let isMounted = true;
      const fetchCategories = async () => {
        try {
          const data = await cachedFetch<{ categories: Category[] }>(
            '/api/categories',
            undefined,
            CACHE_TTL.CATEGORIES
          );
          if (isMounted && data.categories) {
            setCategories(data.categories);
          }
        } catch {
          // ignore
        } finally {
          if (isMounted) setLoadingCategories(false);
        }
      };
      fetchCategories();
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, categories.length]);

  // Focus amount input immediately on open & clear notices
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
        amountInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Available categories for current type
  const targetType = activeTab === 'income' ? 'income' : 'expense';
  const filteredCategories = categories.filter((c) => c.type === targetType);

  // AI prediction based on input title (with fallback to note)
  const predicted = predictCategoryFromTitle(title || note, targetType);
  const matchedAutoCategory = matchPredictedToDbCategory(predicted.category, filteredCategories);

  // Derived effective category ID
  const isAutoCategory = chosenCategoryId === 'auto' || !chosenCategoryId;
  const effectiveCategoryId = isAutoCategory
    ? matchedAutoCategory?.id || filteredCategories[0]?.id || ''
    : chosenCategoryId;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Iltimos, to‘g‘ri summa kiriting.');
      amountInputRef.current?.focus();
      return;
    }

    const decimals = amount.split('.')[1] || amount.split(',')[1];
    if (decimals && decimals.length > 2) {
      setError('Summada 2 tadan ortiq kasr xonasi bo‘lishi mumkin emas.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Iltimos, tranzaksiya nomini (title) kiriting.');
      titleInputRef.current?.focus();
      return;
    }

    if (!date || !isValidCalendarDate(date)) {
      setError('Tranzaksiya sanasi to‘g‘ri formatda kiritilishi shart (YYYY-MM-DD).');
      return;
    }

    if (time && !isValidTimeString(time)) {
      setError('Tranzaksiya vaqti to‘g‘ri formatda kiritilishi shart (HH:mm).');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalType: TransactionType = activeTab === 'income' ? 'income' : 'expense';

      const payload = {
        description: trimmedTitle,
        amount: Math.round(parsedAmount * 100) / 100,
        currency: currency.toUpperCase(),
        type: finalType,
        transaction_date: date,
        transaction_time: time || undefined,
        category_id: effectiveCategoryId || undefined,
        notes: note.trim() || undefined,
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Tranzaksiyani saqlashda xatolik yuz berdi');
      }

      setSuccessMessage('Tranzaksiya muvaffaqiyatli saqlandi');
      setAmount('');
      setTitle('');
      setNote('');
      setChosenCategoryId('auto');

      // Invalidate caches and refresh data
      invalidateAllFinancialCaches();
      router.refresh();
      onSuccess?.();

      // Brief delay to display checkmark, then close
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 500);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Saqlash muvaffaqiyatsiz bo‘ldi');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 overscroll-contain touch-pan-y"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-[26px] border border-[#E8EBE5] shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85dvh] overscroll-contain touch-pan-y overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fast-transaction-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between p-5 sm:p-6 pb-3.5 border-b border-[#E8EBE5] bg-white">
          <h2 id="fast-transaction-title" className="text-xl font-bold tracking-tight text-[#163300]">
            Tranzaksiya qo‘shish
          </h2>
          <button
            type="button"
            id="close-fast-transaction-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-xl text-[#5C6659] hover:text-[#163300] hover:bg-[#F0F2ED] transition-colors"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-5 sm:p-6 space-y-4">
            {/* Error Notice */}
            {error && (
              <div
                id="fast-transaction-error"
                className="p-3.5 rounded-xl bg-[#FDF2F2] border border-[#D64D4D]/20 text-sm text-[#D64D4D] font-medium"
              >
                {error}
              </div>
            )}

            {/* Success Notice */}
            {successMessage && (
              <div
                id="fast-transaction-success"
                className="p-3.5 rounded-xl bg-[#EDF8F1] border border-[#26834A]/20 text-sm text-[#26834A] font-medium flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* 1. Xarajat yoki Daromad (Tranzaksiya turi) */}
          <div>
            <label className="block text-sm font-semibold text-[#5C6659] mb-1.5">
              Tranzaksiya turi
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F8F5] rounded-xl border border-[#E8EBE5]">
              <button
                type="button"
                id="fast-tx-tab-expense"
                onClick={() => {
                  setActiveTab('expense');
                  setChosenCategoryId('auto');
                }}
                className={`min-h-[44px] py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'expense'
                    ? 'bg-[#D64D4D] text-white shadow-sm'
                    : 'text-[#5C6659] hover:text-[#163300] hover:bg-black/5'
                }`}
              >
                Xarajat
              </button>
              <button
                type="button"
                id="fast-tx-tab-income"
                onClick={() => {
                  setActiveTab('income');
                  setChosenCategoryId('auto');
                }}
                className={`min-h-[44px] py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'income'
                    ? 'bg-[#26834A] text-white shadow-sm'
                    : 'text-[#5C6659] hover:text-[#163300] hover:bg-black/5'
                }`}
              >
                Daromad
              </button>
            </div>
            {/* Accessible fallback for transfer */}
            <button
              type="button"
              id="fast-tx-tab-transfer"
              onClick={() => setActiveTab('transfer')}
              className="sr-only"
              aria-hidden="true"
            >
              O‘tkazma
            </button>
          </div>

          {/* 2. Amount (Summa) */}
          <div>
            <label htmlFor="fast-tx-amount" className="block text-sm font-semibold text-[#5C6659] mb-1.5">
              Summa <span className="text-[#D64D4D]">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-medium text-[#5C6659]">
                so‘m
              </span>
              <input
                ref={amountInputRef}
                id="fast-tx-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[52px] rounded-xl border border-[#E8EBE5] bg-white pl-14 pr-3.5 py-2.5 text-2xl font-bold font-mono tabular-nums text-[#163300] placeholder-[#A1A1AA] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
                required
              />
            </div>
          </div>

          {/* 3. Title (Nomi) — ALBATTA BO‘LISHI KERAK */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="fast-tx-title" className="block text-sm font-semibold text-[#5C6659]">
                Nomi (Title) <span className="text-[#D64D4D]">*</span>
              </label>
              <span className="text-xs text-[#71717A]">Majburiy</span>
            </div>
            <input
              ref={titleInputRef}
              id="fast-tx-title"
              type="text"
              required
              placeholder={
                activeTab === 'expense'
                  ? 'Masalan: Tushlik, Supermarket, Taksi...'
                  : 'Masalan: Oylik maosh, Keshbek, Mukofot...'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[48px] rounded-xl border border-[#E8EBE5] bg-white px-3.5 py-2.5 text-sm text-[#163300] placeholder-[#8C9886] font-medium focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
            />
          </div>

          {/* 4. Kategoriya (AI Titlega qarab avtomatik tanlaydi) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="fast-tx-category" className="block text-sm font-semibold text-[#5C6659]">
                Kategoriya
              </label>
              {isAutoCategory && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#BBF7D0]">
                  <Sparkles className="h-3 w-3 text-[#16A34A]" />
                  AI: {predicted.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <CategoryIcon
                name={isAutoCategory ? 'Auto' : getCategoryDisplayName(filteredCategories.find((c) => c.id === effectiveCategoryId)?.name || '')}
                type={activeTab === 'income' ? 'in' : 'ex'}
                size="sm"
              />
              <select
                id="fast-tx-category"
                value={chosenCategoryId || 'auto'}
                onChange={(e) => setChosenCategoryId(e.target.value)}
                disabled={isSubmitting || loadingCategories}
                className="w-full min-h-[48px] rounded-xl border border-[#E8EBE5] bg-white px-3.5 py-2.5 text-sm text-[#163300] font-semibold focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
              >
                <option value="auto">Auto (AI titlega qarab tanlaydi)</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {getCategoryDisplayName(cat.name)}
                  </option>
                ))}
              </select>
            </div>
            {isAutoCategory && (
              <p className="text-xs text-[#5C6659] mt-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#16A34A] shrink-0" />
                <span>AI title asosida toifani <strong>«{predicted.category}»</strong> deb tanlaydi</span>
              </p>
            )}
          </div>

          {/* 5. Izoh, Sana va Vaqt */}
          <div>
            <label htmlFor="fast-tx-note" className="block text-sm font-semibold text-[#5C6659] mb-1.5">
              Izoh <span className="text-[#71717A] font-normal">(ixtiyoriy)</span>
            </label>
            <input
              id="fast-tx-note"
              type="text"
              placeholder="Qo‘shimcha tafsilotlar..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[48px] rounded-xl border border-[#E8EBE5] bg-white px-3.5 py-2.5 text-sm text-[#163300] placeholder-[#8C9886] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fast-tx-date" className="block text-sm font-semibold text-[#5C6659] mb-1.5">
                Sana <span className="text-[#D64D4D]">*</span>
              </label>
              <input
                id="fast-tx-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] rounded-xl border border-[#E8EBE5] bg-white px-3.5 py-2.5 text-sm text-[#163300] font-medium focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
              />
            </div>
            <div>
              <label htmlFor="fast-tx-time" className="block text-sm font-semibold text-[#5C6659] mb-1.5">
                Vaqt <span className="text-[#D64D4D]">*</span>
              </label>
              <input
                id="fast-tx-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] rounded-xl border border-[#E8EBE5] bg-white px-3.5 py-2.5 text-sm text-[#163300] font-medium focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
              />
            </div>
          </div>

          </div>

          {/* 6. Tranzaksiya qo‘shish — Pinned action buttons */}
          <div className="shrink-0 p-4 sm:p-6 pt-3 border-t border-[#E8EBE5] bg-white flex items-center gap-3">
            <button
              type="button"
              id="fast-tx-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[48px] py-2.5 px-4 rounded-xl border border-[#E8EBE5] bg-white hover:bg-[#F0F2ED] text-[#163300] text-sm font-semibold transition-all disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              id="fast-tx-submit-btn"
              disabled={isSubmitting || !amount || !title.trim()}
              className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#9FE870] hover:bg-[#8ED660] text-[#163300] font-bold py-2.5 px-4 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#163300]" />
                  <span>Qo‘shilmoqda...</span>
                </>
              ) : successMessage ? (
                <>
                  <Check className="h-4 w-4 text-[#163300]" />
                  <span>Qo‘shildi</span>
                </>
              ) : (
                <span>Tranzaksiya qo‘shish</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
