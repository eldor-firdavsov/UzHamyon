'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Check } from 'lucide-react';
import type { Category, TransactionType } from '@/types/database';
import { cachedFetch, invalidateAllFinancialCaches, CACHE_TTL } from '@/lib/cache/clientCache';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import CategoryIcon from '@/components/categories/CategoryIcon';

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
  const router = useRouter();
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [chosenCategoryId, setChosenCategoryId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
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

  // Derived effective category ID
  const effectiveCategoryId =
    filteredCategories.some((c) => c.id === chosenCategoryId)
      ? chosenCategoryId
      : filteredCategories[0]?.id || '';

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

    setIsSubmitting(true);

    try {
      const selectedCategory = categories.find((c) => c.id === effectiveCategoryId);
      const defaultDesc =
        activeTab === 'transfer'
          ? 'O‘tkazma'
          : selectedCategory?.name || (activeTab === 'income' ? 'Daromad' : 'Xarajat');

      const finalDescription = note.trim() || defaultDesc;
      const finalType: TransactionType = activeTab === 'income' ? 'income' : 'expense';

      const payload = {
        description: finalDescription,
        amount: Math.round(parsedAmount * 100) / 100,
        currency: currency.toUpperCase(),
        type: finalType,
        transaction_date: date || new Date().toISOString().split('T')[0],
        category_id: effectiveCategoryId || undefined,
        notes: activeTab === 'transfer' ? (note ? `${note} [O‘tkazma]` : 'O‘tkazma') : note.trim() || undefined,
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
      setNote('');

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-[26px] border border-[#E8EBE5] shadow-2xl p-6 sm:p-7 space-y-5 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fast-transaction-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#E8EBE5]">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Transaction Type (Xarajat, Daromad) */}
          <div>
            <label className="block text-sm font-semibold text-[#5C6659] mb-1.5">
              Tranzaksiya turi
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F8F5] rounded-xl border border-[#E8EBE5]">
              <button
                type="button"
                id="fast-tx-tab-expense"
                onClick={() => setActiveTab('expense')}
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
                onClick={() => setActiveTab('income')}
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

          {/* 2. Amount Field (Focused Immediately, Large, Numeric Keyboard) */}
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

          {/* 3. Category Selector */}
          <div>
            <label htmlFor="fast-tx-category" className="block text-sm font-semibold text-[#5C6659] mb-1.5">
              Kategoriya
            </label>
            <div className="flex items-center gap-2.5">
              {effectiveCategoryId && (
                <CategoryIcon
                  name={getCategoryDisplayName(filteredCategories.find((c) => c.id === effectiveCategoryId)?.name || '')}
                  type={activeTab === 'income' ? 'in' : 'ex'}
                  size="sm"
                />
              )}
              <select
                id="fast-tx-category"
                value={effectiveCategoryId}
                onChange={(e) => setChosenCategoryId(e.target.value)}
                disabled={isSubmitting || loadingCategories}
                className="w-full min-h-[48px] rounded-xl border border-[#E8EBE5] bg-white px-3.5 py-2.5 text-sm text-[#163300] font-semibold focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
              >
                {filteredCategories.length === 0 ? (
                  <option value="">(Kategoriyalar mavjud emas)</option>
                ) : (
                  filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {getCategoryDisplayName(cat.name)}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* 4. Date (Defaults to Today) */}
          <div>
            <label htmlFor="fast-tx-date" className="block text-sm font-semibold text-[#5C6659] mb-1.5">
              Sana
            </label>
            <input
              id="fast-tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[48px] rounded-xl border border-[#E8EBE5] bg-white px-3.5 py-2.5 text-sm text-[#163300] font-medium focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
            />
          </div>

          {/* 5. Optional Note */}
          <div>
            <label htmlFor="fast-tx-note" className="block text-sm font-semibold text-[#5C6659] mb-1.5">
              Izoh <span className="text-[#5C6659] font-normal">(ixtiyoriy)</span>
            </label>
            <input
              id="fast-tx-note"
              type="text"
              placeholder="Masalan: Tushlik, Supermarket, Yoqilg‘i..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[48px] rounded-xl border border-[#E8EBE5] bg-white px-3.5 py-2.5 text-sm text-[#163300] placeholder-[#8C9886] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/30 transition-all"
            />
          </div>

          {/* 6. Primary "Saqlash" & Secondary "Bekor qilish" Action Buttons */}
          <div className="pt-2.5 flex items-center gap-3">
            <button
              type="button"
              id="fast-tx-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 min-h-[48px] py-2.5 px-4 rounded-xl border border-[#E8EBE5] bg-white hover:bg-[#F0F2ED] text-[#163300] text-sm font-semibold transition-all disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              id="fast-tx-submit-btn"
              disabled={isSubmitting || !amount}
              className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#9FE870] hover:bg-[#8ED660] text-[#163300] font-bold py-2.5 px-4 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#163300]" />
                  <span>Saqlanmoqda...</span>
                </>
              ) : successMessage ? (
                <>
                  <Check className="h-4 w-4 text-[#163300]" />
                  <span>Saqlandi</span>
                </>
              ) : (
                <span>Saqlash</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
