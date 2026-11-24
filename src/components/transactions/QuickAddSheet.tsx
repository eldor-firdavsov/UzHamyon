'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarDays, Check, ChevronDown, Clock, Delete, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { convertAmount, formatAmount, formatWithUnit, unitLabel, type DisplayCurrency } from '@/lib/fx/currency';
import { getCategoryMeta } from '@/components/categories/CategoryIcon';
import { predictCategoryFromTitle } from '@/lib/categories/predictCategory';
import { computeQuickPicks, shortAmount, type QuickPick, type QuickPickSource } from '@/lib/transactions/quickPicks';
import { addDaysToDate } from '@/lib/time/tashkent';
import { getNowLocalDateString, getNowLocalTimeString } from '@/lib/transactions/dateTime';
import { useModalScrollLock } from '@/lib/ui/useModalScrollLock';
import { haptic } from '@/lib/ui/haptics';
import { useClosing } from '@/lib/ui/useClosing';
import { useI18n } from '@/lib/i18n/client';
import { categoryLabel, relativeDay, somLabel } from '@/lib/i18n/format';

export interface QuickAddInput {
  type: 'in' | 'ex';
  amount: string;
  desc: string;
  cat: string;
  date: string;
  time: string;
  /** Currency the amount was typed in (defaults to the user's display currency). */
  currency?: DisplayCurrency;
}

/** Mount only while open: every open starts with a fresh form. */
interface QuickAddSheetProps {
  /** Amounts already converted to `defaultCurrency`. */
  transactions: QuickPickSource[];
  /** The user's display currency: new entries start in it. */
  defaultCurrency?: DisplayCurrency;
  /** USD → UZS rate for the live equivalent under the amount. */
  usdUzs?: number;
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
  /** Optional question above the amount (first entry after registration). */
  title?: string;
}

type Panel = 'keys' | 'category' | 'day';

const MAX_DIGITS = 12;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;
/** Dollars need cents more than "000": the bottom-left key becomes a decimal point. */
const USD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;
type Key = (typeof KEYS)[number] | (typeof USD_KEYS)[number];

function groupDigits(digits: string): string {
  if (!digits) return '0';
  const [int, dec] = digits.split('.');
  const grouped = String(Number(int || '0')).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}

