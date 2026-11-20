'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Clock, Delete, X } from 'lucide-react';
import { getCategoryMeta } from '@/components/categories/CategoryIcon';
import { predictCategoryFromTitle } from '@/lib/categories/predictCategory';
import { computeQuickPicks, shortAmount, type QuickPick, type QuickPickSource } from '@/lib/transactions/quickPicks';
import { addDaysToDate } from '@/lib/time/tashkent';
import { getNowLocalDateString, getNowLocalTimeString } from '@/lib/transactions/dateTime';
import { useModalScrollLock } from '@/lib/ui/useModalScrollLock';
import { haptic } from '@/lib/ui/haptics';

export interface QuickAddInput {
  type: 'in' | 'ex';
  amount: string;
  desc: string;
  cat: string;
  date: string;
  time: string;
}

/** Mount only while open: every open starts with a fresh form. */
interface QuickAddSheetProps {
  transactions: QuickPickSource[];
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  /** Resolves true when the database confirmed the write. */
  onSave: (input: QuickAddInput) => Promise<boolean>;
  /** Opens the full form (date, time, category picker). */
  onOpenFullForm?: (input: QuickAddInput) => void;
}

const MAX_DIGITS = 12;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;

function groupDigits(digits: string): string {
  if (!digits) return '0';
  return String(Number(digits)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function categoryFor(pickOrDesc: { cat?: string; desc: string }, type: 'in' | 'ex'): string {
  if (pickOrDesc.cat && pickOrDesc.cat !== 'Auto') return pickOrDesc.cat;
  return predictCategoryFromTitle(pickOrDesc.desc || '', type).category;
}

export default function QuickAddSheet({
  transactions,
  isSaving,
  error,
  onClose,
  onSave,
  onOpenFullForm,
}: QuickAddSheetProps) {
  const [type, setType] = useState<'in' | 'ex'>('ex');
  const [digits, setDigits] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Auto');
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [yesterday, setYesterday] = useState(false);

  useModalScrollLock(true);

  const today = getNowLocalDateString();
  const picks = useMemo(() => computeQuickPicks(transactions, type, today), [transactions, type, today]);

  const effectiveCat = categoryFor({ cat, desc }, type);
  const catMeta = getCategoryMeta(effectiveCat, type);
  const CatIcon = catMeta.icon;
  const canSave = Number(digits) > 0 && desc.trim().length > 0 && !isSaving;

  const choose = (p: QuickPick) => {
    haptic('light');
    setPickedKey(p.key);
    setDesc(p.desc);
    setCat(p.cat || 'Auto');
    if (p.amount > 0) setDigits(String(Math.round(p.amount)));
  };

  const press = (k: (typeof KEYS)[number]) => {
    haptic('light');
    setDigits((prev) => {
      if (k === 'del') return prev.slice(0, -1);
      const next = (prev === '0' ? '' : prev) + k;
      const trimmed = next.replace(/^0+/, '');
      return trimmed.length > MAX_DIGITS ? prev : trimmed;
    });
  };

  const buildInput = (): QuickAddInput => ({
    type,
    amount: digits,
    desc: desc.trim(),
    cat: cat === 'Auto' ? 'Auto' : cat,
    date: yesterday ? addDaysToDate(today, -1) : today,
    time: yesterday ? '12:00' : getNowLocalTimeString(),
  });

  const save = async () => {
    if (!canSave) return;
    const ok = await onSave(buildInput());
    if (ok) haptic('success');
  };

  return (
    <div
      className="uz-qa-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="uz-qa-sheet" role="dialog" aria-modal="true" aria-label="Amal qo‘shish">
        <div style={{ width: 40, height: 5, borderRadius: 3, background: '#C9CFC4', alignSelf: 'center' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" className="uz-qa-round" aria-label="Yopish" onClick={onClose} disabled={isSaving}>
            <X size={20} strokeWidth={2.2} />
          </button>
          <div className="uz-qa-seg" role="group" aria-label="Turi">
            <button type="button" aria-pressed={type === 'ex'} onClick={() => { setType('ex'); setPickedKey(null); setCat('Auto'); }}>
              Chiqim
            </button>
            <button type="button" aria-pressed={type === 'in'} onClick={() => { setType('in'); setPickedKey(null); setCat('Auto'); }}>
              Kirim
            </button>
          </div>
          <button
            type="button"
            className="uz-qa-day"
            aria-label={yesterday ? 'Kecha uchun' : 'Bugun uchun'}
            onClick={() => setYesterday((v) => !v)}
          >
            <Clock size={14} strokeWidth={2.4} />
            {yesterday ? 'Kecha' : 'Bugun'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }} aria-live="polite">
            <span className="uz-qa-amount" style={{ color: type === 'in' ? '#2E7D32' : '#111511' }}>
              {type === 'in' ? '+' : '−'}
              {groupDigits(digits)}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#6B7068' }}>so‘m</span>
          </div>
          <label htmlFor="qa-desc" className="sr-only">Nomi</label>
          <input
            id="qa-desc"
            className="uz-qa-desc"
            value={desc}
            maxLength={255}
            placeholder={type === 'ex' ? 'Nimaga?' : 'Qayerdan?'}
            onChange={(e) => {
              setDesc(e.target.value);
              setPickedKey(null);
              setCat('Auto');
            }}
          />
          {desc.trim() && (
            <button
              type="button"
              className="uz-qa-chip"
              onClick={() => onOpenFullForm?.(buildInput())}
              aria-label={`Kategoriya: ${effectiveCat}. O‘zgartirish`}
            >
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: catMeta.bg, color: catMeta.color, display: 'grid', placeItems: 'center' }}>
                <CatIcon size={13} strokeWidth={2.4} />
              </span>
              <span>{effectiveCat}</span>
              <ChevronDown size={14} color="#6B7068" />
            </button>
          )}
        </div>

        <div className="uz-qa-favs">
          {picks.favorites.map((p) => {
            const meta = getCategoryMeta(categoryFor(p, type), type);
            const Icon = meta.icon;
            return (
              <button key={p.key} type="button" className="uz-qa-fav" aria-pressed={pickedKey === p.key} onClick={() => choose(p)}>
                <span className="uz-qa-fav-ic" style={{ background: meta.bg, color: meta.color }}>
                  <Icon size={24} strokeWidth={2.1} />
                </span>
                <span className="uz-qa-fav-name">{p.desc}</span>
                <span className="uz-qa-fav-amt">{shortAmount(p.amount)}</span>
              </button>
            );
          })}
        </div>

        {picks.recents.length > 0 && (
          <div className="uz-qa-recents" aria-label="Oxirgilar">
            <Clock size={18} color="#6B7068" style={{ flex: '0 0 18px' }} aria-hidden="true" />
            {picks.recents.map((p) => (
              <button key={p.key} type="button" className="uz-qa-recent" onClick={() => choose(p)}>
                {p.desc}
                <span>{shortAmount(p.amount)}</span>
              </button>
            ))}
          </div>
        )}

        {error && <div className="uz-qa-error" role="alert">{error}</div>}

        <div className="uz-qa-keys">
          {KEYS.map((k) => (
            <button key={k} type="button" className="uz-qa-key" onClick={() => press(k)} aria-label={k === 'del' ? 'O‘chirish' : k}>
              {k === 'del' ? <Delete size={24} strokeWidth={2} /> : k}
            </button>
          ))}
        </div>

        <button type="button" className="uz-qa-save" disabled={!canSave} onClick={save}>
          <Check size={20} strokeWidth={2.8} />
          {isSaving ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
      </div>
    </div>
  );
}
