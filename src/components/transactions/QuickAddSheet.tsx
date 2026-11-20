'use client';

import React, { useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Clock, Delete, Loader2, Sparkles, Trash2, X } from 'lucide-react';
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
  /** Category names the user can pick, per type ('Auto' is added automatically). */
  categories: { ex: string[]; in: string[] };
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  /** Resolves true when the database confirmed the write. */
  onSave: (input: QuickAddInput) => Promise<boolean>;
  /** Editing an existing entry: starts from these values and shows Delete. */
  initial?: QuickAddInput;
  onDelete?: () => void;
}

type Panel = 'keys' | 'category' | 'day';

const MAX_DIGITS = 12;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;
const SHORT_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

function groupDigits(digits: string): string {
  if (!digits) return '0';
  return String(Number(digits)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function categoryFor(pickOrDesc: { cat?: string; desc: string }, type: 'in' | 'ex'): string {
  if (pickOrDesc.cat && pickOrDesc.cat !== 'Auto') return pickOrDesc.cat;
  return predictCategoryFromTitle(pickOrDesc.desc || '', type).category;
}

function dayChipLabel(date: string, today: string): string {
  if (date === today) return 'Bugun';
  if (date === addDaysToDate(today, -1)) return 'Kecha';
  return `${Number(date.slice(8, 10))}-${SHORT_MONTHS[Number(date.slice(5, 7)) - 1] ?? ''}`;
}

export default function QuickAddSheet({
  transactions,
  categories,
  isSaving,
  error,
  onClose,
  onSave,
  initial,
  onDelete,
}: QuickAddSheetProps) {
  const today = getNowLocalDateString();
  const editing = Boolean(initial);
  const [type, setType] = useState<'in' | 'ex'>(initial?.type ?? 'ex');
  const [digits, setDigits] = useState(initial ? String(Math.round(Number(initial.amount.replace(/\s/g, '')) || 0) || '') : '');
  const [desc, setDesc] = useState(initial?.desc ?? '');
  const [cat, setCat] = useState(initial?.cat ?? 'Auto');
  const [date, setDate] = useState(initial?.date ?? today);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('keys');

  useModalScrollLock(true);

  const picks = useMemo(() => computeQuickPicks(transactions, type, today), [transactions, type, today]);

  const effectiveCat = categoryFor({ cat, desc }, type);
  const catMeta = getCategoryMeta(effectiveCat, type);
  const CatIcon = catMeta.icon;
  const canSave = Number(digits) > 0 && desc.trim().length > 0 && !isSaving;
  const catOptions = ['Auto', ...categories[type].filter((c) => c && c !== 'Auto')];

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

  const switchType = (t: 'in' | 'ex') => {
    setType(t);
    setPickedKey(null);
    setCat('Auto');
  };

  const save = async () => {
    if (!canSave) return;
    const keepTime = editing && initial && initial.date === date;
    const ok = await onSave({
      type,
      amount: digits,
      desc: desc.trim(),
      cat,
      date,
      time: keepTime ? initial!.time : date === today ? getNowLocalTimeString() : '12:00',
    });
    if (ok) haptic('success');
  };

  const pickDay = (d: string) => {
    if (!d || d > today) return;
    haptic('light');
    setDate(d);
    setPanel('keys');
  };

  return (
    <div
      className="uz-qa-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="uz-qa-sheet" role="dialog" aria-modal="true" aria-label={editing ? 'Amalni tahrirlash' : 'Amal qo‘shish'}>
        <div className="uz-sh-grab" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" className="uz-qa-round" aria-label="Yopish" onClick={onClose} disabled={isSaving}>
            <X size={20} strokeWidth={2.2} />
          </button>
          <div className="uz-qa-seg" role="group" aria-label="Turi">
            <button type="button" aria-pressed={type === 'ex'} onClick={() => switchType('ex')}>
              Chiqim
            </button>
            <button type="button" aria-pressed={type === 'in'} onClick={() => switchType('in')}>
              Kirim
            </button>
          </div>
          <button
            type="button"
            className="uz-qa-day"
            aria-expanded={panel === 'day'}
            aria-label={`Sana: ${dayChipLabel(date, today)}. O‘zgartirish`}
            onClick={() => setPanel((p) => (p === 'day' ? 'keys' : 'day'))}
          >
            <Clock size={14} strokeWidth={2.4} />
            {dayChipLabel(date, today)}
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
            onFocus={() => setPanel('keys')}
            onChange={(e) => {
              setDesc(e.target.value);
              setPickedKey(null);
            }}
          />
          {desc.trim() && (
            <button
              type="button"
              className="uz-qa-chip"
              aria-expanded={panel === 'category'}
              onClick={() => setPanel((p) => (p === 'category' ? 'keys' : 'category'))}
              aria-label={`Kategoriya: ${effectiveCat}. O‘zgartirish`}
            >
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: catMeta.bg, color: catMeta.color, display: 'grid', placeItems: 'center' }}>
                <CatIcon size={13} strokeWidth={2.4} />
              </span>
              <span>{effectiveCat}</span>
              <ChevronDown size={14} color="#6B7068" style={{ transform: panel === 'category' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
          )}
        </div>

        {panel === 'category' && (
          <div className="uz-qa-catgrid" role="listbox" aria-label="Kategoriya">
            {catOptions.map((name) => {
              const isAuto = name === 'Auto';
              const meta = getCategoryMeta(isAuto ? effectiveCat : name, type);
              const Icon = isAuto ? Sparkles : meta.icon;
              const selected = isAuto ? cat === 'Auto' : cat === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="uz-qa-fav"
                  onClick={() => {
                    haptic('light');
                    setCat(name);
                    setPanel('keys');
                  }}
                >
                  <span
                    className="uz-qa-fav-ic"
                    style={isAuto ? { background: '#163300', color: '#9FE870' } : { background: meta.bg, color: meta.color }}
                  >
                    <Icon size={22} strokeWidth={2.1} />
                  </span>
                  <span className="uz-qa-fav-name">{isAuto ? 'Avto' : name}</span>
                </button>
              );
            })}
          </div>
        )}

        {panel === 'day' && (
          <div className="uz-qa-days">
            {[today, addDaysToDate(today, -1), addDaysToDate(today, -2)].map((d) => (
              <button key={d} type="button" className="uz-qa-dayopt" aria-pressed={date === d} onClick={() => pickDay(d)}>
                {dayChipLabel(d, today)}
              </button>
            ))}
            <label className="uz-qa-dayopt" aria-pressed={![today, addDaysToDate(today, -1), addDaysToDate(today, -2)].includes(date)}>
              <CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>Boshqa</span>
              <input
                type="date"
                className="uz-qa-dateinput"
                max={today}
                min="2020-01-01"
                value={date}
                aria-label="Boshqa sana"
                onChange={(e) => pickDay(e.target.value)}
              />
            </label>
          </div>
        )}

        {panel === 'keys' && (
          <>
            {!editing && (
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
            )}

            {!editing && picks.recents.length > 0 && (
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

            <div className="uz-qa-keys">
              {KEYS.map((k) => (
                <button key={k} type="button" className="uz-qa-key" onClick={() => press(k)} aria-label={k === 'del' ? 'Raqamni o‘chirish' : k}>
                  {k === 'del' ? <Delete size={24} strokeWidth={2} /> : k}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <div className="uz-qa-error" role="alert">{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          {editing && onDelete && (
            <button type="button" className="uz-qa-trash" aria-label="Amalni o‘chirish" onClick={onDelete} disabled={isSaving}>
              <Trash2 size={22} strokeWidth={2.2} />
            </button>
          )}
          <button type="button" className="uz-qa-save" style={{ flex: 1 }} disabled={!canSave} onClick={save}>
            {isSaving ? <Loader2 size={20} strokeWidth={2.6} className="animate-spin" /> : <Check size={20} strokeWidth={2.8} />}
            {isSaving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