/** A number as keypad digits: whole so'm, dollars with up to 2 decimals ("12.5"). */
function toDigits(n: number, currency: DisplayCurrency): string {
  if (!(n > 0)) return '';
  if (currency === 'UZS') return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

function categoryFor(pickOrDesc: { cat?: string; desc: string }, type: 'in' | 'ex'): string {
  if (pickOrDesc.cat && pickOrDesc.cat !== 'Auto') return pickOrDesc.cat;
  return predictCategoryFromTitle(pickOrDesc.desc || '', type).category;
}


export default function QuickAddSheet({
  transactions,
  defaultCurrency = 'UZS',
  usdUzs = 0,
  categories,
  isSaving,
  error,
  onClose,
  onSave,
  initial,
  onDelete,
  title,
}: QuickAddSheetProps) {
  const { t, lang } = useI18n();
  const dayChipLabel = (d: string, ref: string) => relativeDay(d, ref, lang, false);
  const today = getNowLocalDateString();
  const editing = Boolean(initial);
  const [type, setType] = useState<'in' | 'ex'>(initial?.type ?? 'ex');
  const [currency, setCurrency] = useState<DisplayCurrency>(initial?.currency ?? defaultCurrency);
  const [digits, setDigits] = useState(() =>
    initial ? toDigits(Number(initial.amount.replace(/\s/g, '')) || 0, initial.currency ?? defaultCurrency) : ''
  );
  const [desc, setDesc] = useState(initial?.desc ?? '');
  const [cat, setCat] = useState(initial?.cat ?? 'Auto');
  const [date, setDate] = useState(initial?.date ?? today);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('keys');

  useModalScrollLock(true);
  const { closing, close } = useClosing(onClose);

  const picks = useMemo(() => computeQuickPicks(transactions, type, today), [transactions, type, today]);

  const effectiveCat = categoryFor({ cat, desc }, type);
  const catMeta = getCategoryMeta(effectiveCat, type);
  const CatIcon = catMeta.icon;
  const amountValue = Number(digits) || 0;
  const canSave = amountValue > 0 && desc.trim().length > 0 && !isSaving;
  const otherCurrency: DisplayCurrency = currency === 'USD' ? 'UZS' : 'USD';
  const equivalent = usdUzs > 0 && amountValue > 0 ? convertAmount(amountValue, currency, otherCurrency, usdUzs) : 0;
  const keys = currency === 'USD' ? USD_KEYS : KEYS;
  /** Pick amounts come in the display currency; show and fill them in the sheet's currency. */
  const pickAmount = (n: number) => (usdUzs > 0 ? convertAmount(n, defaultCurrency, currency, usdUzs) : n);
  const pickLabel = (n: number) => {
    const v = pickAmount(n);
    if (!(v > 0)) return '';
    return currency === 'USD' ? (v < 1000 ? `$${formatAmount(v, 'USD')}` : `$${shortAmount(v)}`) : shortAmount(v);
  };
  const catOptions = ['Auto', ...categories[type].filter((c) => c && c !== 'Auto')];

  const choose = (p: QuickPick) => {
    haptic('light');
    setPickedKey(p.key);
    setDesc(p.desc);
    setCat(p.cat || 'Auto');
    if (p.amount > 0) setDigits(toDigits(pickAmount(p.amount), currency));
  };

  const press = (k: Key) => {
    haptic('light');
    setDigits((prev) => {
      if (k === 'del') return prev.slice(0, -1);
      if (k === '.') {
        if (currency !== 'USD' || prev.includes('.')) return prev;
        return (prev || '0') + '.';
      }
      if (prev.includes('.')) {
        // At most 2 decimals ("000" makes no sense after the point).
        const dec = prev.split('.')[1] ?? '';
        if (k === '000' || dec.length >= 2) return prev;
        return prev + k;
      }
      const next = (prev === '0' ? '' : prev) + k;
      const trimmed = next.replace(/^0+/, '');
      return trimmed.length > MAX_DIGITS ? prev : trimmed;
    });
  };

  /** so'm ⇄ $: changes the unit of what is typed; the equivalent line shows the other one. */
  const toggleCurrency = () => {
    haptic('light');
    const next: DisplayCurrency = currency === 'USD' ? 'UZS' : 'USD';
    setCurrency(next);
    if (next === 'UZS') setDigits((prev) => (prev.includes('.') ? toDigits(Number(prev), 'UZS') : prev));
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
      amount: digits.replace(/\.$/, ''),
      currency,
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
      data-closing={closing}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) close();
      }}
    >
      <div className="uz-qa-sheet" role="dialog" aria-modal="true" aria-label={editing ? t.quick.editTitle : t.quick.addTitle}>
        <div className="uz-sh-grab" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" className="uz-qa-round" aria-label={t.common.close} onClick={close} disabled={isSaving}>
            <X size={20} strokeWidth={2.2} />
          </button>
          <div className="uz-qa-seg" role="group" aria-label={t.common.type}>
            <button type="button" aria-pressed={type === 'ex'} onClick={() => switchType('ex')}>
              {t.common.expense}
            </button>
            <button type="button" aria-pressed={type === 'in'} onClick={() => switchType('in')}>
              {t.common.income}
            </button>
          </div>
          <button
            type="button"
            className="uz-qa-day"
            aria-expanded={panel === 'day'}
            aria-label={t.quick.dateAria(dayChipLabel(date, today))}
            onClick={() => setPanel((p) => (p === 'day' ? 'keys' : 'day'))}
          >
            <Clock size={14} strokeWidth={2.4} />
            {dayChipLabel(date, today)}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {title && !editing && <p className="uz-qa-title">{title}</p>}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }} aria-live="polite">
            <span className="uz-qa-amount" style={{ color: type === 'in' ? '#2E7D32' : '#111511' }}>
              {type === 'in' ? '+' : '−'}
              {currency === 'USD' ? '$' : ''}
              {groupDigits(digits)}
            </span>
            <button
              type="button"
              className="uz-qa-cur"
              data-cur={currency}
              onClick={toggleCurrency}
              disabled={isSaving}
              aria-label={t.currency.switchAria(otherCurrency === 'USD')}
            >
              <span>{currency === 'USD' ? 'USD' : unitLabel(currency, lang)}</span>
              <ArrowLeftRight size={13} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </div>
          <div className="uz-qa-equiv num" aria-live="polite">
            {equivalent > 0 ? `≈ ${formatWithUnit(equivalent, otherCurrency, lang)}` : usdUzs > 0 ? `1 $ = ${formatAmount(usdUzs, 'UZS')} ${somLabel(lang)}` : '\u00a0'}
          </div>
          <label htmlFor="qa-desc" className="sr-only">{t.quick.nameLabel}</label>
          <input
            id="qa-desc"
            className="uz-qa-desc"
            value={desc}
            maxLength={255}
            placeholder={type === 'ex' ? t.quick.whatFor : t.quick.fromWhere}
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
              aria-label={t.quick.categoryAria(categoryLabel(effectiveCat, lang))}
            >
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: catMeta.bg, color: catMeta.color, display: 'grid', placeItems: 'center' }}>
                <CatIcon size={13} strokeWidth={2.4} />
              </span>
              <span>{categoryLabel(effectiveCat, lang)}</span>
              <ChevronDown size={14} color="#6B7068" style={{ transform: panel === 'category' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
          )}
        </div>

        {panel === 'category' && (
          <div className="uz-qa-catgrid" role="listbox" aria-label={t.common.category}>
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
                  <span className="uz-qa-fav-name">{categoryLabel(isAuto ? 'Avto' : name, lang)}</span>
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
              <span>{t.quick.other}</span>
              <input
                type="date"
                className="uz-qa-dateinput"
                max={today}
                min="2020-01-01"
                value={date}
                aria-label={t.quick.otherDate}
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
                      <span className="uz-qa-fav-amt">{pickLabel(p.amount)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {!editing && picks.recents.length > 0 && (
              <div className="uz-qa-recents" aria-label={t.quick.recents}>
                <Clock size={18} color="#6B7068" style={{ flex: '0 0 18px' }} aria-hidden="true" />
                {picks.recents.map((p) => (
                  <button key={p.key} type="button" className="uz-qa-recent" onClick={() => choose(p)}>
                    {p.desc}
                    <span>{pickLabel(p.amount)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="uz-qa-keys">
              {keys.map((k) => (
                <button key={k} type="button" className="uz-qa-key" onClick={() => press(k)} aria-label={k === 'del' ? t.quick.deleteDigit : k === '.' ? t.currency.decimalPoint : k}>
                  {k === 'del' ? <Delete size={24} strokeWidth={2} /> : k}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <div className="uz-qa-error" role="alert">{error}</div>}

        <div className="uz-qa-actions">
          {editing && onDelete && (
            <button type="button" className="uz-qa-trash" aria-label={t.quick.deleteEntry} onClick={onDelete} disabled={isSaving}>
              <Trash2 size={22} strokeWidth={2.2} />
            </button>
          )}
          <button type="button" className="uz-qa-save" style={{ flex: 1 }} disabled={!canSave} onClick={save}>
            {isSaving ? <Loader2 size={20} strokeWidth={2.6} className="animate-spin" /> : <Check size={20} strokeWidth={2.8} />}
            {isSaving ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
