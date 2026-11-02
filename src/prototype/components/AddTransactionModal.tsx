'use client';

import React, { useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Check, Calendar } from 'lucide-react';
import { DEMO_CATEGORIES, type DemoTransaction } from '../demoData';
import { formatUzbekCurrency } from '../tokens';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: DemoTransaction) => void;
}

export function AddTransactionModal({
  isOpen,
  onClose,
  onAddTransaction,
}: AddTransactionModalProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dateStr, setDateStr] = useState('2026-10-31');

  if (!isOpen) return null;

  const numericAmount = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;
  const currentCategories = DEMO_CATEGORIES[type];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) return;

    const newTx: DemoTransaction = {
      id: `tx-demo-${Date.now()}`,
      name: name.trim() || (type === 'income' ? 'Qo‘shimcha daromad' : 'Kutilmagan xarajat'),
      category: selectedCategory || (type === 'income' ? 'Daromad' : 'Umumiy xarajat'),
      categoryIcon: type === 'income' ? 'wallet' : 'cart',
      date: '31-oktabr, 2026',
      time: '12:00',
      amount: numericAmount,
      type,
      account: 'Asosiy karta',
    };

    onAddTransaction(newTx);
    onClose();
    // Reset state
    setAmountStr('');
    setName('');
    setSelectedCategory('');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
      aria-modal="true"
      role="dialog"
    >
      {/* ── Slide-up Bottom Sheet (Mobile) / Centered Modal (Tablet/Desktop) ── */}
      <div 
        className="w-full max-w-md rounded-t-[28px] sm:rounded-[24px] bg-white p-5 sm:p-6 shadow-[0_20px_50px_rgba(23,27,22,0.2)] border border-[#E8EBE5] max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle for Mobile */}
        <div className="w-12 h-1.5 bg-[#E8EBE5] rounded-full mx-auto mb-4 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8EBE5]">
          <h3 className="text-base font-bold text-[#171B16] tracking-tight">
            Yangi tranzaksiya
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="h-8 w-8 rounded-full bg-[#F7F8F5] text-[#697168] hover:text-[#171B16] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-4">
          {/* 1. Type Switcher: Chiqim / Kirim */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F8F5] rounded-full border border-[#E8EBE5]">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setSelectedCategory('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                type === 'expense'
                  ? 'bg-white text-[#D64D4D] shadow-xs'
                  : 'text-[#697168] hover:text-[#171B16]'
              }`}
            >
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
              <span>Chiqim (Xarajat)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setSelectedCategory('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                type === 'income'
                  ? 'bg-white text-[#26834A] shadow-xs'
                  : 'text-[#697168] hover:text-[#171B16]'
              }`}
            >
              <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
              <span>Kirim (Daromad)</span>
            </button>
          </div>

          {/* 2. Amount Big Input */}
          <div className="space-y-1.5 text-center py-2">
            <label htmlFor="tx-amount-input" className="text-xs font-medium text-[#697168]">
              Summani kiriting
            </label>
            <div className="relative flex items-center justify-center">
              <input
                id="tx-amount-input"
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  if (!raw) {
                    setAmountStr('');
                  } else {
                    const num = parseInt(raw, 10);
                    setAmountStr(new Intl.NumberFormat('uz-UZ').format(num).replace(/,/g, ' '));
                  }
                }}
                placeholder="0"
                autoFocus
                className="w-full text-center font-mono text-3xl font-extrabold text-[#171B16] placeholder:text-[#959E94] focus:outline-none bg-transparent"
              />
            </div>
            <p className="text-xs font-semibold text-[#163300]">
              {numericAmount > 0 ? formatUzbekCurrency(numericAmount, { showSign: true, isExpense: type === 'expense' }) : 'so‘m'}
            </p>
          </div>

          {/* 3. Description / Merchant */}
          <div className="space-y-1.5">
            <label htmlFor="tx-name-input" className="text-xs font-semibold text-[#171B16]">
              Nomi yoki qayerga
            </label>
            <input
              id="tx-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'expense' ? 'Masalan: Korzinka, Taksi, Kafe' : 'Masalan: Oylik, Mukofot'}
              className="w-full rounded-xl border border-[#E8EBE5] bg-[#F7F8F5] px-3.5 py-2.5 text-xs sm:text-sm text-[#171B16] focus:border-[#163300] focus:bg-white focus:outline-none transition-all"
            />
          </div>

          {/* 4. Category Selector Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#171B16]">
              Kategoriya
            </label>
            <div className="flex flex-wrap gap-1.5">
              {currentCategories.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#163300] text-[#9FE870] font-semibold shadow-xs'
                        : 'bg-[#F7F8F5] text-[#697168] hover:text-[#171B16] border border-[#E8EBE5]'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Date selection */}
          <div className="flex items-center justify-between text-xs pt-1 text-[#697168]">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#163300]" />
              Sana:
            </span>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="rounded-lg border border-[#E8EBE5] px-2 py-1 text-xs text-[#171B16] bg-[#F7F8F5] focus:outline-none"
            />
          </div>

          {/* 6. Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#E8EBE5]">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-[#E8EBE5] bg-white text-xs sm:text-sm font-semibold text-[#697168] hover:bg-[#F7F8F5] transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={numericAmount <= 0}
              className="w-full py-3 rounded-xl bg-[#9FE870] hover:bg-[#8ED760] text-[#163300] font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>Saqlash</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
